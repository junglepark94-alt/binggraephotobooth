import { createFileRoute } from "@tanstack/react-router";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
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
import prologue1 from "@/assets/prologue_1.png";
import prologue2 from "@/assets/prologue_2.png";
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

type Step = "prologue1" | "prologue2" | "select" | "shoot" | "result";

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
  const [step, setStep] = useState<Step>("prologue1");
  const [frameKey, setFrameKey] = useState<FrameKey | null>(null);
  const [shots, setShots] = useState<string[]>([]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-8 md:max-w-3xl lg:max-w-6xl md:px-8 md:pt-12">
        {step !== "prologue1" && step !== "prologue2" && <FestivalHeader />}
        {step === "prologue1" && (
          <PrologueScreen
            image={prologue1}
            alt="프롤로그 1"
            onNext={() => setStep("prologue2")}
            overlayButton
            hotspotStyle={{ left: "31.11%", top: "55.94%", width: "38.43%", height: "3.75%" }}
          />
        )}
        {step === "prologue2" && (
          <PrologueScreen
            image={prologue2}
            alt="프롤로그 2"
            onBack={() => setStep("prologue1")}
            onNext={() => setStep("select")}
            overlayButton
            hotspotStyle={{ left: "31.11%", top: "52.40%", width: "38.43%", height: "3.75%" }}
          />
        )}
        {step === "select" && (
          <SelectScreen
            value={frameKey}
            onChange={setFrameKey}
            onBack={() => setStep("prologue2")}
            onNext={() => frameKey && setStep("shoot")}
          />
        )}
        {step === "shoot" && frameKey && (
          <ShootScreen
            frameKey={frameKey}
            onBack={() => setStep("select")}
            onDone={(s) => { setShots(s); setStep("result"); }}
          />
        )}
        {step === "result" && frameKey && (
          <ResultScreen
            frameKey={frameKey}
            shots={shots}
            onRetake={() => { setShots([]); setStep("shoot"); }}
            onChangeFrame={() => { setShots([]); setStep("select"); }}
          />
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

function PrologueScreen({
  image, alt, onBack, onNext, ctaLabel, overlayButton, hotspotStyle,
}: { image: string; alt: string; onBack?: () => void; onNext: () => void; ctaLabel?: string; overlayButton?: boolean; hotspotStyle?: CSSProperties }) {
  return (
    <div className="mx-auto flex min-h-[88vh] max-w-2xl flex-col">
      {onBack && (
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground shadow-sm ring-1 ring-border transition active:scale-95"
          >
            ← 뒤로
          </button>
        </div>
      )}
      <div className="mt-4 flex flex-1 items-center justify-center px-1">
        <div className="relative inline-block">
          <img
            src={image}
            alt={alt}
            className="block h-auto max-h-[85vh] w-auto max-w-full rounded-3xl object-contain shadow-sm ring-1 ring-border md:max-h-[90vh]"
          />
          {overlayButton && (
            <button
              onClick={onNext}
              aria-label="다음"
              style={hotspotStyle}
              className="absolute cursor-pointer rounded-full transition-transform duration-150 hover:scale-[1.04] hover:bg-white/10 active:translate-y-[2px] active:scale-[0.96] active:bg-black/10"
            />
          )}
        </div>
      </div>
      {ctaLabel && (
        <button onClick={onNext} className="candy-btn mx-auto mt-6 w-full max-w-sm px-6 py-4 text-lg">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

function SelectScreen({
  value, onChange, onBack, onNext,
}: { value: FrameKey | null; onChange: (k: FrameKey) => void; onBack: () => void; onNext: () => void }) {
  const previews = useFramePreviews();
  return (
    <div className="mx-auto max-w-5xl">
      <Header title="프레임 선택" onBack={onBack} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(FRAMES) as FrameKey[]).map((k) => {
          const f = FRAMES[k];
          const active = value === k;
          return (
            <button
              key={k}
              onClick={() => onChange(k)}
              className={`festival-card relative flex items-center gap-4 p-3 text-left transition sm:flex-col sm:items-stretch sm:p-4 ${active ? "scale-[1.01] !border-primary shadow-lg shadow-primary/25" : ""}`}
            >
              <div className="relative flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary/40 p-1 ring-1 ring-border sm:h-72 sm:w-full">
                <img src={previews[k] ?? f.frame} alt={f.name} className="h-full w-full object-contain" />
              </div>
              <div className="flex-1 sm:mt-3">
                <div className="text-lg font-bold">{f.name}</div>
                <div className="mt-1 text-sm leading-snug text-muted-foreground">{f.subtitle}</div>
              </div>
              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 sm:absolute sm:right-3 sm:top-3 ${active ? "border-primary bg-primary" : "border-border"}`}>
                {active && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
      <button
        disabled={!value}
        onClick={onNext}
        className="candy-btn mt-8 w-full px-6 py-4 text-lg disabled:cursor-not-allowed md:mx-auto md:max-w-md"
      >
        촬영 시작
      </button>
      <PrivacyNote />
    </div>
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
  frameKey, onBack, onDone,
}: { frameKey: FrameKey; onBack: () => void; onDone: (shots: string[]) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayImgRef = useRef<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shots, setShots] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [frameOverlayUrl, setFrameOverlayUrl] = useState<string | null>(null);
  const f = FRAMES[frameKey];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        overlayImgRef.current = await loadImage(f.overlay);
        const frameImg = await loadImage(f.frame);
        if (cancelled) return;
        const W = frameImg.naturalWidth;
        const H = frameImg.naturalHeight;
        let detected = detectGreenSlots(frameImg);
        if (detected.length < 4) detected = fallbackSlots(frameImg);
        setFrameSize({ w: W, h: H });
        setSlots(detected);
        // Build frame with green placeholders made transparent
        const fc = document.createElement("canvas");
        fc.width = W; fc.height = H;
        const fctx = fc.getContext("2d")!;
        fctx.drawImage(frameImg, 0, 0);
        const id = fctx.getImageData(0, 0, W, H);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
          if (a > 128 && g > 180 && r < 120 && b < 120 && g > r + 80 && g > b + 80) {
            d[i + 3] = 0;
          }
        }
        fctx.putImageData(id, 0, 0);
        setFrameOverlayUrl(fc.toDataURL("image/png"));

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        console.error(e);
        setError("네컷 촬영을 위해 카메라 권한이 필요합니다. 카메라 접근을 허용한 뒤 다시 시도해주세요.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [f.overlay, f.frame]);

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

  if (error) {
    return (
      <div>
        <Header title="카메라" onBack={onBack} />
        <div className="mt-6 rounded-2xl bg-card p-6 ring-1 ring-border">
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const activeIndex = busy ? Math.min(shots.length, 3) : shots.length < 4 ? shots.length : -1;
  const displayIndex = activeIndex >= 0 ? activeIndex : Math.min(shots.length, slots.length - 1);
  const activeSlot = slots[displayIndex];
  const aspect = activeSlot ? `${activeSlot.w} / ${activeSlot.h}` : "3 / 4";

  return (
    <div>
      <Header title={`${Math.min(shots.length + 1, 4)} / 4 컷`} onBack={onBack} />
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div>
      <div
        className="relative mx-auto overflow-hidden rounded-3xl ring-1 ring-border"
        style={{ aspectRatio: aspect, background: "#fdf9ee", maxWidth: 520 }}
      >
        {/* Live camera fills the active slot (cover keeps the selfie un-distorted) */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scaleX(-1)", zIndex: 0 }}
        />
        {/* Overlay stretched to fully fill the slot — matches final composition, no cropping */}
        <img
          src={f.overlays[Math.min(shots.length, f.overlays.length - 1)]}
          alt=""
          className="pointer-events-none absolute inset-0"
          style={{ width: "100%", height: "100%", zIndex: 1 }}
        />
        {countdown !== null && (
          <div className="absolute inset-0 grid place-items-center bg-black/30" style={{ zIndex: 3 }}>
            <div className="text-9xl font-extrabold text-white drop-shadow-lg">{countdown}</div>
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white" style={{ zIndex: 3 }}>
          {f.name} · {Math.min(shots.length + 1, 4)}/4
        </div>
      </div>
      </div>

      <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-secondary ring-1 ring-border">
            {shots[i] && (
              <>
                <img src={shots[i]} alt="" className="h-full w-full object-cover" />
                <img src={f.overlays[i] ?? f.overlay} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
              </>
            )}
          </div>
        ))}
      </div>

      <button onClick={startShooting} disabled={!ready || busy} className="candy-btn w-full px-6 py-4 text-lg">
        {busy ? "촬영 중…" : ready ? "📸 4컷 촬영하기" : "카메라 불러오는 중…"}
      </button>
      <PrivacyNote />
      </div>
      </div>
    </div>
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
  frameKey, shots, onRetake, onChangeFrame,
}: { frameKey: FrameKey; shots: string[]; onRetake: () => void; onChangeFrame: () => void }) {
  const [stripUrl, setStripUrl] = useState<string | null>(null);
  const [stripSize, setStripSize] = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus] = useState("네컷을 합성하는 중…");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const f = FRAMES[frameKey];

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
        {shareMsg && <p className="text-center text-xs text-muted-foreground">{shareMsg}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onRetake} className="candy-btn-mint candy-btn px-4 py-3">다시 찍기</button>
          <button onClick={onChangeFrame} className="candy-btn-mint candy-btn px-4 py-3">프레임 변경</button>
          <button onClick={save} disabled={!stripUrl} className="candy-btn px-4 py-3">💾 저장</button>
          <button onClick={share} disabled={!stripUrl} className="candy-btn-sky candy-btn px-4 py-3">🔗 공유</button>
        </div>
        <PrivacyNote />
      </div>
    </div>
  );
}
