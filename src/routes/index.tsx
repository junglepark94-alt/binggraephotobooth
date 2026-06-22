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
import frameWhite from "@/assets/frame_white.png";
import frameBrown from "@/assets/frame_brown.png";
import frameSkyblue from "@/assets/frame_skyblue.png";
import frameBinggraeus from "@/assets/frame_binggraeus.png";
import overlayWhite from "@/assets/overlay_white.png";
import overlayBrown from "@/assets/overlay_brown.png";
import overlaySkyblue from "@/assets/overlay_skyblue.png";
import overlayBinggraeus from "@/assets/overlay_binggraeus.png";
import overlayBinggraeusSlot1 from "@/assets/overlay_binggraeus_slot1.png";
import overlayBinggraeusSlot2 from "@/assets/overlay_binggraeus_slot2.png";
import overlayBinggraeusSlot3 from "@/assets/overlay_binggraeus_slot3.png";
import overlayBinggraeusSlot4 from "@/assets/overlay_binggraeus_slot4.png";
import mainBg from "@/assets/main_bg.png";
import logo from "@/assets/logo_trim.png";
import btnImg from "@/assets/button_trim.png";
import windowImg from "@/assets/window_trim.png";
import icecreamLoading from "@/assets/icecream_loading.png";
import selectBg from "@/assets/select_bg.png";
import selectButton from "@/assets/select_button.png";
import selectNote from "@/assets/select_note.png";
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
  detectGreenSlots,
  fallbackSlots,
  loadImage,
} from "@/lib/photobooth";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "빙그레 네컷 — 인생네컷 포토부스" },
      { name: "description", content: "빙그레 프레임을 골라 브라우저에서 바로 네 컷을 찍어보세요." },
    ],
  }),
});

const FRAMES: Record<FrameKey, { name: string; subtitle: string; frame: string; overlay: string; overlays: string[]; tint: string }> = {
  white: { name: "White", subtitle: "두 왕국이 함께 나누게 된 부드럽고 포근한 아이스크림 프레임", frame: frameWhite, overlay: overlayWhite, overlays: [overlayWhite, overlayWhite, overlayWhite, overlayWhite], tint: "from-slate-100 to-white" },
  brown: { name: "Brown", subtitle: "두 왕국을 가로질러 모인 클래식한 디저트와 진하고 따뜻한 과자의 풍미를 담은 프레임", frame: frameBrown, overlay: overlayBrown, overlays: [overlayBrown, overlayBrown, overlayBrown, overlayBrown], tint: "from-amber-200 to-stone-300" },
  skyblue: { name: "Skyblue", subtitle: "더 넓어진 왕국에서 함께 즐기는 시원한 아이스크림의 산뜻함이 묻어나는 프레임", frame: frameSkyblue, overlay: overlaySkyblue, overlays: [overlaySkyblue, overlaySkyblue, overlaySkyblue, overlaySkyblue], tint: "from-sky-200 to-blue-100" },
  binggraeus: { name: "Binggraeus", subtitle: "아이스크림 왕국, 두 왕국의 특별한 만남을 기념하는 왕실 프레임", frame: frameBinggraeus, overlay: overlayBinggraeus, overlays: [overlayBinggraeusSlot1, overlayBinggraeusSlot2, overlayBinggraeusSlot3, overlayBinggraeusSlot4], tint: "from-rose-300 to-amber-200" },
};

type Step = "main" | "letter" | "map" | "select" | "shoot" | "result" | "draw" | "end";

