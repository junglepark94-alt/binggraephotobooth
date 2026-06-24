import { useEffect, useState } from "react";
import mainBg from "@/assets/main_bg.png";
import windowImg from "@/assets/window_trim.png";
import icecreamLoading from "@/assets/icecream_loading.png";
import { ImageButton } from "@/components/common";
import { useWhiteKeyed } from "@/lib/imageHooks";

// "From. 빙그레…" 편지 인트로 (스토리보드 A-SCREEN) → 짧은 로딩 → 프레임 선택
export function LetterScreen({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const icecream = useWhiteKeyed(icecreamLoading); // PNG 흰 배경 제거
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onNext, 1400);
    return () => clearTimeout(t);
  }, [leaving, onNext]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col md:min-h-[90vh]">
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
