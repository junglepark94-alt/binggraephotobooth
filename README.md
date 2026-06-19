# 빙그레 네컷 (Binggrae Cuts)

브라우저에서 바로 찍는 인생네컷 포토부스. 빙그레 프레임을 골라 4컷을 촬영하고,
프레임에 합성해 저장·공유할 수 있다. 모든 처리는 기기 내에서만 이루어지며 사진은 서버에 저장되지 않는다.

## 빠른 시작

```bash
bun install
bun run dev
```

브라우저에서 `http://localhost:3000`(또는 콘솔에 표시된 주소)을 연다.
카메라 촬영 기능은 `localhost` 또는 HTTPS 환경에서만 동작한다.

## 스크립트

| 명령어 | 설명 |
| --- | --- |
| `bun run dev` | 개발 서버 |
| `bun run build` | 프로덕션 빌드 (Cloudflare Workers 타깃) |
| `bun run preview` | 빌드 결과 미리보기 |
| `bun run lint` | ESLint |
| `bun run format` | Prettier 포매팅 |

## 기술 스택

TanStack Start · React 19 · Vite 7 · Tailwind CSS 4 · shadcn/ui · Cloudflare Workers

## 배포

Cloudflare Workers를 타깃으로 한다 (`wrangler.jsonc`). `bun run build` 후 Wrangler로 배포한다.

## 문서

아키텍처와 개발 가이드는 [CLAUDE.md](./CLAUDE.md) 참고.
