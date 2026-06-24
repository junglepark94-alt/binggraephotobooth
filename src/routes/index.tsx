import { createFileRoute } from "@tanstack/react-router";
import {
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import mainBg from "@/assets/main_bg.png";
import windowImg from "@/assets/window_trim.png";
import icecreamLoading from "@/assets/icecream_loading.png";
import selectNote from "@/assets/select_note.png";
import editToolbar from "@/assets/edit_toolbar.png";
import resultActions from "@/assets/result_actions.png";
import backButton from "@/assets/back_button.png";
import fortuneButton from "@/assets/fortune_button.png";
import festivalBg from "@/assets/festival_bg.png";
import navBarEmpty from "@/assets/nav_bar_empty.png";
import navIconPhoto from "@/assets/nav_icon_photo.png";
import navIconClover from "@/assets/nav_icon_clover.png";
import navIconCandy from "@/assets/nav_icon_candy.png";
import navIconHeart from "@/assets/nav_icon_heart.png";
import {
  type FrameKey,
  type Slot,
  composeStrip,
  createFrameOverlay,
  detectGreenSlots,
  fallbackSlots,
  loadImage,
  sliceSlotOverlays,
} from "@/lib/photobooth";
import { type Inventory, type Step, EMPTY_INVENTORY } from "@/lib/game";
import { type Crop, useKeyedCrop, useNukki, useWhiteKeyed } from "@/lib/imageHooks";
import { FRAMES } from "@/data/frames";
import { FORTUNES } from "@/data/fortunes";
import {
  FestivalSelectBg,
  Hotspot,
  ImageButton,
  SelectButton,
  WindowDialog,
  WindowPanel,
} from "@/components/common";
import { MainScreen } from "@/screens/MainScreen";
import { EndScreen } from "@/screens/EndScreen";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "빙그레 네컷 — 인생네컷 포토부스" },
      {
        name: "description",
        content: "빙그레 프레임을 골라 브라우저에서 바로 네 컷을 찍어보세요.",
      },
    ],
  }),
});

function useFramePreviews() {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        (Object.keys(FRAMES) as FrameKey[]).map(async (k) => {
          const f = FRAMES[k];
          const frameImg = await loadImage(f.frame);
          const overlayImgs = await Promise.all(f.overlays.map((o) => loadImage(o)));
          const slotsDetected = detectGreenSlots(frameImg);
          const slots = slotsDetected.length === 4 ? slotsDetected : fallbackSlots(frameImg);

          const c = document.createElement("canvas");
          c.width = frameImg.naturalWidth;
          c.height = frameImg.naturalHeight;
          const ctx = c.getContext("2d")!;

          // 1) gray placeholder fills for each slot
          ctx.fillStyle = "#e5e7eb";
          for (const s of slots) ctx.fillRect(s.x, s.y, s.w, s.h);

          // 2) overlay sticker design clipped to each slot
          for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            const ov = overlayImgs[i] ?? overlayImgs[overlayImgs.length - 1];
            if (!ov) continue;
            ctx.save();
            ctx.beginPath();
            ctx.rect(s.x, s.y, s.w, s.h);
            ctx.clip();
            ctx.drawImage(ov, s.x, s.y, s.w, s.h);
            ctx.restore();
          }

          // 3) outer frame on top — 초록 플레이스홀더 + 바깥 흰 배경을 투명화한 레이어
          ctx.drawImage(createFrameOverlay(frameImg), 0, 0);

          return [k, c.toDataURL("image/png")] as const;
        }),
      );
      if (cancelled) return;
      setPreviews(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return previews;
}

