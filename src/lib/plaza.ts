// 광장 게시판 — 서버 함수(RPC)로 게시물(사진+제목)을 올리고 불러온다.
//
// 저장소는 두 가지를 자동 선택한다 (모두 서버 측에서만 동작):
//   1) REDIS_URL 환경변수가 있으면 → Bun 내장 Redis 클라이언트(의존성 없음).
//      Railway 등에서 Redis 인스턴스를 붙이고 REDIS_URL만 넣으면 영구·공유 게시판이 된다.
//   2) 없으면 → 프로세스 메모리(인메모리). 로컬 개발/미리보기용. 서버 재시작 시 초기화.
//
// dev(`bun run dev`)·prod(`bun run serve.ts`) 모두 Bun 런타임이라 Bun.redis를 그대로 쓴다.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

export type PlazaPost = {
  id: string;
  title: string;
  author: string; // 소속/이름 (선택)
  image: string; // 축소된 JPEG data URL
  frame: string;
  createdAt: number;
  likes: number; // 누적 좋아요 수 (별도 저장소에서 list 시 병합)
};

const KEY = "plaza:posts";
const KEY_LIKES = "plaza:likes"; // 좋아요 카운트 해시(field=게시물 id)
const MAX_POSTS = 60; // 게시판에 보관/노출하는 최신 게시물 수
const MAX_TITLE = 40;
const MAX_AUTHOR = 24;
const MAX_FRAME = 40;
const MAX_IMAGE_CHARS = 900_000; // data URL 길이 상한(약 650KB) — 과대 업로드 차단

type Store = {
  add: (p: PlazaPost) => Promise<void>;
  list: (limit: number) => Promise<PlazaPost[]>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  like: (id: string, delta: number) => Promise<number>; // 새 누적 수 반환
};

// 인메모리 저장소 — globalThis에 보관해 HMR/모듈 재평가에도 유지.
function memoryStore(): Store {
  const g = globalThis as unknown as {
    __plazaPosts?: PlazaPost[];
    __plazaLikes?: Record<string, number>;
  };
  g.__plazaPosts ??= [];
  g.__plazaLikes ??= {};
  const arr = g.__plazaPosts;
  const likes = g.__plazaLikes;
  return {
    async add(p) {
      arr.unshift(p);
      if (arr.length > MAX_POSTS) arr.length = MAX_POSTS;
    },
    async list(limit) {
      return arr.slice(0, limit).map((p) => ({ ...p, likes: likes[p.id] ?? 0 }));
    },
    async remove(id) {
      const i = arr.findIndex((p) => p.id === id);
      if (i >= 0) arr.splice(i, 1);
      delete likes[id];
    },
    async clear() {
      arr.length = 0;
      for (const k of Object.keys(likes)) delete likes[k];
    },
    async like(id, delta) {
      likes[id] = Math.max(0, (likes[id] ?? 0) + delta);
      return likes[id];
    },
  };
}

// Bun 내장 Redis 저장소 — LIST에 JSON을 LPUSH, LTRIM으로 최신 N개 유지.
function redisStore(redis: { send: (cmd: string, args: string[]) => Promise<unknown> }): Store {
  return {
    async add(p) {
      await redis.send("LPUSH", [KEY, JSON.stringify(p)]);
      await redis.send("LTRIM", [KEY, "0", String(MAX_POSTS - 1)]);
    },
    async list(limit) {
      const rows = (await redis.send("LRANGE", [KEY, "0", String(limit - 1)])) as string[];
      const likeMap = await readLikes(redis);
      const out: PlazaPost[] = [];
      for (const r of rows ?? []) {
        try {
          const p = JSON.parse(r) as PlazaPost;
          out.push({ ...p, likes: likeMap[p.id] ?? 0 });
        } catch {
          /* 손상된 항목은 무시 */
        }
      }
      return out;
    },
    async remove(id) {
      // LIST엔 id 인덱스가 없으니 일치 항목의 원본 문자열을 찾아 LREM으로 원자 삭제(순서 유지).
      const rows = (await redis.send("LRANGE", [KEY, "0", "-1"])) as string[];
      for (const r of rows ?? []) {
        try {
          if ((JSON.parse(r) as PlazaPost).id === id) {
            await redis.send("LREM", [KEY, "0", r]);
          }
        } catch {
          /* 손상된 항목은 건너뜀 */
        }
      }
      await redis.send("HDEL", [KEY_LIKES, id]);
    },
    async clear() {
      await redis.send("DEL", [KEY]);
      await redis.send("DEL", [KEY_LIKES]);
    },
    async like(id, delta) {
      const n = Number(await redis.send("HINCRBY", [KEY_LIKES, id, String(delta)]));
      if (n < 0) {
        await redis.send("HSET", [KEY_LIKES, id, "0"]);
        return 0;
      }
      return n;
    },
  };
}

// HGETALL 결과(배열/객체 양쪽 형태)를 {id: count}로 정규화.
async function readLikes(redis: {
  send: (cmd: string, args: string[]) => Promise<unknown>;
}): Promise<Record<string, number>> {
  const raw = await redis.send("HGETALL", [KEY_LIKES]);
  const map: Record<string, number> = {};
  if (Array.isArray(raw)) {
    for (let i = 0; i + 1 < raw.length; i += 2) map[String(raw[i])] = Number(raw[i + 1]) || 0;
  } else if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) map[k] = Number(v) || 0;
  }
  return map;
}

