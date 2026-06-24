import type { ReactNode } from "react";
import btnImg from "@/assets/button_trim.png";
import selectButton from "@/assets/select_button.png";
import selectBg from "@/assets/select_bg.png";
import windowImg from "@/assets/window_trim.png";
import { useWhiteKeyed } from "@/lib/imageHooks";

// 공통 이미지 버튼 (button_trim.png — 핑크 알약 + 우측 아이스크림). 글자는 오버레이.
export function ImageButton({
  onClick,
  label,
  textClassName = "text-2xl",
}: {
  onClick: () => void;
  label: string;
  textClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative block w-full max-w-[330px] transition active:scale-95"
    >
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

// 캔디 버튼 (select_button 에셋 + 글자 오버레이)
export function SelectButton({
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

// 배경 일러스트 위의 투명 클릭 영역. left/top은 영역의 중심.
export function Hotspot({
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

// 프레임 선택/촬영 공통 배경 — select_bg 상단 배너 + 무한 물방울 패턴(긴 페이지)
export function FestivalSelectBg({
  onBack,
  children,
}: {
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="relative mx-auto min-h-[100dvh] max-w-md overflow-hidden rounded-none md:min-h-0 md:rounded-3xl md:ring-1 md:ring-border"
      style={{
        backgroundColor: "#b5e3fe",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 2px, transparent 2.5px)",
        backgroundSize: "21px 21px",
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

// 내용 창 (window 에셋) — 제목 + X(닫기) + 본문.
// 창 원본 비율(1122x1402)을 고정해 X·테두리가 찌그러지지 않게 한다. 내용이 짧으면
// min-h-full로 가운데 정렬해 비율 유지, 혹시 더 길어지면 그만큼 아래로 늘어난다.
export function WindowPanel({
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
        aspectRatio: "1122 / 1402",
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
      <div className="flex min-h-full flex-col justify-center px-[9%] pb-[8%] pt-[15%]">
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}

// 내용 창(다이얼로그) — 이미지를 원본 비율로 그려 X·테두리 찌그러짐 없음.
// 본문은 점선 아래 영역에 세로 중앙 배치.
export function WindowDialog({ onClose, children }: { onClose?: () => void; children: ReactNode }) {
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
