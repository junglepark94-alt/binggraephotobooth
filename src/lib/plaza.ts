// 광장 게시판 — 서버 함수(RPC)로 게시물(사진+제목)을 올리고 불러온다.
//
// 저장소는 두 가지를 자동 선택한다 (모두 서버 측에서만 동작):
//   1) REDIS_URL 환경변수가 있으면 → Bun 내장 Redis 클라이언트(의존성 없음).
//      Railway 등에서 Redis 인스턴스를 붙이고 REDIS_URL만 넣으면 영구·공유 게시판이 된다.
//   2) 없으면 → 프로세스 메모리(인메모리). 로컬 개발/미리보기용. 서버 재시작 시 초기화.
//
// dev(`bun run dev`)·prod(`bun run serve.ts`) 모두 Bun 런타임이라 Bun.redis를 그대로 쓴다.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

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
const KEY_IDS = "plaza:ids"; // 현존 게시물 id 세트 — 좋아요 대상 검증용
const MAX_POSTS = 200; // 서버에 보관하는 최신 게시물 수(롤링). 화면엔 페이지네이션으로 노출
const PAGE_LIMIT = 60; // 한 번에 불러오는 최대 수(무한 스크롤 페이지 크기)

export type SortKey = "new" | "likes";
const MAX_TITLE = 40;
const MAX_AUTHOR = 24;
const MAX_FRAME = 40;
const MAX_IMAGE_CHARS = 900_000; // data URL 길이 상한(약 650KB) — 과대 업로드 차단

type Store = {
  add: (p: PlazaPost) => Promise<void>;
  list: (offset: number, limit: number, sort: SortKey) => Promise<PlazaPost[]>;
  count: () => Promise<number>;
  has: (id: string) => Promise<boolean>; // 좋아요 대상이 실제 게시물인지 검증
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  like: (id: string, delta: number) => Promise<number>; // 새 누적 수 반환
};

