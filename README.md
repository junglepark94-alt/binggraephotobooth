# 빙그레 네컷 (Binggrae Cuts)

브라우저에서 바로 찍는 인생네컷 포토부스. 빙그레 프레임을 골라 4컷을 촬영하고,
프레임에 합성해 저장·공유할 수 있다. 모든 처리는 기기 내에서만 이루어지며 사진은 서버에 저장되지 않는다.

## 빠른 시작

```bash
bun install
bun run dev
```

브라우저에서 `http://localhost:8080`(또는 콘솔에 표시된 주소)을 연다.
카메라 촬영 기능은 `localhost` 또는 HTTPS 환경에서만 동작한다.

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `bun run dev` | 개발 서버 (Vite, 포트 8080) |
| `bun run build` | 프로덕션 빌드 (client + SSR) |
| `bun run start` | 빌드 결과를 `serve.ts`로 서빙 (PORT 기본 3000) |
| `bun run preview` | 빌드 결과 미리보기 |
| `bun run lint` | ESLint |
| `bun run format` | Prettier 포매팅 |

## 기술 스택

TanStack Start · React 19 · Vite 7 · Tailwind CSS 4 · shadcn/ui · Bun · Railway

## 배포

**Railway**를 타깃으로 한다 (Bun 서버). `bun run build` → `dist/client`(정적) + `dist/server/server.js`(SSR)
생성 후, `bun run start`가 `serve.ts`(Bun.serve)로 정적 파일 우선 + SSR 폴백 서빙한다.
GitHub `main` 푸시 시 Railway가 자동 빌드(`nixpacks.toml` + `railway.json`). 광장 게시판을 영구
보관하려면 Redis를 붙이고 `REDIS_URL`을 설정한다.

> `wrangler.jsonc`는 원래 Cloudflare Workers용이었으나 현재 배포에는 미사용.

## 문서

- 프로젝트 전반 요약은 [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) 참고.
- 아키텍처와 개발 가이드는 [CLAUDE.md](./CLAUDE.md) 참고.
