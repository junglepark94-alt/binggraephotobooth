import mainBg from "@/assets/main_bg.png";
import { ImageButton, KingdomLogo } from "@/components/common";

// 메인 화면 (스토리보드 02 MAIN SCREEN) — 배경 일러스트 + 로고 + 게임 시작 버튼.
export function MainScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col md:min-h-[90vh]">
      <div className="relative flex-1 overflow-hidden rounded-none md:rounded-3xl md:ring-1 md:ring-border">
        <img
          src={mainBg}
          alt="빙그레 왕국"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* 타이틀 로고 오버레이 + 리본 곡선에 부제 */}
        <KingdomLogo />

        {/* 게임 시작 버튼 */}
        <div className="absolute inset-x-0 bottom-7 flex justify-center px-6">
          <ImageButton onClick={onStart} label="게임 시작" textClassName="text-2xl" />
        </div>
      </div>
    </div>
  );
}