function sortPosts(posts: PlazaPost[], sort: SortKey): PlazaPost[] {
  // "new"는 입력(최신순) 그대로, "likes"는 좋아요 내림차순(동률 시 최신순).
  if (sort !== "likes") return posts;
  return [...posts].sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
}

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
      // 롤링 삭제되는 게시물의 좋아요 기록도 함께 지운다 (좋아요 맵 무한 증가 방지).
      while (arr.length > MAX_POSTS) {
        const dropped = arr.pop();
        if (dropped) delete likes[dropped.id];
      }
    },
    async list(offset, limit, sort) {
      const merged = arr.map((p) => ({ ...p, likes: likes[p.id] ?? 0 }));
      return sortPosts(merged, sort).slice(offset, offset + limit);
    },
    async count() {
      return arr.length;
    },
    async has(id) {
      return arr.some((p) => p.id === id);
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
      // 트림으로 밀려나는 꼬리 게시물의 좋아요/id 흔적을 먼저 지운다 (해시·세트 무한 증가 방지).
      const dropped = (await redis.send("LRANGE", [KEY, String(MAX_POSTS), "-1"])) as string[];
      for (const r of dropped ?? []) {
        try {
          const id = (JSON.parse(r) as PlazaPost).id;
          await redis.send("HDEL", [KEY_LIKES, id]);
          await redis.send("SREM", [KEY_IDS, id]);
        } catch {
          /* 손상된 항목은 건너뜀 */
        }
      }
      await redis.send("LTRIM", [KEY, "0", String(MAX_POSTS - 1)]);
      await redis.send("SADD", [KEY_IDS, p.id]);
    },
    async list(offset, limit, sort) {
      const likeMap = await readLikes(redis);
      const parse = (rows: string[]) => {
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
      };
      if (sort === "likes") {
        // 좋아요순은 전체를 읽어 정렬 후 잘라야 정확하다(최대 200개라 부담 없음).
        const all = parse((await redis.send("LRANGE", [KEY, "0", "-1"])) as string[]);
        return sortPosts(all, sort).slice(offset, offset + limit);
      }
      // 최신순은 LIST 순서 그대로 → 범위만 읽으면 된다.
      const rows = (await redis.send("LRANGE", [
        KEY,
        String(offset),
        String(offset + limit - 1),
      ])) as string[];
      return parse(rows);
    },
    async count() {
      return Number(await redis.send("LLEN", [KEY])) || 0;
    },
    async has(id) {
      if (Number(await redis.send("SISMEMBER", [KEY_IDS, id]))) return true;
      // id 세트 도입 전에 쌓인 기존 데이터 호환 — 세트가 비어 있으면 목록에서 1회 재구축.
      const total = Number(await redis.send("LLEN", [KEY])) || 0;
      const size = Number(await redis.send("SCARD", [KEY_IDS])) || 0;
      if (total > 0 && size === 0) {
        const rows = (await redis.send("LRANGE", [KEY, "0", "-1"])) as string[];
        const ids: string[] = [];
        for (const r of rows ?? []) {
          try {
            ids.push((JSON.parse(r) as PlazaPost).id);
          } catch {
            /* 손상된 항목은 건너뜀 */
          }
        }
        if (ids.length) await redis.send("SADD", [KEY_IDS, ...ids]);
        return ids.includes(id);
      }
      return false;
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
      await redis.send("SREM", [KEY_IDS, id]);
    },
    async clear() {
      await redis.send("DEL", [KEY]);
      await redis.send("DEL", [KEY_LIKES]);
      await redis.send("DEL", [KEY_IDS]);
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

// 저장소 선택. Bun.redis는 첫 명령 때 지연 연결되므로 PING으로 실제 연결을 확인한다.
// 연결 성공 시에만 캐시하고, 실패하면 인메모리로 "이번 요청만" 폴백한 뒤 쿨다운 후
// 재시도한다 — 부팅 시점의 일시 장애로 프로세스 수명 내내 인메모리에 갇히지 않도록.
let cachedStore: Store | null = null;
let redisRetryAt = 0; // 이 시각 전까지는 PING 재시도 없이 인메모리 사용
const REDIS_RETRY_MS = 30_000;
async function getStore(): Promise<Store> {
  if (cachedStore) return cachedStore;
  const bun = (globalThis as unknown as { Bun?: { redis?: unknown } }).Bun;
  if (bun?.redis && process.env.REDIS_URL) {
    if (Date.now() < redisRetryAt) return memoryStore();
    const redis = bun.redis as { send: (cmd: string, args: string[]) => Promise<unknown> };
    try {
      await redis.send("PING", []);
      cachedStore = redisStore(redis);
      return cachedStore;
    } catch (e) {
      redisRetryAt = Date.now() + REDIS_RETRY_MS;
      console.warn("[plaza] Redis 연결 실패 — 인메모리로 임시 폴백, 30초 후 재시도합니다.", e);
      return memoryStore();
    }
  }
  cachedStore = memoryStore();
  return cachedStore;
}

// ─────────────── 레이트리밋 (IP별 인메모리 슬라이딩 윈도우) ───────────────
const RL_SWEEP_SIZE = 500; // 이 크기를 넘으면 오래된 IP 엔트리를 청소
const RL_MAX_WINDOW_MS = 10 * 60_000; // 청소 기준: 가장 긴 윈도우보다 오래된 기록은 폐기

function rlMap(): Map<string, number[]> {
  const g = globalThis as unknown as { __plazaRL?: Map<string, number[]> };
  g.__plazaRL ??= new Map();
  const map = g.__plazaRL;
  if (map.size > RL_SWEEP_SIZE) {
    const now = Date.now();
    for (const [k, hits] of map) {
      if (!hits.some((t) => now - t < RL_MAX_WINDOW_MS)) map.delete(k);
    }
  }
  return map;
}

// 요청 IP — X-Forwarded-For는 클라이언트가 앞쪽에 위조 값을 끼워 넣을 수 있으므로,
// 신뢰 프록시(Railway 에지)가 마지막에 덧붙인 "가장 오른쪽" 항목을 쓴다.
function clientIp(): string {
  try {
    const xff = getRequestHeader("x-forwarded-for");
    if (xff) {
      const last = xff.split(",").at(-1)?.trim();
      if (last) return last;
    }
    return getRequestIP() ?? "unknown";
  } catch {
    return "unknown"; // 요청 컨텍스트 밖
  }
}

// 자동 스팸 방지용 백스톱 — 윈도우 내 호출이 max 미만이면 기록 후 true.
function rateLimit(bucket: string, max: number, windowMs: number): boolean {
  const map = rlMap();
  const key = `${bucket}:${clientIp()}`;
  const now = Date.now();
  const hits = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    map.set(key, hits);
    return false;
  }
  hits.push(now);
  map.set(key, hits);
  return true;
}

// 기록 없이 확인만 (실패 횟수 기반 제한에서 사용).
function ratePeek(bucket: string, max: number, windowMs: number): boolean {
  const map = rlMap();
  const key = `${bucket}:${clientIp()}`;
  const now = Date.now();
  return (map.get(key) ?? []).filter((t) => now - t < windowMs).length < max;
}

// 확인 없이 기록만 (실패한 시도를 적립).
function rateHit(bucket: string): void {
  const map = rlMap();
  const key = `${bucket}:${clientIp()}`;
  const hits = map.get(key) ?? [];
  hits.push(Date.now());
  map.set(key, hits);
}

