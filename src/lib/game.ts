// 앱 전체 진행 단계와 인벤토리(축제 미션 보상) 타입.
export type Step =
  | "main"
  | "letter"
  | "map"
  | "select"
  | "shoot"
  | "result"
  | "draw"
  | "event"
  | "end";

export type Inventory = { photo: boolean; candy: boolean; heart: boolean; clover: boolean };
export const EMPTY_INVENTORY: Inventory = {
  photo: false,
  candy: false,
  heart: false,
  clover: false,
};