type Inventory = { photo: boolean; candy: boolean; heart: boolean; clover: boolean };
const EMPTY_INVENTORY: Inventory = { photo: false, candy: false, heart: false, clover: false };

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

          // 3) outer frame on top, with green placeholder areas knocked out to transparent
          const fc = document.createElement("canvas");
          fc.width = frameImg.naturalWidth;
          fc.height = frameImg.naturalHeight;
          const fctx = fc.getContext("2d")!;
          fctx.drawImage(frameImg, 0, 0);
          const fid = fctx.getImageData(0, 0, fc.width, fc.height);
          const fd = fid.data;
          for (let i = 0; i < fd.length; i += 4) {
            const r = fd[i], g = fd[i + 1], b = fd[i + 2], a = fd[i + 3];
            if (a > 128 && g > 180 && r < 120 && b < 120 && g > r + 80 && g > b + 80) {
              fd[i + 3] = 0;
            }
          }
          fctx.putImageData(fid, 0, 0);
          ctx.drawImage(fc, 0, 0);

          return [k, c.toDataURL("image/png")] as const;
        }),
      );
      if (cancelled) return;
      setPreviews(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, []);
  return previews;
}

function App() {
  const [step, setStep] = useState<Step>("main");
  const [frameKey, setFrameKey] = useState<FrameKey | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [inv, setInv] = useState<Inventory>(EMPTY_INVENTORY);

  const restart = () => {
    setShots([]);
    setFrameKey(null);
    setInv(EMPTY_INVENTORY);
    setStep("main");
  };

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-8 md:max-w-3xl lg:max-w-6xl md:px-8 md:pt-12">
        {step !== "main" &&
          step !== "letter" &&
          step !== "map" &&
          step !== "select" &&
          step !== "shoot" && <FestivalHeader />}
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
            onDone={(s) => { setShots(s); setInv((v) => ({ ...v, photo: true })); setStep("result"); }}
          />
        )}
        {step === "result" && frameKey && (
          <ResultScreen
            frameKey={frameKey}
            shots={shots}
            onRetake={() => { setShots([]); setStep("shoot"); }}
            onChangeFrame={() => { setShots([]); setStep("select"); }}
            onBackToMap={() => setStep("map")}
          />
        )}
        {step === "draw" && (
          <DrawScreen onBack={() => setStep("map")} onEnd={() => setStep("end")} />
        )}
        {step === "end" && (
          <EndScreen onRestart={restart} />
        )}
      </div>
    </div>
  );
}

function FestivalHeader() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <div className="ribbon-title text-lg md:text-xl">🍦 빙그레 네컷 🍦</div>
      <p className="mt-2 font-hand text-base text-muted-foreground">빙그레 왕국 여름 축제</p>
    </div>
  );
}

function PrivacyNote() {
  return (
    <p className="mt-6 text-center text-xs text-muted-foreground">
      사진은 기기에서만 처리되며 서버에 저장되지 않습니다.
    </p>
  );
}

