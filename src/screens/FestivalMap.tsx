import { type Dispatch, type SetStateAction, useState } from "react";
import festivalBg from "@/assets/festival_bg.webp";
import navBarEmpty from "@/assets/nav_bar_empty.webp";
import navIconPhoto from "@/assets/nav_icon_photo.webp";
import navIconClover from "@/assets/nav_icon_clover.webp";
import navIconCandy from "@/assets/nav_icon_candy.webp";
import navIconHeart from "@/assets/nav_icon_heart.webp";
import { Hotspot } from "@/components/common";
import type { Inventory } from "@/lib/game";
import { useWhiteKeyed, useWhiteKeyedTrimmed } from "@/lib/imageHooks";

// 클로버=나뭇잎이라 아이콘은 총 4개. 빈 바(nav_bar_empty) 위 균등 4칸(dstCx)에 등장시킨다.
const NAV_ICONS: {
  key: keyof Inventory;
  label: string;
  src: string;
  dstCx: number;
  h: number;
}[] = [
  { key: "photo", label: "사진", src: navIconPhoto, dstCx: 0.2, h: 74 },
  { key: "clover", label: "클로버", src: navIconClover, dstCx: 0.4, h: 74 },
  { key: "candy", label: "아이스크림", src: navIconCandy, dstCx: 0.6, h: 74 },
  { key: "heart", label: "하트", src: navIconHeart, dstCx: 0.8, h: 64 },
];

export function FestivalMap({
  inv,
  setInv,
  onPhoto,
  onDraw,
  onBoard,
  onEnd,
  introSeen,
  onIntroSeen,
}: {
  inv: Inventory;
  setInv: Dispatch<SetStateAction<Inventory>>;
  onPhoto: () => void;
  onDraw: () => void;
  onBoard: () => void;
  onEnd: () => void;
  introSeen: boolean;
  onIntroSeen: () => void;
}) {
  const [bubble, setBubble] = useState<{ who: string; text: string } | null>(null);
  const say = (who: string, text: string) => setBubble({ who, text });

  // 빈 바: 흰 배경 제거 + 위아래 투명 여백 트림(핑크 알약이 하단 라벨 바로 위에 붙도록).
  const navBarSrc = useWhiteKeyedTrimmed(navBarEmpty);
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
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col md:min-h-[90vh]">
      <div className="relative flex-1 overflow-hidden rounded-none md:rounded-3xl md:ring-1 md:ring-border">
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
        {/* 좌상단 게시판(폴라로이드가 붙은 나무 보드) → 광장 게시판 (느낌표 상시 표시) */}
        <Hotspot
          left="30%"
          top="27%"
          width="28%"
          height="21%"
          label="광장 게시판"
          cta="입장하기"
          ctaY={58}
          onClick={onBoard}
          pulse
        />
        <Hotspot
          left="57%"
          top="52%"
          width="31%"
          height="26%"
          label="사진 부스"
          cta="촬영하기"
          onClick={onPhoto}
          pulse
        />
        <Hotspot
          left="86%"
          top="34%"
          width="24%"
          height="32%"
          label="뽑기 기계"
          cta="뽑기하기"
          onClick={tapDraw}
          pulse={inv.clover}
        />
        <Hotspot
          left="30%"
          top="67%"
          width="22%"
          height="15%"
          label="왕자"
          cta="물어보기"
          ctaY={95}
          onClick={tapPrince}
          pulse={inv.candy && !inv.heart}
        />
        <Hotspot
          left="16%"
          top="80%"
          width="26%"
          height="13%"
          label="강아지"
          cta="사탕받기"
          ctaY={95}
          onClick={tapDog}
          pulse={!inv.candy}
        />
        <Hotspot
          left="69%"
          top="84%"
          width="62%"
          height="18%"
          label="주민"
          cta="물어보기"
          ctaY={12}
          onClick={tapResident}
          pulse={inv.photo && !inv.clover}
        />

        {/* 말풍선 */}
        {bubble && (
          <div className="festival-card absolute inset-x-3 top-[8%] z-20 p-3 text-[15px] leading-relaxed">
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

        {/* 첫 방문 환영 안내 말풍선 — 아무 곳이나 터치하면 닫힘 */}
        {!introSeen && (
          <div
            role="button"
            tabIndex={0}
            onClick={onIntroSeen}
            aria-label="안내 닫기"
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 px-8"
          >
            <div className="festival-card relative max-w-[300px] p-5 text-center text-[16px] font-bold leading-relaxed text-foreground">
              빙그레 왕국 여름축제에 온 걸 환영해!
              <br />
              화면의{" "}
              <span className="mx-0.5 -mt-0.5 inline-grid h-5 w-5 place-items-center rounded-full bg-primary align-middle text-xs font-extrabold text-primary-foreground shadow">
                !
              </span>{" "}
              파란 버튼들을 하나씩 눌러봐.
              <span className="mt-2 block text-xs font-medium text-muted-foreground">
                터치하면 닫혀요
              </span>
              {/* 말풍선 꼬리 */}
              <span
                className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-card"
                style={{
                  borderRight: "2px solid color-mix(in oklch, var(--color-primary) 16%, white)",
                  borderBottom: "2px solid color-mix(in oklch, var(--color-primary) 16%, white)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
