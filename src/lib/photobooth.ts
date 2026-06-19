export type FrameKey = "white" | "brown" | "skyblue" | "binggraeus";

export interface Slot { x: number; y: number; w: number; h: number; }

function isPlaceholderGreen(data: Uint8ClampedArray, i: number) {
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
  return a > 128 && g > 180 && r < 120 && b < 120 && g > r + 80 && g > b + 80;
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function detectGreenSlots(img: HTMLImageElement): Slot[] {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

  const visited = new Uint8Array(width * height);
  const rects: Slot[] = [];
  const minPixels = Math.max(500, (width * height) / 400);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (visited[start]) continue;
      if (!isPlaceholderGreen(data, start * 4)) { visited[start] = 1; continue; }
      let minX = x, maxX = x, minY = y, maxY = y, count = 0;
      const queue: number[] = [start];
      visited[start] = 1;
      let head = 0;
      while (head < queue.length) {
        const cur = queue[head++];
        const cx = cur % width;
        const cy = (cur - cx) / width;
        count++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neigh = [
          cx > 0 ? cur - 1 : -1,
          cx < width - 1 ? cur + 1 : -1,
          cy > 0 ? cur - width : -1,
          cy < height - 1 ? cur + width : -1,
        ];
        for (const n of neigh) {
          if (n < 0 || visited[n]) continue;
          visited[n] = 1;
          if (isPlaceholderGreen(data, n * 4)) queue.push(n);
        }
      }
      if (count > minPixels) {
        rects.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
      }
    }
  }
  rects.sort((a, b) => b.w * b.h - a.w * a.h);
  return rects.slice(0, 4).sort((a, b) => a.y - b.y);
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function createFrameOverlay(frame: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = frame.naturalWidth;
  canvas.height = frame.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(frame, 0, 0);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    if (isPlaceholderGreen(image.data, i)) {
      image.data[i + 3] = 0;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function composeStrip(opts: {
  frame: HTMLImageElement;
  overlays: HTMLImageElement[];
  slots: Slot[];
  photos: HTMLImageElement[];
}): Promise<string> {
  const { frame, overlays, slots, photos } = opts;
  const frameOverlay = createFrameOverlay(frame);
  const c = document.createElement("canvas");
  c.width = frame.naturalWidth;
  c.height = frame.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fdf9ee";
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const photo = photos[i];
    const overlay = overlays[i] ?? overlays[overlays.length - 1];
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    if (photo) drawCover(ctx, photo, s.x, s.y, s.w, s.h);
    if (overlay) ctx.drawImage(overlay, s.x, s.y, s.w, s.h);
    ctx.restore();
  }
  ctx.drawImage(frameOverlay, 0, 0);
  return c.toDataURL("image/png");
}

export function fallbackSlots(img: HTMLImageElement): Slot[] {
  const W = img.naturalWidth, H = img.naturalHeight;
  const marginX = W * 0.06;
  const slotW = W - marginX * 2;
  const slotH = (H - marginX * 5 - H * 0.08) / 4;
  return Array.from({ length: 4 }).map((_, i) => ({
    x: marginX, y: marginX + i * (slotH + marginX), w: slotW, h: slotH,
  }));
}