// 공통 이미지 버튼 (button_trim.png — 핑크 알약 + 우측 아이스크림). 글자는 오버레이.
function ImageButton({
  onClick,
  label,
  textClassName = "text-2xl",
}: {
  onClick: () => void;
  label: string;
  textClassName?: string;
}) {
  return (
    <button onClick={onClick} className="relative block w-full max-w-[330px] transition active:scale-95">
      <img src={btnImg} alt="" draggable={false} className="w-full select-none" />
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-extrabold text-white ${textClassName}`}
        style={{ textShadow: "0 2px 5px rgba(196,74,120,0.6), 0 1px 0 #e07ba6" }}
      >
        {label}
      </span>
    </button>
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
    <div className="mx-auto flex min-h-[90vh] max-w-md flex-col">
      <div className="relative flex-1 overflow-hidden rounded-3xl ring-1 ring-border">
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
            <p className="mt-6 font-hand text-lg font-bold text-white drop-shadow">빙그레 축제로 이동 중…</p>
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
              <div className="absolute inset-x-[12%] top-[25%] space-y-3 text-[13px] font-medium leading-relaxed text-foreground/90">
                <p>두 왕국이 만나 하나의 아이스크림 왕국이 되었습니다! 🍦👑</p>
                <p>오늘부터 마을 광장에서 여름 축제가 시작됩니다.</p>
                <p>축제 속 숨겨진 이벤트와 추억을 함께 남겨보세요. ✨</p>
              </div>
            </div>
            <ImageButton onClick={() => setLeaving(true)} label="축제 즐기러 가기" textClassName="text-xl" />
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── 축제 맵 허브 (스토리보드 C-SCREEN) ─────────────────────────
// 장소(사진 부스·뽑기)와 친구들(강아지·왕자·주민)을 눌러 아이템을 모은다.
//   강아지 → 🍦아이스크림 → 왕자에게 → ❤️하트 / 사진 촬영 → 📷 → 주민에게 → 🍀클로버 → 뽑기 해금

// 흰 배경으로 내보내진 PNG(흰색이 alpha=255)의 흰 픽셀을 투명 처리한 data URL을 만든다.
// 단, 네 모서리가 불투명 흰색일 때만 동작 — 이미 투명한 이미지(예: 흰 물방울 무늬 사탕)는
// 무늬가 지워지지 않도록 원본을 그대로 돌려준다.
function whiteKeyToDataURL(img: HTMLImageElement, threshold = 244): string {
  const c = document.createElement("canvas");
  const W = (c.width = img.naturalWidth);
  const H = (c.height = img.naturalHeight);
  const ctx = c.getContext("2d");
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const isWhite = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return d[i + 3] > 200 && d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold;
  };
  const hasWhiteBg =
    isWhite(1, 1) && isWhite(W - 2, 1) && isWhite(1, H - 2) && isWhite(W - 2, H - 2);
  if (!hasWhiteBg) return img.src;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold) d[i + 3] = 0;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL();
}

// 이미지 소스를 흰 배경 제거 버전으로 바꿔 반환하는 훅(준비 전엔 원본 그대로).
function useWhiteKeyed(src: string): string {
  const [out, setOut] = useState(src);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setOut(whiteKeyToDataURL(img));
    img.src = src;
  }, [src]);
  return out;
}

// 클로버=나뭇잎이라 아이콘은 총 4개. 빈 바(nav_bar_empty) 위 균등 4칸(dstCx)에 등장시킨다.
const NAV_ICONS: {
  key: keyof Inventory;
  label: string;
  src: string;
  dstCx: number;
  h: number;
}[] = [
  { key: "photo", label: "사진", src: navIconPhoto, dstCx: 0.2, h: 92 },
  { key: "clover", label: "클로버", src: navIconClover, dstCx: 0.4, h: 92 },
  { key: "candy", label: "아이스크림", src: navIconCandy, dstCx: 0.6, h: 92 },
  { key: "heart", label: "하트", src: navIconHeart, dstCx: 0.8, h: 64 },
];

function FestivalMap({
  inv,
  setInv,
  onPhoto,
  onDraw,
  onEnd,
}: {
  inv: Inventory;
  setInv: Dispatch<SetStateAction<Inventory>>;
  onPhoto: () => void;
  onDraw: () => void;
  onEnd: () => void;
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
    <div className="mx-auto flex min-h-[90vh] max-w-md flex-col">
      <div className="relative flex-1 overflow-hidden rounded-3xl ring-1 ring-border">
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
          top="58%"
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
          left="34%"
          top="67%"
          width="13%"
          height="15%"
          label="왕자"
          onClick={tapPrince}
          pulse={inv.candy && !inv.heart}
        />
        <Hotspot
          left="20%"
          top="80%"
          width="18%"
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
          <div className="festival-card absolute inset-x-3 top-[8%] z-20 p-3 text-sm leading-relaxed">
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
      </div>
    </div>
  );
}

// 배경 일러스트 위의 투명 클릭 영역. left/top은 영역의 중심.
function Hotspot({
  left,
  top,
  width,
  height,
  label,
  onClick,
  pulse,
}: {
  left: string;
  top: string;
  width: string;
  height: string;
  label: string;
  onClick: () => void;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{ left, top, width, height }}
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl ring-2 ring-transparent transition hover:ring-white/70 active:scale-95"
    >
      {pulse && (
        <span className="absolute right-0 top-0 grid h-5 w-5 animate-bounce place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">
          !
        </span>
      )}
    </button>
  );
}

// 메인 화면 (스토리보드 02 MAIN SCREEN) — 배경 일러스트(빙그레 왕국) + 게임 시작 버튼.
// 배경 에셋 교체 방법: src/assets/main_bg.png 를 추가하고 import 한 뒤,
//   아래 "배경 일러스트 placeholder" 블록을
//   <img src={mainBg} alt="빙그레 왕국" className="absolute inset-0 h-full w-full object-cover" />
//   한 줄로 바꾸면 된다. (타이틀·캐릭터는 이미지에 포함되어 있으므로 버튼만 오버레이)
function MainScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-[90vh] max-w-md flex-col">
      <div className="relative flex-1 overflow-hidden rounded-3xl ring-1 ring-border">
        <img src={mainBg} alt="빙그레 왕국" className="absolute inset-0 h-full w-full object-cover" />

        {/* 타이틀 로고 오버레이 (logo.png — 투명 배경) + 리본 곡선에 부제 */}
        <div className="absolute inset-x-0 top-[3%] flex justify-center">
          <div className="relative w-[95%] max-w-none">
            <img src={logo} alt="빙그레 왕국" className="w-full drop-shadow-sm" />
            {/* 부제를 리본 아치 곡선(트림 이미지 929x538 픽셀 측정)에 태운다 */}
            <svg
              viewBox="0 0 929 538"
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <path id="ribbonPath" d="M 148 450 Q 464 408 780 450" fill="none" />
              </defs>
              <text
                textAnchor="middle"
                fill="#b14a72"
                fontWeight={700}
                fontFamily="Gaegu, 'Apple SD Gothic Neo', sans-serif"
                fontSize={30}
              >
                <textPath href="#ribbonPath" startOffset="50%">
                  오늘도 맛있는 즐거움이 가득한 곳
                </textPath>
              </text>
            </svg>
          </div>
        </div>

        {/* 게임 시작 버튼 */}
        <div className="absolute inset-x-0 bottom-7 flex justify-center px-6">
          <ImageButton onClick={onStart} label="게임 시작" textClassName="text-2xl" />
        </div>
      </div>
    </div>
  );
}

// 프레임 선택/촬영 공통 배경 — select_bg 상단 배너 + 무한 물방울 패턴(긴 페이지)
function FestivalSelectBg({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <div
      className="relative mx-auto max-w-md overflow-hidden rounded-3xl ring-1 ring-border"
      style={{
        backgroundColor: "#b5e3fe",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.85) 2.5px, transparent 3px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* 상단 배너 (성 + 현수막 + 가랜드) */}
      <div
        className="w-full"
        style={{
          aspectRatio: "1024 / 485",
          backgroundImage: `url(${selectBg})`,
          backgroundSize: "100% auto",
          backgroundPosition: "top",
          backgroundRepeat: "no-repeat",
        }}
      />
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-3 top-3 z-20 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-foreground shadow active:scale-95"
        >
          ← 뒤로
        </button>
      )}
      {children}
    </div>
  );
}

// 캔디 버튼 (select_button 에셋 + 글자 오버레이)
function SelectButton({
  onClick,
  label,
  disabled,
  className,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const src = useWhiteKeyed(selectButton);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative mx-auto block w-full max-w-[330px] transition active:scale-95 disabled:opacity-50 ${className ?? ""}`}
    >
      <img src={src} alt="" draggable={false} className="w-full select-none" />
      <span
        className="absolute inset-0 flex items-center justify-center font-display text-xl font-extrabold text-white"
        style={{ textShadow: "0 2px 5px rgba(196,74,120,0.6), 0 1px 0 #e07ba6" }}
      >
        {label}
      </span>
    </button>
  );
}