// 저장소 선택을 한 번만 수행하고 캐시한다. Bun.redis는 첫 명령 때 지연 연결되므로,
// 여기서 PING으로 실제 연결을 확인한 뒤 실패하면 인메모리로 폴백한다(연결이 안 될 때
// 게시판 전체가 throw되는 걸 방지). 동기 호출부는 모두 `await getStore()`로 받는다.
let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) storePromise = selectStore();
  return storePromise;
}
async function selectStore(): Promise<Store> {
  const bun = (globalThis as unknown as { Bun?: { redis?: unknown } }).Bun;
  if (bun?.redis && process.env.REDIS_URL) {
    const redis = bun.redis as { send: (cmd: string, args: string[]) => Promise<unknown> };
    try {
      await redis.send("PING", []);
      return redisStore(redis);
    } catch (e) {
      console.warn("[plaza] Redis 연결 실패 — 인메모리로 폴백합니다.", e);
    }
  }
  return memoryStore();
}

// 간단한 인메모리 슬라이딩 윈도우 레이트리밋(IP별) — 자동 스팸 방지용 백스톱.
function rateLimit(bucket: string, max: number, windowMs: number): boolean {
  const g = globalThis as unknown as { __plazaRL?: Map<string, number[]> };
  g.__plazaRL ??= new Map();
  let ip = "unknown";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    /* 요청 컨텍스트 밖이면 unknown */
  }
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (g.__plazaRL.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) return false;
  hits.push(now);
  g.__plazaRL.set(key, hits);
  return true;
}

// 최신 게시물 목록 — 게시판 화면에서 호출.
export const listPostsFn = createServerFn({ method: "GET" }).handler(async () => {
  return (await getStore()).list(MAX_POSTS);
});

// 게시물 등록 — 결과 화면 "주민들에게 자랑하기"에서 호출.
export const createPostFn = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; image: string; frame?: string; author?: string }) => {
    const title = (d?.title ?? "").trim().slice(0, MAX_TITLE);
    const image = d?.image ?? "";
    if (!title) throw new Error("제목을 입력해주세요.");
    if (!image.startsWith("data:image/")) throw new Error("이미지 형식이 올바르지 않습니다.");
    if (image.length > MAX_IMAGE_CHARS) throw new Error("이미지 용량이 너무 큽니다.");
    return {
      title,
      image,
      frame: (d?.frame ?? "").slice(0, MAX_FRAME),
      author: (d?.author ?? "").trim().slice(0, MAX_AUTHOR),
    };
  })
  .handler(async ({ data }) => {
    if (!rateLimit("post", 10, 60_000))
      throw new Error("너무 빠르게 올리고 있어요. 잠시 후 다시 시도해주세요.");
    const post: PlazaPost = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: data.title,
      author: data.author,
      image: data.image,
      frame: data.frame,
      createdAt: Date.now(),
      likes: 0,
    };
    await (await getStore()).add(post);
    return { ok: true as const, id: post.id };
  });

// 좋아요 토글 — like=true면 +1, false면 -1. 누구인지는 클라이언트(localStorage)가 관리하고
// 서버는 누적 수만 증감한다. 새 누적 수를 돌려준다.
export const likePostFn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; like: boolean }) => ({ id: d?.id ?? "", like: !!d?.like }))
  .handler(async ({ data }) => {
    if (!data.id) throw new Error("게시물 id가 필요합니다.");
    if (!rateLimit("like", 60, 60_000)) throw new Error("잠시 후 다시 시도해주세요.");
    const likes = await (await getStore()).like(data.id, data.like ? 1 : -1);
    return { ok: true as const, likes };
  });

// ─────────────── 어드민(/admin) — 게시물 삭제 관리 ───────────────
// 비밀번호는 서버 핸들러 안에서만 비교되므로 클라이언트 번들에 노출되지 않는다.
// 운영 시 ADMIN_PASSWORD 환경변수로 덮어쓸 수 있다(없으면 기본값 사용).
let warnedNoAdminEnv = false;
function assertAdmin(password: string) {
  const envPw = process.env.ADMIN_PASSWORD;
  if (!envPw && !warnedNoAdminEnv) {
    warnedNoAdminEnv = true;
    // 저장소가 공개일 수 있으므로 소스 하드코딩 기본값에 의존하지 말 것.
    console.warn(
      "[plaza] ADMIN_PASSWORD 환경변수가 설정되지 않았습니다. /admin이 소스의 기본 비밀번호로 보호됩니다. 운영에서는 반드시 ADMIN_PASSWORD를 설정하세요.",
    );
  }
  const expected = envPw ?? "박종걸1!";
  if ((password ?? "") !== expected) throw new Error("UNAUTHORIZED");
}

// 비밀번호 확인(로그인) — 통과하면 게시물 목록을 함께 돌려준다.
export const adminLoginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: d?.password ?? "" }))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    return { ok: true as const, posts: await (await getStore()).list(MAX_POSTS) };
  });

// 단일 게시물 삭제.
export const deletePostFn = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; id: string }) => ({
    password: d?.password ?? "",
    id: d?.id ?? "",
  }))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await (await getStore()).remove(data.id);
    return { ok: true as const };
  });

// 전체 삭제.
export const clearPostsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: d?.password ?? "" }))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    await (await getStore()).clear();
    return { ok: true as const };
  });