// 첫 방문(캐시 없음) 시 화면 전환마다 이미지가 뒤늦게 뜨는 것을 막기 위해,
// 앱 진입 직후 모든 에셋을 백그라운드로 미리 받아 브라우저 캐시를 데운다.
// (메인 화면을 보는 몇 초 동안 받아두므로 사용자는 대기를 느끼지 않는다.)
function usePreloadAssets() {
  useEffect(() => {
    const mods = import.meta.glob("../assets/*.{png,jpg,jpeg}", {
      eager: true,
      query: "?url",
      import: "default",
    }) as Record<string, string>;
    const urls = Object.values(mods);
    const t = window.setTimeout(() => {
      for (const url of urls) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, []);
}

function App() {
  usePreloadAssets();
  const [step, setStep] = useState<Step>("main");
  const [frameKey, setFrameKey] = useState<FrameKey | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [inv, setInv] = useState<Inventory>(EMPTY_INVENTORY);
  const [mapIntroSeen, setMapIntroSeen] = useState(false);

  const restart = () => {
    setShots([]);
    setFrameKey(null);
    setInv(EMPTY_INVENTORY);
    setMapIntroSeen(false);
    setStep("main");
  };

  return (
    <div className="min-h-[100dvh] text-foreground">
      <div className="mx-auto w-full max-w-md px-0 pb-0 pt-0 md:max-w-3xl lg:max-w-6xl md:px-8 md:pb-10 md:pt-12">
        {step === "main" && <MainScreen onStart={() => setStep("letter")} />}
        {step === "letter" && (
          <LetterScreen onBack={() => setStep("main")} onNext={() => setStep("map")} />
        )}
        {step === "map" && (
          <FestivalMap
            inv={inv}
            setInv={setInv}
            onPhoto={() => setStep("select")}
            onDraw={() => setStep("draw")}
            onEnd={() => setStep("end")}
            introSeen={mapIntroSeen}
            onIntroSeen={() => setMapIntroSeen(true)}
          />
        )}
        {step === "select" && (
          <SelectScreen
            value={frameKey}
            onChange={setFrameKey}
            onBack={() => setStep("map")}
            onNext={() => frameKey && setStep("shoot")}
          />
        )}
        {step === "shoot" && frameKey && (
          <ShootScreen
            frameKey={frameKey}
            onBack={() => setStep("select")}
            onDone={(s) => {
              setShots(s);
              setInv((v) => ({ ...v, photo: true }));
              setStep("result");
            }}
          />
        )}
        {step === "result" && frameKey && (
          <ResultScreen
            frameKey={frameKey}
            shots={shots}
            onRetake={() => {
              setShots([]);
              setStep("shoot");
            }}
            onChangeFrame={() => {
              setShots([]);
              setStep("select");
            }}
            onBackToMap={() => setStep("map")}
          />
        )}
        {step === "draw" && (
          <DrawScreen onBack={() => setStep("map")} onEnd={() => setStep("end")} />
        )}
        {step === "end" && <EndScreen onRestart={restart} />}
      </div>
    </div>
  );
}

// 빙그레 축제로 이동 중 로딩 (스토리보드 B-SCREEN)
function FestivalLoading({ text }: { text: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
      <div className="text-6xl">🎪</div>
      <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="mt-4 font-hand text-lg text-muted-foreground">{text}</p>
    </div>
  );
}

// "From. 빙그레…" 편지 인트로 (스토리보드 A-SCREEN) → 짧은 로딩(B-SCREEN) → 프레임 선택
function LetterScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const icecream = useWhiteKeyed(icecreamLoading); // PNG 흰 배경 제거
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onNext, 1400);
    return () => clearTimeout(t);
  }, [leaving, onNext]);

  return (
    <div className="mx-auto flex min-h-[100dvh] md:min-h-[90vh] max-w-md flex-col">
      <div className="relative flex-1 overflow-hidden rounded-none md:rounded-3xl md:ring-1 md:ring-border">
        {/* 메인과 동일한 배경 */}
        <img src={mainBg} alt="" className="absolute inset-0 h-full w-full object-cover" />

        {leaving ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 text-center">
            <div className="flex flex-col items-center">
              <img
                src={icecream}
                alt=""
                draggable={false}
                className="icecream-bounce h-36 w-36 select-none object-contain"
              />
              <div className="icecream-shadow" />
            </div>
            <p className="mt-6 font-hand text-lg font-bold text-white drop-shadow">
              빙그레 축제로 이동 중…
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-4">
            {/* 편지 창 (window_trim.png) + 텍스트 오버레이 */}
            <div className="relative w-full max-w-[330px]">
              <img src={windowImg} alt="" draggable={false} className="w-full select-none" />
              {/* X 닫기 → 뒤로(메인) */}
              <button
                onClick={onBack}
                aria-label="닫기"
                className="absolute right-[4%] top-[1%] h-[9%] w-[13%]"
              />
              {/* From 헤더 (구분선 위) */}
              <span className="absolute left-[12%] top-[8.5%] font-hand text-lg font-bold text-primary">
                From. 빙그레…
              </span>
              {/* 본문 (구분선 아래) */}
              <div className="absolute inset-x-[12%] top-[25%] space-y-3 text-[15px] font-medium leading-relaxed text-foreground/90">
                <p>
                  2026년, 빙그레 왕국과 해태아이스 왕국이 만나 하나의 아이스크림 왕국이 되었습니다!
                </p>
                <p>
                  오늘부터 마을 광장에서 여름 축제가
                  <br />
                  시작됩니다.
                </p>
                <p>
                  축제 속 숨겨진 이벤트와 추억을
                  <br />
                  함께 남겨보세요. ✨
                </p>
              </div>
            </div>
            <ImageButton
              onClick={() => setLeaving(true)}
              label="축제 즐기러 가기"
              textClassName="text-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── 축제 맵 허브 (스토리보드 C-SCREEN) ─────────────────────────
// 장소(사진 부스·뽑기)와 친구들(강아지·왕자·주민)을 눌러 아이템을 모은다.
//   강아지 → 🍦아이스크림 → 왕자에게 → ❤️하트 / 사진 촬영 → 📷 → 주민에게 → 🍀클로버 → 뽑기 해금

// useKeyedCrop용 크롭 박스 + 셀 중심 좌표 (버튼 에셋 위 글자/아이콘 오버레이 위치).
// 1x3 툴바 바(되돌리기/스티커/브러시). 세 셀의 가로 중심은 크롭 박스 기준.
const TOOLBAR_CROP: Crop = { x0: 0.03, y0: 0.345, x1: 0.97, y1: 0.65 };
const TOOLBAR_CELL_CX = [0.165, 0.5, 0.834];

// 2x2 액션 그리드(다시찍기/프레임변경/저장/공유). 셀 중심은 크롭 박스 기준.
const RESULT_ACTIONS_CROP: Crop = { x0: 0.06, y0: 0.2, x1: 0.94, y1: 0.81 };
const RESULT_ACTIONS_CELLS = [
  { cx: 0.257, cy: 0.292 },
  { cx: 0.743, cy: 0.292 },
  { cx: 0.257, cy: 0.725 },
  { cx: 0.743, cy: 0.725 },
];

// 풀폭 버튼(축제로 돌아가기) — 단일 셀, 중앙 오버레이.
const BACK_BTN_CROP: Crop = { x0: 0.01, y0: 0.05, x1: 0.99, y1: 0.95 };

// 1x2 버튼 그리드(축제로 / 축제 마치기). 셀 중심은 크롭 박스 기준.
const FORTUNE_BTN_CROP: Crop = { x0: 0.05, y0: 0.42, x1: 0.95, y1: 0.76 };
const FORTUNE_BTN_CELLS = [
  { cx: 0.253, cy: 0.47 },
  { cx: 0.746, cy: 0.47 },
];

// 클로버=나뭇잎이라 아이콘은 총 4개. 빈 바(nav_bar_empty) 위 균등 4칸(dstCx)에 등장시킨다.
const NAV_ICONS: {
  key: keyof Inventory;
  label: string;
  src: string;
  dstCx: number;
  h: number;
}[] = [
  { key: "photo", label: "사진", src: navIconPhoto, dstCx: 0.2, h: 74 },
  { key: "clover", label: "클로버", src: navIconClover, dstCx: 0.4, h: 74 },
  { key: "candy", label: "아이스크림", src: navIconCandy, dstCx: 0.6, h: 74 },
  { key: "heart", label: "하트", src: navIconHeart, dstCx: 0.8, h: 64 },
];

function FestivalMap({
  inv,
  setInv,
  onPhoto,
  onDraw,
  onEnd,
  introSeen,
  onIntroSeen,
}: {
  inv: Inventory;
  setInv: Dispatch<SetStateAction<Inventory>>;
  onPhoto: () => void;
  onDraw: () => void;
  onEnd: () => void;
  introSeen: boolean;
  onIntroSeen: () => void;
}) {
  const [bubble, setBubble] = useState<{ who: string; text: string } | null>(null);
  const say = (who: string, text: string) => setBubble({ who, text });

  // 빈 바: 흰 배경 제거 + 위아래 투명 여백 트림(핑크 알약이 하단 라벨 바로 위에 붙도록).
  const [navBarSrc, setNavBarSrc] = useState<string>(navBarEmpty);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const id = ctx.getImageData(0, 0, W, H);
      const d = id.data;
      const isWhite = (x: number, y: number) => {
        const i = (y * W + x) * 4;
        return d[i + 3] > 200 && d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244;
      };
      if (isWhite(1, 1) && isWhite(W - 2, 1) && isWhite(1, H - 2) && isWhite(W - 2, H - 2)) {
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244) d[i + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
      }
      // 불투명 픽셀 bounding box로 여백 트림
      let minX = W,
        minY = H,
        maxX = -1,
        maxY = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] > 20) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < minX || maxY < minY) {
        setNavBarSrc(c.toDataURL());
        return;
      }
      const cw = maxX - minX + 1;
      const ch = maxY - minY + 1;
      const t = document.createElement("canvas");
      t.width = cw;
      t.height = ch;
      const tctx = t.getContext("2d");
      if (!tctx) {
        setNavBarSrc(c.toDataURL());
        return;
      }
      tctx.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
      setNavBarSrc(t.toDataURL());
    };
    img.src = navBarEmpty;
  }, []);
  // 아이콘 4종 — 흰 배경으로 온 에셋은 자동으로 흰색을 투명 처리한다.
  const navIconSrc: Record<keyof Inventory, string> = {
    photo: useWhiteKeyed(navIconPhoto),
    clover: useWhiteKeyed(navIconClover),
    candy: useWhiteKeyed(navIconCandy),
    heart: useWhiteKeyed(navIconHeart),
  };

  const tapDog = () => {
    if (!inv.candy) {
      setInv((v) => ({ ...v, candy: true }));
      say("강아지 🐶", "아이스크림을 멋진 주인님(왕자)에게 가져다줘! 🍦");
    } else say("강아지 🐶", "왕자님께 아이스크림을 전해줘!");
  };
  const tapPrince = () => {
    if (inv.candy && !inv.heart) {
      setInv((v) => ({ ...v, heart: true }));
      say("왕자 🤴", "고마워! 사진 찍고 오른쪽 뽑기 기계에서 행운의 아이스크림을 뽑아봐! ❤️");
    } else if (!inv.candy) say("왕자 🤴", "사진을 찍으면 전설의 뽑기 클로버를 준대~");
    else say("왕자 🤴", "사진 찍고 오른쪽 뽑기 기계에서 행운의 아이스크림을 뽑아봐!");
  };
  const tapResident = () => {
    if (inv.photo && !inv.clover) {
      setInv((v) => ({ ...v, clover: true }));
      say("주민 🧑", "이야~ 잘 나왔다! 행운의 클로버를 줄게 🍀");
    } else if (!inv.photo) say("주민 🧑", "아이스크림을 좋아해? 사진 부스에서 네컷을 찍어와 봐!");
    else say("주민 🧑", "그 클로버로 아이스크림을 뽑아봐!");
  };
  const tapDraw = () => {
    if (inv.clover) onDraw();
    else say("뽑기 기계 🎰", "전설의 클로버가 필요해! 사진을 찍어 주민에게 보여줘.");
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] md:min-h-[90vh] max-w-md flex-col">
      <div className="relative flex-1 overflow-hidden rounded-none md:rounded-3xl md:ring-1 md:ring-border">
        {/* 축제 배경 일러스트 */}
        <img
          src={festivalBg}
          alt="빙그레 왕국 여름 축제"
          className="absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
        />

        {/* 축제 마치기 (메뉴바는 진행표시 전용이라 별도 버튼) */}
        <button
          onClick={onEnd}
          className="absolute right-3 top-3 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-foreground shadow active:scale-95"
        >
          마치기
        </button>

        {/* 클릭 영역 (배경 위 투명 핫스팟) — 새 배경(festival_bg)에 맞춤 */}
        <Hotspot
          left="57%"
          top="52%"
          width="31%"
          height="26%"
          label="사진 부스"
          onClick={onPhoto}
          pulse
        />
        <Hotspot
          left="86%"
          top="34%"
          width="24%"
          height="32%"
          label="뽑기 기계"
          onClick={tapDraw}
          pulse={inv.clover}
        />
        <Hotspot
          left="30%"
          top="67%"
          width="22%"
          height="15%"
          label="왕자"
          onClick={tapPrince}
          pulse={inv.candy && !inv.heart}
        />
        <Hotspot
          left="16%"
          top="80%"
          width="26%"
          height="13%"
          label="강아지"
          onClick={tapDog}
          pulse={!inv.candy}
        />
        <Hotspot
          left="69%"
          top="84%"
          width="62%"
          height="18%"
          label="주민"
          onClick={tapResident}
          pulse={inv.photo && !inv.clover}
        />

        {/* 말풍선 */}
        {bubble && (
          <div className="festival-card absolute inset-x-3 top-[8%] z-20 p-3 text-[15px] leading-relaxed">
            <b className="text-primary">{bubble.who}</b>
            <span className="ml-1">{bubble.text}</span>
          </div>
        )}

        {/* 하단 메뉴바 — 원래 비율 유지. 아이콘은 크게(바 위로 살짝 솟음), 라벨은 바 안 하단 */}
        <div className="absolute inset-x-0 bottom-[3%] z-0 px-2">
          <div className="relative">
            <img src={navBarSrc} alt="" className="w-full select-none" draggable={false} />
            {NAV_ICONS.map((it) => (
              <div key={it.key}>
                {inv[it.key] && (
                  <img
                    src={navIconSrc[it.key]}
                    alt={it.label}
                    draggable={false}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 select-none"
                    style={{ left: `${it.dstCx * 100}%`, top: "44%", height: `${it.h}%` }}
                  />
                )}
                <span
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-extrabold"
                  style={{
                    left: `${it.dstCx * 100}%`,
                    top: "80%",
                    color: "#c44a78",
                    opacity: inv[it.key] ? 1 : 0.5,
                  }}
                >
                  {it.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 첫 방문 환영 안내 말풍선 — 아무 곳이나 터치하면 닫힘 */}
        {!introSeen && (
          <div
            role="button"
            tabIndex={0}
            onClick={onIntroSeen}
            aria-label="안내 닫기"
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 px-8"
          >
            <div className="festival-card relative max-w-[300px] p-5 text-center text-[16px] font-bold leading-relaxed text-foreground">
              빙그레 왕국 여름축제에 온 걸 환영해!
              <br />
              화면의{" "}
              <span className="mx-0.5 -mt-0.5 inline-grid h-5 w-5 place-items-center rounded-full bg-primary align-middle text-xs font-extrabold text-primary-foreground shadow">
                !
              </span>{" "}
              표시들을 하나씩 눌러봐.
              <span className="mt-2 block text-xs font-medium text-muted-foreground">
                터치하면 닫혀요
              </span>
              {/* 말풍선 꼬리 */}
              <span
                className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-card"
                style={{
                  borderRight: "2px solid color-mix(in oklch, var(--color-primary) 16%, white)",
                  borderBottom: "2px solid color-mix(in oklch, var(--color-primary) 16%, white)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 프레임 선택 (스토리보드) — 축제 배경 + 크림 카드 리스트 + 캔디 버튼 + 안내 노트
function SelectScreen({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: FrameKey | null;
  onChange: (k: FrameKey) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const previews = useFramePreviews();
  const keys = Object.keys(FRAMES) as FrameKey[];
  const noteSrc = useWhiteKeyed(selectNote);
  return (
    <FestivalSelectBg onBack={onBack}>
      {/* 카드 리스트 (긴 페이지 — 아래로 자연 스크롤) */}
      <div className="space-y-3 px-4 pt-1">
        {keys.map((k) => {
          const f = FRAMES[k];
          const active = value === k;
          return (
            <button
              key={k}
              onClick={() => onChange(k)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:scale-[0.99] ${
                active ? "border-primary" : "border-white/70"
              }`}
              style={{
                background: "linear-gradient(180deg,#fffaf0,#fcedcd)",
                boxShadow: "0 6px 14px -8px rgba(150,90,60,.45)",
              }}
            >
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg bg-white/70 p-1 ring-1 ring-amber-200">
                <img
                  src={previews[k] ?? f.frame}
                  alt={f.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="text-xl font-extrabold text-amber-900">{f.name}</div>
                <div className="mt-1 text-[13px] leading-snug text-amber-800/80">{f.subtitle}</div>
              </div>
              <div
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-primary bg-primary" : "border-amber-300 bg-white"
                }`}
              >
                {active && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 촬영 시작 버튼 */}
      <SelectButton onClick={onNext} disabled={!value} label="촬영 시작" className="mt-6" />

      {/* 하단 안내 노트 (빈 노트 + 글자 오버레이) */}
      <div className="relative mx-auto mb-7 mt-3 w-[92%] max-w-[360px]">
        <img src={noteSrc} alt="" draggable={false} className="w-full select-none" />
        <span className="absolute inset-0 flex items-center justify-center px-[13%] text-center text-[12px] font-medium leading-tight text-amber-900/80">
          촬영 및 업로드된 사진은 서버에 저장되지 않으며 사용자 기기에서만 사용됩니다.
        </span>
      </div>
    </FestivalSelectBg>
  );
}

function ShootScreen({
  frameKey,
  onBack,
  onDone,
}: {
  frameKey: FrameKey;
  onBack: () => void;
  onDone: (shots: string[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shots, setShots] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotOverlays, setSlotOverlays] = useState<string[]>([]);
  const f = FRAMES[frameKey];
  const photoIconSrc = useWhiteKeyed(navIconPhoto); // 카메라 아이콘(에셋)

  // 프레임/슬롯 준비 — 권한 불필요, 마운트 시 미리 계산.
  // 슬롯별 오버레이(컷마다 겹쳐 들어온 캐릭터/장식)도 프레임에서 잘라 미리 만든다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const frameImg = await loadImage(f.frame);
      if (cancelled) return;
      let detected = detectGreenSlots(frameImg);
      if (detected.length < 4) detected = fallbackSlots(frameImg);
      setSlots(detected);
      setSlotOverlays(sliceSlotOverlays(frameImg, detected));
    })();
    return () => {
      cancelled = true;
    };
  }, [f.frame]);

  // 카메라 요청 — 사용자가 "허용하고 시작"을 누른 뒤(started)에만 실행.
  // 사용자 제스처 이후 권한을 요청해야 브라우저 프롬프트가 안정적으로 뜬다.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        console.error(e);
        setError("카메라 접근이 허용되지 않았어요. 권한을 허용한 뒤 다시 시도해주세요.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [started, attempt]);

  const retry = () => {
    setError(null);
    setReady(false);
    setAttempt((a) => a + 1);
  };

  const capture = (): string => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return "";
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // mirror so the captured photo matches the selfie preview
    ctx.save();
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.restore();
    return c.toDataURL("image/jpeg", 0.92);
  };

  const runCountdown = async () => {
    for (let n = 3; n >= 1; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 800));
    }
    setCountdown(null);
  };

  const startShooting = async () => {
    if (busy || !ready) return;
    setBusy(true);
    const collected: string[] = [];
    for (let i = 0; i < 4; i++) {
      setShots([...collected]);
      await runCountdown();
      const shot = capture();
      collected.push(shot);
      setShots([...collected]);
      await new Promise((r) => setTimeout(r, 500));
    }
    setBusy(false);
    onDone(collected);
  };

  // 카메라 권한 안내 화면 (스토리보드 E-SCREEN) — 촬영 전 권한 요청 가이드.
  if (!started) {
    return (
      <FestivalSelectBg onBack={onBack}>
        <div className="px-3 pb-6 pt-1">
          <WindowDialog onClose={onBack}>
            <div className="text-center">
              <img
                src={photoIconSrc}
                alt=""
                draggable={false}
                className="mx-auto h-16 w-16 select-none object-contain"
              />
              <h3 className="mt-1 text-xl font-extrabold text-primary">카메라 준비</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                네컷 촬영을 위해 카메라 접근 권한이 필요해요. 아래 버튼을 누르고 브라우저에서
                “허용”을 선택해주세요.
              </p>
              <SelectButton
                onClick={() => setStarted(true)}
                label="허용하고 시작하기"
                className="mt-4"
              />
              <p className="mt-2 text-[11px] text-foreground/60">
                사진은 기기에서만 처리되며 서버에 저장되지 않습니다.
              </p>
            </div>
          </WindowDialog>
        </div>
      </FestivalSelectBg>
    );
  }

  if (error) {
    return (
      <FestivalSelectBg onBack={onBack}>
        <div className="px-3 pb-6 pt-1">
          <WindowDialog onClose={onBack}>
            <div className="text-center">
              <div className="text-5xl">😢</div>
              <h3 className="mt-1 text-xl font-extrabold text-primary">카메라를 못 켰어요</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{error}</p>
              <SelectButton onClick={retry} label="다시 시도" className="mt-4" />
              <p className="mt-2 text-[11px] leading-snug text-foreground/60">
                계속 안 되면 주소창의 카메라 아이콘에서 권한을 “허용”으로 바꿔주세요.
              </p>
            </div>
          </WindowDialog>
        </div>
      </FestivalSelectBg>
    );
  }

  const activeIndex = busy ? Math.min(shots.length, 3) : shots.length < 4 ? shots.length : -1;
  const displayIndex = activeIndex >= 0 ? activeIndex : Math.min(shots.length, slots.length - 1);
  const activeSlot = slots[displayIndex];
  const aspect = activeSlot ? `${activeSlot.w} / ${activeSlot.h}` : "3 / 4";

  return (
    <FestivalSelectBg onBack={onBack}>
      <div className="px-3 pb-6 pt-1">
        <h2 className="mb-2 text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          {Math.min(shots.length + 1, 4)} / 4 컷
        </h2>
        <WindowPanel onClose={onBack}>
          {/* 카메라 미리보기 */}
          <div
            className="relative mx-auto overflow-hidden rounded-2xl ring-1 ring-border"
            style={{ aspectRatio: aspect, background: "#fdf9ee", maxWidth: 280 }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: "scaleX(-1)", zIndex: 0 }}
            />
            {slotOverlays[displayIndex] && (
              <img
                src={slotOverlays[displayIndex]}
                alt=""
                className="pointer-events-none absolute inset-0"
                style={{ width: "100%", height: "100%", zIndex: 1 }}
              />
            )}
            {!ready && (
              <div
                className="absolute inset-0 grid place-items-center bg-black/20"
                style={{ zIndex: 2 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  <p className="text-sm font-bold text-white drop-shadow">카메라 불러오는 중…</p>
                </div>
              </div>
            )}
            {countdown !== null && (
              <div
                className="absolute inset-0 grid place-items-center bg-black/30"
                style={{ zIndex: 3 }}
              >
                <div className="text-8xl font-extrabold text-white drop-shadow-lg">{countdown}</div>
              </div>
            )}
            <div
              className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ zIndex: 3 }}
            >
              {f.name} · {Math.min(shots.length + 1, 4)}/4
            </div>
          </div>

          {/* 4컷 썸네일 */}
          <div className="mx-auto mt-3 grid max-w-[280px] grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-lg bg-white/70 ring-1 ring-amber-200"
              >
                {shots[i] && (
                  <>
                    <img src={shots[i]} alt="" className="h-full w-full object-cover" />
                    {slotOverlays[i] && (
                      <img
                        src={slotOverlays[i]}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <SelectButton
            onClick={startShooting}
            disabled={!ready || busy}
            label={busy ? "촬영 중…" : ready ? "4컷 촬영하기" : "불러오는 중…"}
            className="mt-4"
          />
        </WindowPanel>
      </div>
    </FestivalSelectBg>
  );
}

// ───────────────────────── 사진 꾸미기 에디터 ─────────────────────────
// 스토리보드 F/G 화면: 합성된 네컷 위에 스티커(이모지)·브러시 그리기.
// 좌표·크기는 모두 이미지 대비 비율(0~1)로 저장 → 화면 표시와 PNG 내보내기가 정확히 일치.

const STICKERS = ["❤️", "⭐", "🎀", "👑", "🌸", "🍦", "🫧", "🐰", "🍓", "✨", "🎈", "🧁"];
const BRUSH_COLORS = [
  "#ff5d8f",
  "#ff8fab",
  "#ffd166",
  "#06d6a0",
  "#7bdff2",
  "#9b5de5",
  "#ffffff",
  "#3a3a3a",
];
const BRUSH_SIZES = [0.006, 0.013, 0.024]; // 선 굵기 (이미지 너비 대비 비율)
const DEFAULT_STICKER_SIZE = 0.16;

type Pt = { fx: number; fy: number };
type Stroke = { color: string; widthFrac: number; points: Pt[]; order: number };
type StickerItem = {
  id: string;
  char: string;
  fx: number;
  fy: number;
  sizeFrac: number;
  order: number;
};
type EditorTool = "none" | "sticker" | "brush";
export type EditorHandle = { exportPng: () => string };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const PhotoEditor = forwardRef<EditorHandle, { src: string; width: number; height: number }>(
  function PhotoEditor({ src, width, height }, ref) {
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const baseImgRef = useRef<HTMLImageElement | null>(null);
    const drawingRef = useRef<{ points: Pt[] } | null>(null);
    const dragIdRef = useRef<string | null>(null);
    const orderRef = useRef(0);
    const nextOrder = () => ++orderRef.current;

    const [tool, setTool] = useState<EditorTool>("none");
    const [stickers, setStickers] = useState<StickerItem[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [color, setColor] = useState(BRUSH_COLORS[0]);
    const [sizeIdx, setSizeIdx] = useState(1);
    const toolbarBar = useKeyedCrop(editToolbar, TOOLBAR_CROP);

    useEffect(() => {
      let cancelled = false;
      loadImage(src).then((img) => {
        if (!cancelled) baseImgRef.current = img;
      });
      return () => {
        cancelled = true;
      };
    }, [src]);

    const drawStroke = (ctx: CanvasRenderingContext2D, st: Stroke) => {
      if (!st.points.length) return;
      if (st.points.length === 1) {
        const p = st.points[0];
        ctx.fillStyle = st.color;
        ctx.beginPath();
        ctx.arc(p.fx * width, p.fy * height, (st.widthFrac * width) / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.widthFrac * width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(st.points[0].fx * width, st.points[0].fy * height);
      for (let i = 1; i < st.points.length; i++)
        ctx.lineTo(st.points[i].fx * width, st.points[i].fy * height);
      ctx.stroke();
    };

    // strokes 변경 시 전체 다시 그리기 (되돌리기 반영)
    useEffect(() => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const st of strokes) drawStroke(ctx, st);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strokes, width, height]);

    useImperativeHandle(
      ref,
      () => ({
        exportPng: () => {
          const out = document.createElement("canvas");
          out.width = width;
          out.height = height;
          const ctx = out.getContext("2d")!;
          if (baseImgRef.current) ctx.drawImage(baseImgRef.current, 0, 0, width, height);
          for (const st of strokes) drawStroke(ctx, st);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (const s of stickers) {
            const fs = s.sizeFrac * width;
            ctx.font = `${fs}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
            ctx.fillText(s.char, s.fx * width, s.fy * height);
          }
          return out.toDataURL("image/png");
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [strokes, stickers, width, height],
    );

    // ── 브러시 ──
    const ptFrom = (e: ReactPointerEvent): Pt => {
      const r = canvasRef.current!.getBoundingClientRect();
      return {
        fx: clamp01((e.clientX - r.left) / r.width),
        fy: clamp01((e.clientY - r.top) / r.height),
      };
    };
    const brushDown = (e: ReactPointerEvent) => {
      if (tool !== "brush") return;
      e.preventDefault();
      canvasRef.current!.setPointerCapture(e.pointerId);
      const p = ptFrom(e);
      drawingRef.current = { points: [p] };
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.fx * width, p.fy * height, (BRUSH_SIZES[sizeIdx] * width) / 2, 0, Math.PI * 2);
      ctx.fill();
    };
    const brushMove = (e: ReactPointerEvent) => {
      if (!drawingRef.current) return;
      const pts = drawingRef.current.points;
      const p = ptFrom(e);
      const a = pts[pts.length - 1];
      pts.push(p);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.strokeStyle = color;
      ctx.lineWidth = BRUSH_SIZES[sizeIdx] * width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.fx * width, a.fy * height);
      ctx.lineTo(p.fx * width, p.fy * height);
      ctx.stroke();
    };
    const brushUp = () => {
      if (!drawingRef.current) return;
      const stroke: Stroke = {
        color,
        widthFrac: BRUSH_SIZES[sizeIdx],
        points: drawingRef.current.points,
        order: nextOrder(),
      };
      drawingRef.current = null;
      setStrokes((a) => [...a, stroke]);
    };

    // ── 스티커 ──
    const addSticker = (char: string) => {
      const order = nextOrder();
      const id = `s${order}`;
      setStickers((a) => [
        ...a,
        { id, char, fx: 0.5, fy: 0.5, sizeFrac: DEFAULT_STICKER_SIZE, order },
      ]);
      setSelectedId(id);
    };
    const removeSticker = (id: string) => {
      setStickers((a) => a.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    };
    const resizeSticker = (d: number) => {
      setStickers((a) =>
        a.map((s) =>
          s.id === selectedId
            ? { ...s, sizeFrac: Math.max(0.05, Math.min(0.5, s.sizeFrac + d)) }
            : s,
        ),
      );
    };
    const stickerDown = (e: ReactPointerEvent, s: StickerItem) => {
      if (tool === "brush") return;
      e.stopPropagation();
      setSelectedId(s.id);
      dragIdRef.current = s.id;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const stickerMove = (e: ReactPointerEvent, s: StickerItem) => {
      if (dragIdRef.current !== s.id) return;
      const r = stageRef.current!.getBoundingClientRect();
      const fx = clamp01((e.clientX - r.left) / r.width);
      const fy = clamp01((e.clientY - r.top) / r.height);
      setStickers((arr) => arr.map((x) => (x.id === s.id ? { ...x, fx, fy } : x)));
    };
    const stickerUp = () => {
      dragIdRef.current = null;
    };

    // ── 되돌리기 (가장 최근에 추가된 스티커/획 제거) ──
    const undo = () => {
      const maxSticker = stickers.reduce((m, s) => Math.max(m, s.order), -1);
      const maxStroke = strokes.reduce((m, s) => Math.max(m, s.order), -1);
      if (maxSticker < 0 && maxStroke < 0) return;
      if (maxSticker > maxStroke) {
        setStickers((a) => a.filter((s) => s.order !== maxSticker));
        if (selectedId && stickers.find((s) => s.order === maxSticker)?.id === selectedId)
          setSelectedId(null);
      } else {
        setStrokes((a) => a.filter((s) => s.order !== maxStroke));
      }
    };

    const hasEdits = stickers.length > 0 || strokes.length > 0;

    return (
      <div>
        <div
          ref={stageRef}
          onPointerDown={(e) => {
            if (tool !== "brush" && e.target === e.currentTarget) setSelectedId(null);
          }}
          className="relative mx-auto overflow-hidden rounded-2xl ring-1 ring-border"
          style={{
            aspectRatio: `${width} / ${height}`,
            containerType: "inline-size",
            background: "#fdf9ee",
          }}
        >
          <img
            src={src}
            alt="나의 네컷 결과"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
            style={{ zIndex: 0 }}
          />
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="absolute inset-0 h-full w-full"
            style={{
              zIndex: 1,
              pointerEvents: tool === "brush" ? "auto" : "none",
              touchAction: "none",
            }}
            onPointerDown={brushDown}
            onPointerMove={brushMove}
            onPointerUp={brushUp}
            onPointerCancel={brushUp}
          />
          {stickers.map((s) => (
            <div
              key={s.id}
              onPointerDown={(e) => stickerDown(e, s)}
              onPointerMove={(e) => stickerMove(e, s)}
              onPointerUp={stickerUp}
              onPointerCancel={stickerUp}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move select-none leading-none ${selectedId === s.id ? "rounded-md outline outline-2 outline-primary" : ""}`}
              style={{
                left: `${s.fx * 100}%`,
                top: `${s.fy * 100}%`,
                fontSize: `${s.sizeFrac * 100}cqw`,
                touchAction: "none",
                pointerEvents: tool === "brush" ? "none" : "auto",
                zIndex: selectedId === s.id ? 3 : 2,
              }}
            >
              {s.char}
              {selectedId === s.id && (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    removeSticker(s.id);
                  }}
                  aria-label="스티커 삭제"
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive font-bold text-white shadow"
                  style={{ fontSize: 11, lineHeight: 1 }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 툴 토글 — edit_toolbar 에셋(1x3 크림 바) 위에 셀별로 아이콘+글자 오버레이 */}
        <div className="relative mt-3 w-full select-none">
          <img src={toolbarBar} alt="" draggable={false} className="w-full select-none" />
          {[
            {
              icon: "↩️",
              label: "되돌리기",
              active: false,
              disabled: !hasEdits,
              onClick: undo,
            },
            {
              icon: "✨",
              label: "스티커",
              active: tool === "sticker",
              disabled: false,
              onClick: () => setTool((t) => (t === "sticker" ? "none" : "sticker")),
            },
            {
              icon: "✏️",
              label: "브러시",
              active: tool === "brush",
              disabled: false,
              onClick: () => {
                setTool((t) => (t === "brush" ? "none" : "brush"));
                setSelectedId(null);
              },
            },
          ].map((b, i) => (
            <button
              key={b.label}
              onClick={b.onClick}
              disabled={b.disabled}
              aria-label={b.label}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-2xl font-display font-extrabold leading-none transition active:scale-95 disabled:opacity-40 ${
                b.active ? "text-primary" : "text-[#9c5a3c]"
              }`}
              style={{
                left: `${TOOLBAR_CELL_CX[i] * 100}%`,
                top: "50%",
                width: "26%",
                height: "82%",
                fontSize: "clamp(11px, 3.2vw, 15px)",
                ...(b.active ? { filter: "drop-shadow(0 0 6px rgba(196,74,120,0.55))" } : null),
              }}
            >
              <span style={{ fontSize: "1.5em" }}>{b.icon}</span>
              {b.label}
            </button>
          ))}
        </div>

        {tool === "sticker" && (
          <div className="festival-card mt-3 p-3">
            <p className="mb-2 text-center text-sm text-muted-foreground">
              스티커를 탭해 추가하고, 드래그로 옮겨보세요.
            </p>
            <div className="grid grid-cols-6 gap-2">
              {STICKERS.map((ch) => (
                <button
                  key={ch}
                  onClick={() => addSticker(ch)}
                  className="grid aspect-square place-items-center rounded-xl bg-secondary/50 text-2xl ring-1 ring-border transition active:scale-90"
                >
                  {ch}
                </button>
              ))}
            </div>
            {selectedId && (
              <div className="mt-3 flex items-center justify-center gap-2 text-sm font-bold">
                <span className="text-muted-foreground">선택한 스티커</span>
                <button
                  onClick={() => resizeSticker(-0.03)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground"
                >
                  −
                </button>
                <button
                  onClick={() => resizeSticker(0.03)}
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground"
                >
                  ＋
                </button>
                <button
                  onClick={() => selectedId && removeSticker(selectedId)}
                  className="rounded-full bg-destructive/10 px-3 py-1.5 text-destructive"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        )}

        {tool === "brush" && (
          <div className="festival-card mt-3 p-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {BRUSH_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`색상 ${c}`}
                  className={`h-7 w-7 rounded-full ring-2 transition ${color === c ? "scale-110 ring-primary" : "ring-border"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="text-sm font-bold text-muted-foreground">굵기</span>
              {BRUSH_SIZES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSizeIdx(i)}
                  className={`grid h-9 w-9 place-items-center rounded-full transition ${sizeIdx === i ? "bg-primary" : "bg-secondary"}`}
                >
                  <span
                    className="rounded-full"
                    style={{
                      width: `${6 + i * 5}px`,
                      height: `${6 + i * 5}px`,
                      background:
                        sizeIdx === i
                          ? "var(--color-primary-foreground)"
                          : "var(--color-muted-foreground)",
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

function ResultScreen({
  frameKey,
  shots,
  onRetake,
  onChangeFrame,
  onBackToMap,
}: {
  frameKey: FrameKey;
  shots: string[];
  onRetake: () => void;
  onChangeFrame: () => void;
  onBackToMap: () => void;
}) {
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [stripSize, setStripSize] = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus] = useState("네컷을 합성하는 중…");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const f = FRAMES[frameKey];
  const noteSrc = useWhiteKeyed(selectNote);
  const actionsBar = useKeyedCrop(resultActions, RESULT_ACTIONS_CROP);
  const backBar = useKeyedCrop(backButton, BACK_BTN_CROP);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  // 편집 결과(스티커·브러시 포함)를 PNG로. 에디터 준비 전이면 원본 스트립 사용.
  const exportImage = () => editorRef.current?.exportPng() ?? stripUrl;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const frameImg = await loadImage(f.frame);
        const overlayImgs = await Promise.all(f.overlays.map((o) => loadImage(o)));
        const photoImgs = await Promise.all(shots.map((s) => loadImage(s)));
        if (cancelled) return;
        const detected: Slot[] = detectGreenSlots(frameImg);
        let usedSlots = detected;
        if (detected.length < 4) {
          console.warn("green slot detection failed, using fallback layout", detected);
          usedSlots = fallbackSlots(frameImg);
          setError(
            `플레이스홀더 슬롯이 ${detected.length}/4 개만 감지되어 기본 레이아웃을 사용합니다.`,
          );
        }
        const url = await composeStrip({
          frame: frameImg,
          overlays: overlayImgs,
          slots: usedSlots,
          photos: photoImgs,
        });
        if (cancelled) return;
        setStripUrl(url);
        setStripSize({ w: frameImg.naturalWidth, h: frameImg.naturalHeight });
        setStatus("");
      } catch (e) {
        console.error(e);
        setStatus("");
        setError(`오류가 발생했습니다: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [frameKey, shots, f.frame, f.overlay]);

  const save = () => {
    const url = exportImage();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `binggrae-fourcut-${frameKey}.png`;
    a.click();
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 5000);
  };

  const share = async () => {
    const url = exportImage();
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `binggrae-fourcut-${frameKey}.png`, { type: "image/png" });
      const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "나의 빙그레 네컷" });
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setShareMsg("이 기기에서는 공유를 지원하지 않습니다. 저장을 이용해주세요.");
  };

  return (
    <FestivalSelectBg onBack={onChangeFrame}>
      <div className="space-y-3 px-4 pt-1">
        <h2 className="text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          나의 네컷 꾸미기
        </h2>
        {error && (
          <div className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive ring-1 ring-destructive/30">
            {error}
          </div>
        )}
        {stripUrl && stripSize ? (
          <PhotoEditor ref={editorRef} src={stripUrl} width={stripSize.w} height={stripSize.h} />
        ) : (
          <div className="festival-card grid place-items-center p-4" style={{ minHeight: 400 }}>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>
          </div>
        )}
        {saved && (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-center text-sm font-bold text-primary ring-1 ring-white">
            <span className="text-lg">🎉</span>
            사진이 저장되었습니다! 갤러리(다운로드)를 확인해보세요.
          </div>
        )}
        {shareMsg && (
          <p className="rounded-xl bg-white/70 px-3 py-2 text-center text-xs text-foreground/70">
            {shareMsg}
          </p>
        )}
        {/* 액션 4버튼 — result_actions(2x2 크림 그리드) 위에 셀별 오버레이 */}
        <div className="relative w-full select-none">
          <img src={actionsBar} alt="" draggable={false} className="w-full select-none" />
          {[
            { label: "다시 찍기", disabled: false, onClick: onRetake },
            { label: "프레임 변경", disabled: false, onClick: onChangeFrame },
            { label: "💾 저장", disabled: !stripUrl, onClick: save },
            { label: "🔗 공유", disabled: !stripUrl, onClick: share },
          ].map((b, i) => (
            <button
              key={b.label}
              onClick={b.onClick}
              disabled={b.disabled}
              aria-label={b.label}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl text-center font-display font-extrabold leading-tight text-[#9c5a3c] transition active:scale-95 disabled:opacity-40"
              style={{
                left: `${RESULT_ACTIONS_CELLS[i].cx * 100}%`,
                top: `${RESULT_ACTIONS_CELLS[i].cy * 100}%`,
                width: "42%",
                height: "34%",
                fontSize: "clamp(12px, 3.6vw, 15px)",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* 축제로 돌아가기 — back_button(풀폭 크림 버튼) 위 중앙 오버레이 */}
        <div className="relative w-full select-none">
          <img src={backBar} alt="" draggable={false} className="w-full select-none" />
          <button
            onClick={onBackToMap}
            aria-label="축제로 돌아가기"
            className="absolute inset-0 flex items-center justify-center rounded-2xl text-center font-display font-extrabold text-[#9c5a3c] transition active:scale-95"
            style={{ fontSize: "clamp(15px, 4.5vw, 19px)" }}
          >
            🎪 축제로 돌아가기
          </button>
        </div>

        {/* 하단 안내 노트 (select_note + 글자 오버레이) */}
        <div className="relative mx-auto mb-7 mt-1 w-[92%] max-w-[360px]">
          <img src={noteSrc} alt="" draggable={false} className="w-full select-none" />
          <span className="absolute inset-0 flex items-center justify-center px-[13%] text-center text-[12px] font-medium leading-tight text-amber-900/80">
            촬영 및 업로드된 사진은 서버에 저장되지 않으며 사용자 기기에서만 사용됩니다.
          </span>
        </div>
      </div>
    </FestivalSelectBg>
  );
}

// ───────────────────────── 아이스크림 뽑기 (스토리보드 J-SCREEN) ─────────────────────────
// 스크래치 복권을 긁으면 오늘의 아이스크림 운세(10종)가 공개된다.

function DrawScreen({ onBack, onEnd }: { onBack: () => void; onEnd: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchingRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const fortune = useMemo(() => FORTUNES[Math.floor(Math.random() * FORTUNES.length)], []);
  const noteSrc = useWhiteKeyed(selectNote);
  const fortuneBar = useKeyedCrop(fortuneButton, FORTUNE_BTN_CROP);
  const fortuneImg = useNukki(fortune.img);

  const W = 600;
  const H = 360;

  // 스크래치 표면 그리기 (마운트 시)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#ff9ec4");
    g.addColorStop(0.5, "#cdb4f6");
    g.addColorStop(1, "#9bd9e8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.5 + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 40px Jua, system-ui, sans-serif";
    ctx.fillText("긁어보세요!", W / 2, H / 2 - 16);
    ctx.font = "bold 21px Jua, system-ui, sans-serif";
    ctx.fillText("전설의 클로버로 오늘의 운세 확인 ✨", W / 2, H / 2 + 28);
  }, []);

  const scratchAt = (e: ReactPointerEvent) => {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const ctx = cv.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  };

  // 50% 이상 긁으면 전체 공개
  const checkRevealed = () => {
    const cv = canvasRef.current!;
    const { data } = cv.getContext("2d")!.getImageData(0, 0, W, H);
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 16) {
      total++;
      if (data[i] < 128) cleared++;
    }
    if (cleared / total > 0.5) setRevealed(true);
  };

  const onDown = (e: ReactPointerEvent) => {
    if (revealed) return;
    scratchingRef.current = true;
    canvasRef.current!.setPointerCapture(e.pointerId);
    scratchAt(e);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!scratchingRef.current) return;
    scratchAt(e);
  };
  const onUp = () => {
    if (!scratchingRef.current) return;
    scratchingRef.current = false;
    checkRevealed();
  };

  return (
    <FestivalSelectBg onBack={onBack}>
      <div className="space-y-3 px-3 pb-6 pt-1">
        <h2 className="text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          아이스크림 뽑기
        </h2>
        <WindowPanel onClose={onBack}>
          <p className="mb-2 text-center text-sm text-muted-foreground">
            전설의 클로버로 오늘의 아이스크림 운세를 뽑아보세요!
          </p>
          <div
            className="relative mx-auto overflow-hidden rounded-2xl ring-1 ring-border"
            style={{ aspectRatio: `${W} / ${H}`, maxWidth: 300 }}
          >
            {/* 공개될 운세 (스크래치 아래) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
              <div className="flex h-[42%] w-full items-center justify-center">
                <img
                  src={fortuneImg}
                  alt={fortune.name}
                  draggable={false}
                  className="max-h-full max-w-[70%] select-none object-contain drop-shadow-sm"
                />
              </div>
              <div className="mt-1 text-2xl font-bold text-primary">{fortune.name}</div>
              <div className="text-xs font-bold text-muted-foreground">
                행운지수 {fortune.luck}%
              </div>
              <div className="mt-1 h-2.5 w-44 overflow-hidden rounded-full bg-secondary/50 ring-1 ring-border">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${fortune.luck}%` }}
                />
              </div>
            </div>
            {/* 스크래치 표면 */}
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${revealed ? "pointer-events-none opacity-0" : "cursor-pointer opacity-100"}`}
              style={{ touchAction: "none" }}
            />
          </div>
        </WindowPanel>

        {/* 운세 결과 메시지 — select_note 위 글자 오버레이 */}
        {revealed && (
          <div className="relative mx-auto w-[96%] max-w-[360px]">
            <img src={noteSrc} alt="" draggable={false} className="w-full select-none" />
            <span className="absolute inset-0 flex items-center justify-center px-[13%] text-center font-medium leading-snug text-amber-900/85">
              <span style={{ fontSize: "clamp(12px, 3.3vw, 15px)" }}>{fortune.message}</span>
            </span>
          </div>
        )}

        {/* 축제로 / 축제 마치기 — fortune_button(1x2 그리드) 위 오버레이 */}
        <div className="relative w-full select-none">
          <img src={fortuneBar} alt="" draggable={false} className="w-full select-none" />
          {[
            { label: "← 축제로", onClick: onBack },
            { label: "🌅 축제 마치기", onClick: onEnd },
          ].map((b, i) => (
            <button
              key={b.label}
              onClick={b.onClick}
              aria-label={b.label}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl text-center font-display font-extrabold leading-tight text-[#9c5a3c] transition active:scale-95"
              style={{
                left: `${FORTUNE_BTN_CELLS[i].cx * 100}%`,
                top: `${FORTUNE_BTN_CELLS[i].cy * 100}%`,
                width: "40%",
                height: "60%",
                fontSize: "clamp(13px, 3.6vw, 16px)",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </FestivalSelectBg>
  );
}

