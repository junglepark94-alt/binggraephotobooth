// 프로덕션 진입점 (Railway / Bun).
//   vite build 결과물:
//     - dist/client/  — 정적 자산(JS/CSS/이미지). SSR HTML이 /assets/... 로 참조한다.
//     - dist/server/server.js — 표준 fetch 핸들러 (Cloudflare Worker 래핑 없음, cloudflare:false).
//   Bun.serve로 둘을 합친다: 정적 파일이 있으면 그대로 내려주고, 없으면 SSR 핸들러로 위임.
//
//   로컬 확인:  bun run build && bun run start
import { join, normalize } from "node:path";

type FetchHandler = {
  fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response> | Response;
};

const clientDir = join(import.meta.dir, "dist", "client");
const serverEntry = join(import.meta.dir, "dist", "server", "server.js");

const handler = ((await import(serverEntry)).default ?? {}) as FetchHandler;
if (typeof handler.fetch !== "function") {
  throw new Error(
    `SSR 핸들러를 찾지 못했습니다 (${serverEntry}). 'bun run build'를 먼저 실행했는지 확인하세요.`,
  );
}

const port = Number(process.env.PORT ?? 3000);

// dist/client 밖으로 나가는 경로(.. 등)를 막는다.
function safeClientPath(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const full = normalize(join(clientDir, decoded));
  if (
    full !== clientDir &&
    !full.startsWith(clientDir + (process.platform === "win32" ? "\\" : "/"))
  ) {
    return null;
  }
  return full;
}

const server = Bun.serve({
  port,
  idleTimeout: 60,
  async fetch(request) {
    const url = new URL(request.url);

    // 루트("/")는 항상 SSR. 나머지는 정적 파일 우선.
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname !== "/") {
      const filePath = safeClientPath(url.pathname);
      if (filePath) {
        const file = Bun.file(filePath);
        if (await file.exists()) {
          const headers: Record<string, string> = {};
          // vite가 해시를 붙인 자산은 장기 캐시.
          if (url.pathname.startsWith("/assets/")) {
            headers["cache-control"] = "public, max-age=31536000, immutable";
          }
          return new Response(file, { headers });
        }
      }
    }

    return handler.fetch(request);
  },
});

console.log(`🍦 빙그레 네컷 server listening on http://localhost:${server.port}`);
