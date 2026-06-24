import mainBg from "@/assets/main_bg.png";
import logo from "@/assets/logo_trim.png";
import { ImageButton } from "@/components/common";

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