// 게시물 페이지 — 무한 스크롤(offset/limit) + 정렬(sort). total도 함께 돌려준다.
export const listPostsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { offset?: number; limit?: number; sort?: string }) => ({
    offset: Math.max(0, Math.floor(d?.offset ?? 0)),
    limit: Math.min(PAGE_LIMIT, Math.max(1, Math.floor(d?.limit ?? PAGE_LIMIT))),
    sort: (d?.sort === "likes" ? "likes" : "new") as SortKey,
  }))
  .handler(async ({ data }) => {
    const store = await getStore();
    const [posts, total] = await Promise.all([
      store.list(data.offset, data.limit, data.sort),
      store.count(),
    ]);
    return { posts, total };
  });

// 게시물 등록 — 결과 화면 "주민들에게 자랑하기"에서 호출.
export const createPostFn = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; image: string; frame?: string; author?: string }) => {
    const title = (d?.title ?? "").trim().slice(0, MAX_TITLE);
    const image = d?.image ?? "";
    if (!title) throw new Error("제목을 입력해주세요.");
    // 클라이언트는 항상 JPEG(downscaleDataUrl)을 보낸다 — 래스터 포맷만 허용(SVG 등 차단).
    if (!/^data:image\/(jpeg|png|webp)[;,]/.test(image))
      throw new Error("이미지 형식이 올바르지 않습니다.");
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
  .inputValidator((d: { id: string; like: boolean }) => ({
    id: String(d?.id ?? "").slice(0, 32),
    like: !!d?.like,
  }))
  .handler(async ({ data }) => {
    if (!data.id) throw new Error("게시물 id가 필요합니다.");
    if (!rateLimit("like", 60, 60_000)) throw new Error("잠시 후 다시 시도해주세요.");
    const store = await getStore();
    // 존재하는 게시물만 증감 — 임의 id로 좋아요 저장소가 불어나는 것을 막는다.
    if (!(await store.has(data.id))) throw new Error("게시물을 찾을 수 없습니다.");
    const likes = await store.like(data.id, data.like ? 1 : -1);
    return { ok: true as const, likes };
  });

// ─────────────── 어드민(/admin) — 게시물 삭제 관리 ───────────────
// 비밀번호는 서버 핸들러 안에서만 비교되므로 클라이언트 번들에 노출되지 않는다.
// ADMIN_PASSWORD 환경변수가 필수 — 없으면 어드민 기능 전체가 비활성화된다.
// (소스/git 히스토리에 남는 하드코딩 기본값은 두지 않는다. 로컬 개발은 .env에 설정.)
let warnedNoAdminEnv = false;

// 길이가 달라도 조기 종료 없이 전부 비교 — 타이밍 차이로 비밀번호를 추측하지 못하게.
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function assertAdmin(password: string) {
  const envPw = process.env.ADMIN_PASSWORD;
  if (!envPw) {
    if (!warnedNoAdminEnv) {
      warnedNoAdminEnv = true;
      console.warn(
        "[plaza] ADMIN_PASSWORD 환경변수가 설정되지 않아 /admin 기능이 비활성화되었습니다.",
      );
    }
    throw new Error("UNAUTHORIZED");
  }
  // 무차별 대입 방지 — 10분 내 실패 5회를 넘긴 IP는 비교 없이 거부.
  if (!ratePeek("adminfail", 5, 10 * 60_000)) throw new Error("UNAUTHORIZED");
  if (!safeEqual(password ?? "", envPw)) {
    rateHit("adminfail");
    throw new Error("UNAUTHORIZED");
  }
}

// 비밀번호 확인(로그인) — 통과하면 첫 페이지 + total을 함께 돌려준다.
export const adminLoginFn = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: d?.password ?? "" }))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const store = await getStore();
    const [posts, total] = await Promise.all([store.list(0, PAGE_LIMIT, "new"), store.count()]);
    return { ok: true as const, posts, total };
  });

// 어드민 추가 페이지(더 보기).
export const adminListFn = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string; offset?: number; limit?: number }) => ({
    password: d?.password ?? "",
    offset: Math.max(0, Math.floor(d?.offset ?? 0)),
    limit: Math.min(PAGE_LIMIT, Math.max(1, Math.floor(d?.limit ?? PAGE_LIMIT))),
  }))
  .handler(async ({ data }) => {
    assertAdmin(data.password);
    const store = await getStore();
    const [posts, total] = await Promise.all([
      store.list(data.offset, data.limit, "new"),
      store.count(),
    ]);
    return { ok: true as const, posts, total };
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
