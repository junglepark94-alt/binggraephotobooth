// 광장 게시판 — 서버 함수(RPC)로 게시물(사진+제목)을 올리고 불러온다.
//
// 저장소는 두 가지를 자동 선택한다 (모두 서버 측에서만 동작):
//   1) REDIS_URL 환경변수가 있으면 → Bun 내장 Redis 클라이언트(의존성 없음).
//      Railway 등에서 Redis 인스턴스를 붙이고 REDIS_URL만 넣으면 영구·공유 게시판이 된다.
//   2) 없으면 → 프로세스 메모리(인메모리). 로컬 개발/미리보기용. 서버 재시작 시 초기화.
//
// dev(`bun run dev`)·prod(`bun run serve.ts`) 모두 Bun 런타임이라 Bun.redis를 그대로 쓴다.
import { createServerFn } from "@tanstack/react-start";

export type PlazaPost = {
  id: string;
  title: string;
  author: string; // 소속/이름 (선택)
  image: string; // 축소된 JPEG data URL
  frame: string;
  createdAt: number;
};

const KEY = "plaza:posts";
const MAX_POSTS = 60; // 게시판에 보관/노출하는 최신 게시물 수
const MAX_TITLE = 40;
const MAX_AUTHOR = 24;
const MAX_IMAGE_CHARS = 900_000; // data URL 길이 상한(약 650KB) — 과대 업로드 차단

type Store = {
  add: (p: PlazaPost) => Promise<void>;
  list: (limit: number) => Promise<PlazaPost[]>;
};

// 인메모리 저장소 — globalThis에 보관해 HMR/모듈 재평가에도 유지.
function memoryStore(): Store {
  const g = globalThis as unknown as { __plazaPosts?: PlazaPost[] };
  g.__plazaPosts ??= [];
  const arr = g.__plazaPosts;
  return {
    async add(p) {
      arr.unshift(p);
      if (arr.length > MAX_POSTS) arr.length = MAX_POSTS;
    },
    async list(limit) {
      return arr.slice(0, limit);
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
      const out: PlazaPost[] = [];
      for (const r of rows ?? []) {
        try {
          out.push(JSON.parse(r) as PlazaPost);
        } catch {
          /* 손상된 항목은 무시 */
        }
      }
      return out;
    },
  };
}

function getStore(): Store {
  const bun = (globalThis as unknown as { Bun?: { redis?: unknown } }).Bun;
  if (bun?.redis && process.env.REDIS_URL) {
    try {
      return redisStore(bun.redis as { send: (cmd: string, args: string[]) => Promise<unknown> });
    } catch {
      /* 연결 실패 시 인메모리로 폴백 */
    }
  }
  return memoryStore();
}

// 최신 게시물 목록 — 게시판 화면에서 호출.
export const listPostsFn = createServerFn({ method: "GET" }).handler(async () => {
  return getStore().list(MAX_POSTS);
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
      frame: (d?.frame ?? "").slice(0, 40),
      author: (d?.author ?? "").trim().slice(0, MAX_AUTHOR),
    };
  })
  .handler(async ({ data }) => {
    const post: PlazaPost = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: data.title,
      author: data.author,
      image: data.image,
      frame: data.frame,
      createdAt: Date.now(),
    };
    await getStore().add(post);
    return { ok: true as const, id: post.id };
  });
