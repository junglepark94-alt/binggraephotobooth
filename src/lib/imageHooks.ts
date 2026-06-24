import { useEffect, useState } from "react";

// 흰 배경을 투명으로 빼서 dataURL 반환. 모서리 4곳이 흰색일 때만 동작하고,
// 무늬가 지워지지 않도록 (흰 배경이 아니면) 원본을 그대로 돌려준다.
function whiteKeyToDataURL(img: HTMLImageElement, threshold = 244): string {
  const c = document.createElement("canvas");
  const W = (c.width = img.naturalWidth);
  const H = (c.height = img.naturalHeight);
  const ctx = c.getContext("2d");
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;
  const isWhite = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return d[i + 3] > 200 && d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold;
  };
  const hasWhiteBg =
    isWhite(1, 1) && isWhite(W - 2, 1) && isWhite(1, H - 2) && isWhite(W - 2, H - 2);
  if (!hasWhiteBg) return img.src;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > threshold && d[i + 1] > threshold && d[i + 2] > threshold) d[i + 3] = 0;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL();
}

// 캔버스 이미지 처리(키잉/크롭/누끼)는 입력 에셋에만 의존하는 순수 연산이므로,
// 같은 결과를 화면 전환마다 다시 만들지 않도록 모듈 레벨 캐시에 dataURL을 보관한다.
// (재방문 시 캐시 히트 → 초기값부터 처리본이라 깜빡임·재처리 없음)
const whiteKeyCache = new Map<string, string>();
const keyedCropCache = new Map<string, string>();
const nukkiCache = new Map<string, string>();

// 이미지 소스를 흰 배경 제거 버전으로 바꿔 반환하는 훅(준비 전엔 원본 그대로).
export function useWhiteKeyed(src: string): string {
  const [out, setOut] = useState(() => whiteKeyCache.get(src) ?? src);
  useEffect(() => {
    const cached = whiteKeyCache.get(src);
    if (cached) {
      setOut(cached);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const result = whiteKeyToDataURL(img);
      whiteKeyCache.set(src, result);
      setOut(result);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return out;
}

// 흰 배경 RGB 버튼 에셋(edit_toolbar/result_actions/back_button)에서 지정 박스만 잘라
// 흰색을 투명 처리. 원본은 바깥쪽 흰 여백이 넓어, 측정한 콘텐츠 박스만 크롭해
// w-full로 자연스러운 높이를 만들고 그 위에 글자를 비율 좌표로 오버레이한다.
export type Crop = { x0: number; y0: number; x1: number; y1: number };

export function useKeyedCrop(src: string, crop: Crop): string {
  const cacheKey = `${src}|${crop.x0},${crop.y0},${crop.x1},${crop.y1}`;
  const [out, setOut] = useState(() => keyedCropCache.get(cacheKey) ?? src);
  useEffect(() => {
    const cached = keyedCropCache.get(cacheKey);
    if (cached) {
      setOut(cached);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      const sx = Math.round(crop.x0 * W);
      const sy = Math.round(crop.y0 * H);
      const sw = Math.round((crop.x1 - crop.x0) * W);
      const sh = Math.round((crop.y1 - crop.y0) * H);
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const ctx = c.getContext("2d");
      if (!ctx) {
        setOut(src);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const id = ctx.getImageData(0, 0, sw, sh);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244) d[i + 3] = 0;
      }
      ctx.putImageData(id, 0, 0);
      const result = c.toDataURL();
      keyedCropCache.set(cacheKey, result);
      setOut(result);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src, cacheKey, crop]);
  return out;
}

// 흰 배경 누끼: 모서리에서 flood-fill로 연결된 흰 영역만 투명화(제품 내부 흰색은 보존).
// 이미 투명 PNG면 원본을 그대로 반환. 표시용이라 최대 512px로 축소해 처리한다.
export function useNukki(src: string): string {
  const [out, setOut] = useState(() => nukkiCache.get(src) ?? src);
  useEffect(() => {
    const cached = nukkiCache.get(src);
    if (cached) {
      setOut(cached);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const maxDim = 512;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const W = Math.max(1, Math.round(img.naturalWidth * scale));
      const H = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d");
      if (!ctx) {
        setOut(src);
        return;
      }
      ctx.drawImage(img, 0, 0, W, H);
      const id = ctx.getImageData(0, 0, W, H);
      const d = id.data;
      const alphaAt = (x: number, y: number) => d[(y * W + x) * 4 + 3];
      // 모서리가 이미 투명하면(누끼 완료) 원본 그대로 사용
      if (
        alphaAt(0, 0) < 20 &&
        alphaAt(W - 1, 0) < 20 &&
        alphaAt(0, H - 1) < 20 &&
        alphaAt(W - 1, H - 1) < 20
      ) {
        nukkiCache.set(src, src);
        setOut(src);
        return;
      }
      const near = (i: number) => d[i] > 236 && d[i + 1] > 236 && d[i + 2] > 236;
      const seen = new Uint8Array(W * H);
      const stack: number[] = [];
      const push = (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        stack.push(y * W + x);
      };
      for (let x = 0; x < W; x++) {
        push(x, 0);
        push(x, H - 1);
      }
      for (let y = 0; y < H; y++) {
        push(0, y);
        push(W - 1, y);
      }
      while (stack.length) {
        const p = stack.pop()!;
        if (seen[p]) continue;
        seen[p] = 1;
        if (!near(p * 4)) continue;
        d[p * 4 + 3] = 0;
        const x = p % W;
        const y = (p / W) | 0;
        push(x + 1, y);
        push(x - 1, y);
        push(x, y + 1);
        push(x, y - 1);
      }
      ctx.putImageData(id, 0, 0);
      const result = c.toDataURL();
      nukkiCache.set(src, result);
      setOut(result);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return out;
}
