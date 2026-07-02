# CLAUDE.md

빙그레 네컷 (Binggrae Cuts) — 브라우저 기반 인생네컷 포토부스 앱.
원본은 Lovable에서 제작되었고, 현재는 Claude Code로 이어서 개발한다.

## 명령어 (패키지 매니저: bun)

```bash
bun install        # 의존성 설치
bun run dev        # 개발 서버 (vite dev) — 카메라 테스트는 https 또는 localhost 필요
bun run build      # 프로덕션 빌드 (client + SSR, Cloudflare Workers 타깃)
bun run preview    # 빌드 결과 미리보기
bun run lint       # eslint
bun run format     # prettier --write
bunx tsc --noEmit  # 타입체크
```

> 카메라(`getUserMedia`)는 보안 컨텍스트에서만 동작한다. `localhost`는 허용되므로 로컬 개발은 문제없다.

## 기술 스택

- **TanStack Start** (파일 기반 라우팅 + SSR) on **React 19**
- **Vite 7** + **Tailwind CSS 4** + **shadcn/ui** (new-york 스타일, `src/components/ui`)
- **Railway** 배포 타깃 (Node/Bun 서버). `vite.config.ts`의 `cloudflare: false`로 Workers 타깃을 끄고,
  SSR fetch 핸들러(`dist/server/server.js`)를 `serve.ts`(Bun.serve)가 감싸 정적 파일과 함께 서빙한다.
  > `wrangler.jsonc` / `src/server.ts`는 원래 Cloudflare Workers용. 현재 배포에는 미사용이지만 남겨둠.
- 빌드 설정은 **`@lovable.dev/vite-tanstack-config`** 패키지가 대부분 캡슐화한다 (아래 주의 참고)

### 배포 (Railway)
- `bun run build` → `dist/client`(정적) + `dist/server/server.js`(SSR 핸들러) 생성.
- `bun run start` → `serve.ts`가 `PORT`(기본 3000)에서 리슨, 정적 파일 우선 + SSR 폴백.
- Railway는 GitHub 레포에서 자동 빌드: `nixpacks.toml`(install/build) + `railway.json`(startCommand) 참고.

## 아키텍처

촬영·합성은 전부 **클라이언트 사이드**에서 처리된다. 사진은 사용자가 "주민들에게 자랑하기"로
광장 게시판에 올릴 때만 서버(게시판 저장소)로 전송된다.

- `src/routes/index.tsx` — 단일 페이지 상태머신(`Step`, `src/lib/game.ts`). 진행 단계:
  `main → letter → map(축제 지도) → select(프레임 선택) → shoot(촬영) → result(합성/꾸미기/저장/공유)`
  + 지도에서 분기: `draw`(아이스크림 뽑기) / `board`(광장 게시판) / `end`(축제 종료)
- `src/screens/` — 단계별 화면 컴포넌트:
  - `ShootScreen`: `getUserMedia`로 셀카 미리보기(좌우 반전), 카운트다운 ×4컷 캡처
  - `ResultScreen`: 4컷을 프레임에 합성한 뒤 `PhotoEditor`(같은 파일)로 꾸미기, PNG 저장 /
    Web Share API 공유 / 광장 게시판 업로드. 스티커/획 좌표·크기는 이미지 대비 **비율(0~1)** 로
    저장해 화면 표시와 원본 해상도 PNG 내보내기가 일치한다. 저장/공유는 `exportPng()`
    (imperative handle)로 편집 결과를 원본 해상도로 재합성
  - `FestivalMap`: 축제 지도 + 핫스팟 미니게임(인벤토리), `PlazaBoard`: 게시판(무한 스크롤·좋아요),
    `DrawScreen`: 스크래치 운세
- `src/lib/photobooth.ts` — 핵심 이미지 로직:
  - `detectGreenSlots()` — 프레임 PNG의 **초록색 플레이스홀더** 영역을 flood-fill로 자동 감지해 사진이 들어갈 슬롯(최대 4개) 좌표를 계산
  - `fallbackSlots()` — 감지가 4개 미만이면 균등 분할 레이아웃으로 폴백
  - `composeStrip()` — 슬롯별로 사진(cover) → 오버레이 → 프레임(초록 영역 투명화) 순으로 캔버스 합성
- `src/lib/plaza.ts` — 광장 게시판 서버 함수(RPC). 저장소는 `REDIS_URL` 있으면 Bun 내장 Redis,
  없으면 인메모리. `/admin`(`src/routes/admin.tsx`)은 **`ADMIN_PASSWORD` 환경변수 필수** —
  미설정 시 어드민 기능이 비활성화된다 (소스에 기본 비밀번호를 두지 말 것).
- `src/lib/imageHooks.ts` — 에셋 후처리 훅(흰 배경 키잉/크롭/누끼/트림, 모듈 레벨 캐시)
- `src/assets/` — 프레임 4종(binggraeus/melonaprince/bravocone/bananamilk), 배경·버튼·아이콘 에셋
- `src/routes/__root.tsx` — HTML 셸, 메타태그, 404/에러 컴포넌트, react-query Provider
- `src/server.ts` / `src/start.ts` — SSR 에러를 브랜드 에러 페이지로 정규화하는 래퍼

### 프레임을 추가/수정하려면
1. `src/assets/`에 프레임 PNG 추가 — 사진이 들어갈 자리는 **순수 초록색**으로 채운다 (감지 기준: `g>180, r<120, b<120, g>r+80, g>b+80`, `photobooth.ts`의 `isPlaceholderGreen`).
2. (장식이 슬롯을 침범하는 프레임이면) 슬롯별 오버레이 PNG 추가 — 새 프레임들은 장식이
   프레임 이미지에 포함돼 있어 투명 픽셀(`TRANSPARENT_PX`)로 충분하다.
3. `src/data/frames.ts`의 `FRAMES` 레코드와 `FrameKey`(`src/lib/photobooth.ts`)에 키 등록.

## 주의사항

- **`vite.config.ts`에 플러그인을 직접 추가하지 말 것.** `tanstackStart`, `viteReact`, `tailwindcss`, tsconfig paths, cloudflare, componentTagger 등은 `@lovable.dev/vite-tanstack-config`가 이미 포함한다. 중복 추가 시 앱이 깨진다. 추가 설정은 `defineConfig({ vite: { ... } })`로 전달한다.
- `src/routeTree.gen.ts`는 **자동 생성** 파일. 직접 수정하지 말 것 (prettier/eslint 무시 대상).
- `@` → `src/` 경로 별칭이 설정되어 있다.
- 코드 스타일: prettier (printWidth 100, semi, double-quote, trailing comma all). UI 텍스트는 한국어.
- `bunfig.toml`에 공급망 가드(`minimumReleaseAge` 24h)가 있다. 새 패키지가 막히면 의도된 동작이다.