// 내용 창 (window 에셋) — 제목 + X(닫기) + 본문. 배경 늘려 내용 높이에 맞춤.
function WindowPanel({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const src = useWhiteKeyed(windowImg);
  return (
    <div
      className="relative w-full"
      style={{
        backgroundImage: `url(${src})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {onClose && (
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-[3%] top-[1%] z-10 aspect-square w-[12%]"
        />
      )}
      {title && (
        <div className="absolute inset-x-[14%] top-[4.5%] truncate text-center font-display text-base font-extrabold text-primary">
          {title}
        </div>
      )}
      <div className="px-[9%] pb-[8%] pt-[16%]">{children}</div>
    </div>
  );
}

// 내용 창(다이얼로그) — 이미지를 원본 비율로 그려 X·테두리 찌그러짐 없음.
// 본문은 점선 아래 영역에 세로 중앙 배치.
function WindowDialog({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
  const src = useWhiteKeyed(windowImg);
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <img src={src} alt="" draggable={false} className="w-full select-none" />
      {onClose && (
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-[4%] top-[1%] aspect-square w-[12%]"
        />
      )}
      <div className="absolute inset-x-[10%] bottom-[8%] top-[16%] flex flex-col items-center justify-center">
        {children}
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
                <div className="mt-1 text-xs leading-snug text-amber-800/80">{f.subtitle}</div>
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

function Header({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground shadow-sm ring-1 ring-border transition active:scale-95"
        >
          ← 뒤로
        </button>
      )}
      <h2 className="text-2xl font-bold text-primary">{title}</h2>
    </div>
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
  const f = FRAMES[frameKey];
  const photoIconSrc = useWhiteKeyed(navIconPhoto); // 카메라 아이콘(에셋)

  // 프레임/슬롯 준비 — 권한 불필요, 마운트 시 미리 계산.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const frameImg = await loadImage(f.frame);
      if (cancelled) return;
      let detected = detectGreenSlots(frameImg);
      if (detected.length < 4) detected = fallbackSlots(frameImg);
      setSlots(detected);
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
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">
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
              <p className="mt-2 text-sm leading-relaxed text-foreground/85">{error}</p>
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
        <WindowPanel title={`${Math.min(shots.length + 1, 4)} / 4 컷`} onClose={onBack}>
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
            <img
              src={f.overlays[Math.min(shots.length, f.overlays.length - 1)]}
              alt=""
              className="pointer-events-none absolute inset-0"
              style={{ width: "100%", height: "100%", zIndex: 1 }}
            />
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
                    <img
                      src={f.overlays[i] ?? f.overlay}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                    />
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
const BRUSH_COLORS = ["#ff5d8f", "#ff8fab", "#ffd166", "#06d6a0", "#7bdff2", "#9b5de5", "#ffffff", "#3a3a3a"];
const BRUSH_SIZES = [0.006, 0.013, 0.024]; // 선 굵기 (이미지 너비 대비 비율)
const DEFAULT_STICKER_SIZE = 0.16;

type Pt = { fx: number; fy: number };
type Stroke = { color: string; widthFrac: number; points: Pt[]; order: number };
type StickerItem = { id: string; char: string; fx: number; fy: number; sizeFrac: number; order: number };
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
      for (let i = 1; i < st.points.length; i++) ctx.lineTo(st.points[i].fx * width, st.points[i].fy * height);
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
      return { fx: clamp01((e.clientX - r.left) / r.width), fy: clamp01((e.clientY - r.top) / r.height) };
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
      setStickers((a) => [...a, { id, char, fx: 0.5, fy: 0.5, sizeFrac: DEFAULT_STICKER_SIZE, order }]);
      setSelectedId(id);
    };
    const removeSticker = (id: string) => {
      setStickers((a) => a.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
    };
    const resizeSticker = (d: number) => {
      setStickers((a) =>
        a.map((s) => (s.id === selectedId ? { ...s, sizeFrac: Math.max(0.05, Math.min(0.5, s.sizeFrac + d)) } : s)),
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
        if (selectedId && stickers.find((s) => s.order === maxSticker)?.id === selectedId) setSelectedId(null);
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
          style={{ aspectRatio: `${width} / ${height}`, containerType: "inline-size", background: "#fdf9ee" }}
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
            style={{ zIndex: 1, pointerEvents: tool === "brush" ? "auto" : "none", touchAction: "none" }}
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

        {/* 툴 토글 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <EditToolButton icon="↩️" label="되돌리기" onClick={undo} disabled={!hasEdits} />
          <EditToolButton
            icon="✨"
            label="스티커"
            active={tool === "sticker"}
            onClick={() => {
              setTool((t) => (t === "sticker" ? "none" : "sticker"));
            }}
          />
          <EditToolButton
            icon="✏️"
            label="브러시"
            active={tool === "brush"}
            onClick={() => {
              setTool((t) => (t === "brush" ? "none" : "brush"));
              setSelectedId(null);
            }}
          />
        </div>

        {tool === "sticker" && (
          <div className="festival-card mt-3 p-3">
            <p className="mb-2 text-center text-xs text-muted-foreground">
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
                      background: sizeIdx === i ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
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

function EditToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2.5 text-sm font-bold ring-1 transition active:scale-95 disabled:opacity-40 ${
        active
          ? "bg-primary text-primary-foreground ring-primary"
          : "bg-card text-foreground ring-border"
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </button>
  );
}

function ResultScreen({
  frameKey, shots, onRetake, onChangeFrame, onBackToMap,
}: { frameKey: FrameKey; shots: string[]; onRetake: () => void; onChangeFrame: () => void; onBackToMap: () => void }) {
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [stripSize, setStripSize] = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus] = useState("네컷을 합성하는 중…");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const f = FRAMES[frameKey];

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
          setError(`플레이스홀더 슬롯이 ${detected.length}/4 개만 감지되어 기본 레이아웃을 사용합니다.`);
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
    return () => { cancelled = true; };
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
    <div>
      <Header title="나의 네컷 꾸미기" onBack={onChangeFrame} />
      {error && (
        <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs text-destructive ring-1 ring-destructive/30">
          {error}
        </div>
      )}
      <div className="mx-auto mt-4 max-w-md space-y-4">
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
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-secondary/70 px-4 py-3 text-center text-sm font-bold text-secondary-foreground ring-1 ring-border">
            <span className="text-lg">🎉</span>
            사진이 저장되었습니다! 갤러리(다운로드)를 확인해보세요.
          </div>
        )}
        {shareMsg && <p className="text-center text-xs text-muted-foreground">{shareMsg}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onRetake} className="candy-btn-mint candy-btn px-4 py-3">다시 찍기</button>
          <button onClick={onChangeFrame} className="candy-btn-mint candy-btn px-4 py-3">프레임 변경</button>
          <button onClick={save} disabled={!stripUrl} className="candy-btn px-4 py-3">💾 저장</button>
          <button onClick={share} disabled={!stripUrl} className="candy-btn-sky candy-btn px-4 py-3">🔗 공유</button>
        </div>
        <button onClick={onBackToMap} className="candy-btn w-full px-6 py-4 text-lg">
          🎪 축제로 돌아가기
        </button>
        <PrivacyNote />
      </div>
    </div>
  );
}

// ───────────────────────── 아이스크림 뽑기 (스토리보드 J-SCREEN) ─────────────────────────
// 스크래치 복권을 긁으면 오늘의 아이스크림 운세(10종)가 공개된다.

type Fortune = { name: string; emoji: string; luck: number; message: string };

const FORTUNES: Fortune[] = [
  { name: "부라보", emoji: "🍦", luck: 100, message: "오늘 하루 부라브라보 할 일이 가득하겠어요. 당신의 자신감이 멋진 결과를 만들어낼 거예요!" },
  { name: "팽이팽이", emoji: "🌀", luck: 90, message: "팽팽 돌듯 다양한 기회가 찾아와요! 새로운 시도가 행운의 방향을 바꿔줄 거예요. 두근두근~" },
  { name: "누가바", emoji: "🍫", luck: 85, message: "고소한 누가처럼 당신의 진심이 누군가의 마음을 녹일 거예요. 용기를 내 먼저 얘기해 보세요. 진심을 알아줄 거예요." },
  { name: "호두마루", emoji: "🥜", luck: 80, message: "호두처럼 묵묵히 쌓아온 노력의 결실을 맛볼 때예요!" },
  { name: "투게더", emoji: "🍨", luck: 78, message: "함께라서 더 행복한 하루! 소중한 사람들과의 시간이 큰 행운을 가져다줘요." },
  { name: "젤루조아", emoji: "🍊", luck: 72, message: "그 동안 안 풀리던 일이 감귤의 깔끔하고 상쾌한 맛처럼 시원한 하루가 되겠어요." },
  { name: "요맘때", emoji: "🍧", luck: 70, message: "지친 마음에 달콤한 휴식이 필요해요. 가끔은 나를 위한 시간을 가져보세요. 새로운 에너지를 충전하면 더 좋은 일이 생길 거예요!" },
  { name: "비비빅", emoji: "🍡", luck: 69, message: "막혔던 일이 시원하게 해결되고, 기분 좋은 전환점이 찾아올 거예요." },
  { name: "바밤바", emoji: "🌰", luck: 60, message: "밤의 부드럽고 포슬함처럼 오늘 하루 조금 느려서 답답할 수도 있지만, 곧 좋은 소식이 기다리고 있겠어요!" },
  { name: "메로나", emoji: "🍈", luck: 50, message: "주변이 시끄러운 하루일 수 있어요. 오늘은 메론 본연의 맛이 담긴 메로나를 먹으면서 적당한 휴식이 필요한 날이겠어요." },
];

function DrawScreen({ onBack, onEnd }: { onBack: () => void; onEnd: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchingRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const fortune = useMemo(() => FORTUNES[Math.floor(Math.random() * FORTUNES.length)], []);

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
    <div className="mx-auto max-w-md">
      <Header title="아이스크림 뽑기" onBack={onBack} />
      <p className="mt-3 text-center text-sm text-muted-foreground">
        전설의 클로버로 오늘의 아이스크림 운세를 뽑아보세요!
      </p>
      <div
        className="festival-card relative mt-4 overflow-hidden"
        style={{ aspectRatio: `${W} / ${H}`, padding: 0 }}
      >
        {/* 공개될 운세 (스크래치 아래) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
          <div className="text-7xl">{fortune.emoji}</div>
          <div className="mt-1 text-2xl font-bold text-primary">{fortune.name}</div>
          <div className="text-xs font-bold text-muted-foreground">행운지수 {fortune.luck}%</div>
          <div className="mt-1 h-2.5 w-44 overflow-hidden rounded-full bg-secondary/50 ring-1 ring-border">
            <div className="h-full rounded-full bg-primary" style={{ width: `${fortune.luck}%` }} />
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

      {revealed && (
        <div className="festival-card mt-4 p-5 text-center">
          <p className="text-[15px] leading-relaxed">{fortune.message}</p>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button onClick={onBack} className="candy-btn-mint candy-btn px-4 py-3">
          ← 축제로
        </button>
        <button onClick={onEnd} className="candy-btn px-4 py-3">
          🌅 축제 마치기
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── 축제 종료 (스토리보드 END SCREEN) ─────────────────────────
function EndScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="mx-auto max-w-md">
      <div
        className="festival-card relative overflow-hidden p-8 text-center text-white"
        style={{ background: "linear-gradient(180deg, #ffb38a 0%, #ff7aa2 48%, #9a6ab0 100%)" }}
      >
        <div className="pointer-events-none absolute right-5 top-5 text-2xl opacity-90">⭐</div>
        <div className="pointer-events-none absolute left-6 top-10 text-lg opacity-80">✨</div>
        <div className="text-6xl drop-shadow">🌅</div>
        <h2 className="mt-4 text-2xl font-bold drop-shadow">축제가 저물어요</h2>
        <p className="mt-3 text-[15px] leading-relaxed drop-shadow">
          하나의 왕국이 된 빙그레,
          <br />
          아이스크림 축제를 모두 즐겼어요.
          <br />
          노을이 지고 있어요. 🌇
        </p>
        <p className="mt-5 font-hand text-xl drop-shadow">또 놀러 와요! 🍦</p>
      </div>
      <button onClick={onRestart} className="candy-btn mt-6 w-full px-6 py-4 text-lg">
        🏠 처음으로
      </button>
    </div>
  );
}
