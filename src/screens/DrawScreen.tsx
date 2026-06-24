import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import fortuneButton from "@/assets/fortune_button.png";
import selectNote from "@/assets/select_note.png";
import { FestivalSelectBg, WindowPanel } from "@/components/common";
import { FORTUNES } from "@/data/fortunes";
import { type Crop, useKeyedCrop, useNukki, useWhiteKeyed } from "@/lib/imageHooks";

// 1x2 버튼 그리드(축제로 / 축제 마치기). 셀 중심은 크롭 박스 기준.
const FORTUNE_BTN_CROP: Crop = { x0: 0.05, y0: 0.42, x1: 0.95, y1: 0.76 };
const FORTUNE_BTN_CELLS = [
  { cx: 0.253, cy: 0.47 },
  { cx: 0.746, cy: 0.47 },
];

// ───────────────────────── 아이스크림 뽑기 (스토리보드 J-SCREEN) ─────────────────────────
// 스크래치 복권을 긁으면 오늘의 아이스크림 운세(10종)가 공개된다.
export function DrawScreen({ onBack, onEnd }: { onBack: () => void; onEnd: () => void }) {
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
