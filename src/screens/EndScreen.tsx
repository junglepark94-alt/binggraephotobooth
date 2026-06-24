import endBg from "@/assets/end_bg.png";
import logo from "@/assets/logo_trim.png";
import { SelectButton, WindowDialog } from "@/components/common";

// 축제 종료 화면 — 노을 진 왕국 배경 + 로고 + 안내 다이얼로그.
export function EndScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col md:min-h-[90vh]">
      <div className="relative flex-1 overflow-hidden rounded-none md:rounded-3xl md:ring-1 md:ring-border">
        <img
          src={endBg}
          alt="노을이 진 빙그레 왕국"
          className="absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
        />

        {/* 상단 로고 + 여름축제 리본 — 메인 화면과 동일 크기/위치 */}
        <div className="absolute inset-x-0 top-[3%] flex justify-center">
          <div className="relative w-[95%] max-w-none">
            <img src={logo} alt="빙그레 왕국" className="w-full drop-shadow-sm" />
            <svg
              viewBox="0 0 929 538"
              preserveAspectRatio="xMidYMid meet"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <path id="endRibbonPath" d="M 148 450 Q 464 408 780 450" fill="none" />
              </defs>
              <text
                textAnchor="middle"
                fill="#b14a72"
                fontWeight={700}
                fontFamily="Gaegu, 'Apple SD Gothic Neo', sans-serif"
                fontSize={30}
              >
                <textPath href="#endRibbonPath" startOffset="50%">
                  오늘도 맛있는 즐거움이 가득한 곳
                </textPath>
              </text>
            </svg>
          </div>
        </div>

        {/* 창 (window 에셋) — 로고 아래로 내림 */}
        <div className="absolute inset-x-0 top-[35%] flex justify-center px-6">
          <div className="w-full max-w-[310px]">
            <WindowDialog onClose={onRestart}>
              <div className="w-full text-center">
                <p className="font-display text-[16px] font-extrabold leading-relaxed text-foreground">
                  하나의 왕국이 된 빙그레,
                  <br />
                  아이스크림 축제를 모두 즐겼어요.
                </p>
                <SelectButton onClick={onRestart} label="처음으로" className="mt-4" />
              </div>
            </WindowDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
