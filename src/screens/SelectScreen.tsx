import { useEffect, useState } from "react";
import selectNote from "@/assets/select_note.webp";
import { FestivalSelectBg, SelectButton } from "@/components/common";
import { FRAMES, type FrameKey } from "@/data/frames";
import { useWhiteKeyed } from "@/lib/imageHooks";
import { createFrameOverlay, detectGreenSlots, fallbackSlots, loadImage } from "@/lib/photobooth";

// 프레임 4종의 미리보기(회색 슬롯 + 장식 + 프레임)를 마운트 시 한 번 합성한다.
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

// 프레임 선택 (스토리보드) — 축제 배경 + 크림 카드 리스트 + 캔디 버튼 + 안내 노트
export function SelectScreen({
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
