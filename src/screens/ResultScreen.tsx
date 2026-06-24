import {
  type PointerEvent as ReactPointerEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import editToolbar from "@/assets/edit_toolbar.png";
import resultActions from "@/assets/result_actions.png";
import backButton from "@/assets/back_button.png";
import selectNote from "@/assets/select_note.png";
import { FestivalSelectBg } from "@/components/common";
import { FRAMES, type FrameKey } from "@/data/frames";
import { type Crop, useKeyedCrop, useWhiteKeyed } from "@/lib/imageHooks";
import {
  type Slot,
  composeStrip,
  detectGreenSlots,
  fallbackSlots,
  loadImage,
} from "@/lib/photobooth";

// useKeyedCrop용 크롭 박스 + 셀 중심 좌표 (버튼 에셋 위 글자/아이콘 오버레이 위치).
// 1x3 툴바 바(되돌리기/스티커/브러시).
const TOOLBAR_CROP: Crop = { x0: 0.03, y0: 0.345, x1: 0.97, y1: 0.65 };
const TOOLBAR_CELL_CX = [0.165, 0.5, 0.834];
// 2x2 액션 그리드(다시찍기/프레임변경/저장/공유).
const RESULT_ACTIONS_CROP: Crop = { x0: 0.06, y0: 0.2, x1: 0.94, y1: 0.81 };
const RESULT_ACTIONS_CELLS = [
  { cx: 0.257, cy: 0.292 },
  { cx: 0.743, cy: 0.292 },
  { cx: 0.257, cy: 0.725 },
  { cx: 0.743, cy: 0.725 },
];
// 풀폭 버튼(축제로 돌아가기).
const BACK_BTN_CROP: Crop = { x0: 0.01, y0: 0.05, x1: 0.99, y1: 0.95 };

// ───────────────────────── 사진 꾸미기 에디터 ─────────────────────────
// 합성된 네컷 위에 스티커(이모지)·브러시 그리기. 좌표·크기는 모두 이미지 대비
// 비율(0~1)로 저장 → 화면 표시와 PNG 내보내기가 정확히 일치.
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
type EditorHandle = { exportPng: () => string };

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

export function ResultScreen({
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
