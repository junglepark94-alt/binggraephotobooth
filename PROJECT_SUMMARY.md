# 빙그레 네컷 (Binggrae Cuts) — 프로젝트 요약

브라우저에서 바로 즐기는 **인생네컷 포토부스**. "빙그레 왕국 여름축제"라는 게임형 세계관 안에서
프레임을 골라 4컷을 촬영하고, 프레임에 합성해 저장·공유할 수 있다.

> 원본은 Lovable에서 제작되었고, 현재는 Claude Code로 이어서 개발한다.
> 상세 개발 가이드는 [CLAUDE.md](./CLAUDE.md), 빠른 시작은 [README.md](./README.md) 참고.

---

## 한눈에 보기

| 항목 | 내용 |
| --- | --- |
| 성격 | 클라이언트 사이드 포토부스 + 축제 미니게임 (SPA·SSR) |
| 프레임 | 4종 — 빙그레우스 / 메로나 옹떼 부르쟝 / 부라보콘 / 바나나맛우유 |
| 프라이버시 | 촬영·합성·저장이 **전부 기기 내 처리**. 사진은 서버로 전송되지 않음 |
| 스택 | TanStack Start · React 19 · Vite 7 · Tailwind 4 · shadcn/ui · Bun |
| 배포 | **Railway** (Bun 서버, `serve.ts`가 정적 파일 + SSR 서빙) |
| 이벤트 응모 | 공지문 안내 → 카카오톡 1:1 채팅방 링크 (`src/data/event.ts`) |

---

## 사용자 흐름

```
main(메인) → letter(편지) → map(축제 지도) → select(프레임 선택)
                                   │
                                   ├─ shoot(촬영 ×4컷) → result(합성·꾸미기·저장·공유)
                                   ├─ event(이벤트 공지)  … 공지문 → 카톡 1:1 채팅방 응모
                                   ├─ draw(뽑기)          … 스크래치 운세
                                   └─ end(축제 종료)
```

- 단일 페이지 상태머신(`src/routes/index.tsx`, 단계 정의는 `src/lib/game.ts`).
- **지도 미니게임**: 강아지→아이스크림, 왕자→하트, 주민→클로버, 사진부스→촬영, 뽑기기계 순으로
  인벤토리(`photo/clover/candy/heart`)를 모으며 진행. 각 핫스팟에 토스 스타일 CTA 버튼 + 느낌표 안내.

---

## 화면·모듈 구조

- `src/screens/`
  - **ShootScreen** — `getUserMedia` 셀카 미리보기(좌우 반전), 카운트다운 4컷 캡처
  - **ResultScreen** — 4컷을 프레임에 합성 → `PhotoEditor`로 스티커 꾸미기 →
    PNG 저장 / Web Share 공유 / 이벤트 응모 진입. 스티커는 이미지 대비 **비율(0~1)** 로 저장해
    화면 표시와 원본 해상도 내보내기가 일치. 저장·공유는 `exportPng()`로 원본 해상도 재합성
  - **FestivalMap** — 축제 지도 + 핫스팟 미니게임(인벤토리 진행바)
  - **EventNotice** — 이벤트 공지문 + 카톡 1:1 채팅방 응모 버튼
  - **DrawScreen** — 스크래치 운세
- `src/lib/photobooth.ts` — 핵심 이미지 로직
  - `detectGreenSlots()` — 프레임의 **순수 초록 플레이스홀더**를 flood-fill로 감지해 사진 슬롯(최대 4) 계산
  - `fallbackSlots()` — 감지 실패 시 균등 분할 폴백
  - `composeStrip()` — 슬롯별 사진(cover)→오버레이→프레임(초록 투명화) 순 캔버스 합성
- `src/lib/imageHooks.ts` — 에셋 후처리 훅(흰 배경 키잉/크롭/누끼/트림, 모듈 캐시)
- `src/components/common.tsx` — 공통 UI(로고, 이미지 버튼, `Hotspot`, 창/다이얼로그)
- `src/data/frames.ts` — 프레임 레코드 / `src/data/fortunes.ts` — 운세 데이터
- `src/data/event.ts` — 이벤트 공지 문구 + 카톡 1:1 채팅방 링크

---

## 이벤트 응모 & 프라이버시

- 사진은 **서버로 전송되지 않는다**. 촬영·합성·꾸미기·저장이 전부 브라우저 안에서 끝난다.
  (개인정보 보호를 위해 게시판 업로드 기능은 제거됨 — 서버 저장소·어드민도 함께 제거)
- 응모는 지도의 **이벤트 공지** 핫스팟 또는 결과 화면의 **"이벤트 응모하기"** 로 진입 →
  공지문 확인 → **카카오톡 1:1 채팅방**으로 이동해 진행한다.
- 공지 문구와 링크는 `src/data/event.ts` 상수만 고치면 된다. `KAKAO_CHAT_URL`이 비어 있으면
  응모 버튼이 비활성화되고 "준비 중" 안내가 대신 표시된다.

---

## 에셋 정책 (WebP)

대역폭·초기 로딩 절감을 위해 이미지는 전부 **WebP**로 관리한다 (원본 PNG 대비 번들 이미지 **약 14.6MB → 4.3MB, -71%**).

- **무손실**: 아이콘·white-keying/합성 UI(누끼·크롭 대상) — 픽셀이 원본과 동일해 런타임 이미지 로직 보존
- **손실 q82~88**: 순수 표시용 배경·로고
- **프레임 4종**: 손실 q92 — 초록 슬롯 감지·투명화 결과가 무손실과 동일함을 검증 후 적용
- 파비콘(`favicon-32.png`/`favicon-180.png`)만 PNG 유지

---

## 명령어 (패키지 매니저: Bun)

```bash
bun install        # 의존성 설치
bun run dev        # 개발 서버 (vite dev, 콘솔 주소 참고 — localhost는 카메라 허용)
bun run build      # 프로덕션 빌드 (client + SSR)
bun run start      # serve.ts로 빌드 결과 서빙 (PORT 기본 3000)
bun run preview    # 빌드 결과 미리보기
bun run lint       # ESLint
bun run format     # Prettier
bunx tsc --noEmit  # 타입체크
```

---

## 배포 (Railway)

- `bun run build` → `dist/client`(정적) + `dist/server/server.js`(SSR 핸들러) 생성.
- `bun run start` → `serve.ts`(Bun.serve)가 정적 파일 우선 + SSR 폴백으로 서빙.
- GitHub `main` 푸시 시 Railway 자동 빌드 — `nixpacks.toml`(install/build) + `railway.json`(startCommand).
- 서버는 정적 파일 + SSR만 담당한다. 데이터베이스·환경변수 의존성 없음.

> `wrangler.jsonc`·`src/server.ts`는 원래 Cloudflare Workers용. 현재 배포엔 미사용이지만 남겨둠.
