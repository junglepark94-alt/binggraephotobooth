import frameBinggraeus from "@/assets/frame_binggraeus.png";
import frameMelonaprince from "@/assets/frame_melonaprince.png";
import frameBravocone from "@/assets/frame_bravocone.png";
import frameBananamilk from "@/assets/frame_bananamilk.png";
import type { FrameKey } from "@/lib/photobooth";

export type { FrameKey };

// 1x1 투명 픽셀 — 새 프레임은 장식이 이미지에 포함돼 슬롯 오버레이가 필요 없다.
export const TRANSPARENT_PX =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export type FrameDef = {
  name: string;
  subtitle: string;
  frame: string;
  overlay: string;
  overlays: string[];
  tint: string;
};

export const FRAMES: Record<FrameKey, FrameDef> = {
  binggraeus: {
    name: "빙그레우스",
    subtitle: "아이스크림 왕국의 국왕 빙그레우스와 함께 찍는 왕실 프레임",
    frame: frameBinggraeus,
    overlay: TRANSPARENT_PX,
    overlays: [TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX],
    tint: "from-rose-300 to-amber-200",
  },
  melonaprince: {
    name: "메로나 옹떼 부르쟝",
    subtitle: "우아한 멜론빛 왕자 메로나 옹떼 부르쟝과 함께 찍는 프레임",
    frame: frameMelonaprince,
    overlay: TRANSPARENT_PX,
    overlays: [TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX],
    tint: "from-lime-200 to-green-100",
  },
  bravocone: {
    name: "부라보콘",
    subtitle: "1970년부터 함께한 바삭한 콘과 달콤한 추억의 부라보콘 프레임",
    frame: frameBravocone,
    overlay: TRANSPARENT_PX,
    overlays: [TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX],
    tint: "from-amber-100 to-rose-100",
  },
  bananamilk: {
    name: "바나나맛우유",
    subtitle: "1974년부터 사랑받은 단지 모양 바나나맛우유 프레임",
    frame: frameBananamilk,
    overlay: TRANSPARENT_PX,
    overlays: [TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX, TRANSPARENT_PX],
    tint: "from-yellow-100 to-amber-100",
  },
};
