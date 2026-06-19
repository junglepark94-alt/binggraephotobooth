// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// cloudflare: false — Railway 배포를 위해 Cloudflare Workers 타깃을 끈다.
//   끄면 SSR 빌드가 Worker 번들 대신 표준 fetch 핸들러(dist/server/server.js)로 나온다.
//   이 핸들러를 Bun HTTP 서버로 감싸고 정적 파일(dist/client)을 서빙하는 진입점이 serve.ts.
// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
export default defineConfig({
  cloudflare: false,
  tanstackStart: {
    server: { entry: "server" },
  },
});
