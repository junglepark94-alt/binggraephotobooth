import { useEffect, useRef, useState } from "react";
import navIconPhoto from "@/assets/nav_icon_photo.webp";
import { FestivalSelectBg, SelectButton, WindowDialog, WindowPanel } from "@/components/common";
import { FRAMES, type FrameKey } from "@/data/frames";
import { useWhiteKeyed } from "@/lib/imageHooks";
import {
  type Slot,
  detectGreenSlots,
  fallbackSlots,
  loadImage,
  sliceSlotOverlays,
} from "@/lib/photobooth";

export function ShootScreen({
  frameKey,
  onBack,
  onDone,
}: {
  frameKey: FrameKey;
  onBack: () => void;
  onDone: (shots: string[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shots, setShots] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const unmountedRef = useRef(false); // 촬영 루프가 언마운트 후 onDone을 부르지 않게
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotOverlays, setSlotOverlays] = useState<string[]>([]);
  const f = FRAMES[frameKey];
  const photoIconSrc = useWhiteKeyed(navIconPhoto); // 카메라 아이콘(에셋)

  useEffect(
    () => () => {
      unmountedRef.current = true;
    },
    [],
  );

  // 프레임/슬롯 준비 — 권한 불필요, 마운트 시 미리 계산.
  // 슬롯별 오버레이(컷마다 겹쳐 들어온 캐릭터/장식)도 프레임에서 잘라 미리 만든다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const frameImg = await loadImage(f.frame);
      if (cancelled) return;
      let detected = detectGreenSlots(frameImg);
      if (detected.length < 4) detected = fallbackSlots(frameImg);
      setSlots(detected);
      setSlotOverlays(sliceSlotOverlays(frameImg, detected));
    })();
    return () => {
      cancelled = true;
    };
  }, [f.frame]);

  // 카메라 요청 — 사용자가 "허용하고 시작"을 누른 뒤(started)에만 실행.
  // 사용자 제스처 이후 권한을 요청해야 브라우저 프롬프트가 안정적으로 뜬다.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (e) {
        console.error(e);
        setError("카메라 접근이 허용되지 않았어요. 권한을 허용한 뒤 다시 시도해주세요.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [started, attempt]);

  const retry = () => {
    setError(null);
    setReady(false);
    setAttempt((a) => a + 1);
  };

  const capture = (): string => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return "";
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // mirror so the captured photo matches the selfie preview
    ctx.save();
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    ctx.restore();
    return c.toDataURL("image/jpeg", 0.92);
  };

  const runCountdown = async () => {
    for (let n = 3; n >= 1; n--) {
      setCountdown(n);
      await new Promise((r) => setTimeout(r, 800));
    }
    setCountdown(null);
  };

  const startShooting = async () => {
    if (busy || !ready) return;
    setBusy(true);
    const collected: string[] = [];
    for (let i = 0; i < 4; i++) {
      setShots([...collected]);
      await runCountdown();
      // 촬영 도중 뒤로가기 등으로 화면을 떠났으면 중단 — 결과 화면으로 끌고 가지 않는다.
      if (unmountedRef.current) return;
      const shot = capture();
      if (!shot) {
        setBusy(false);
        setError("카메라 화면을 읽지 못했어요. 다시 시도해주세요.");
        return;
      }
      collected.push(shot);
      setShots([...collected]);
      await new Promise((r) => setTimeout(r, 500));
      if (unmountedRef.current) return;
    }
    setBusy(false);
    onDone(collected);
  };

  // 카메라 권한 안내 화면 (스토리보드 E-SCREEN) — 촬영 전 권한 요청 가이드.
  if (!started) {
    return (
      <FestivalSelectBg onBack={onBack}>
        <div className="px-3 pb-6 pt-1">
          <WindowDialog onClose={onBack}>
            <div className="text-center">
              <img
                src={photoIconSrc}
                alt=""
                draggable={false}
                className="mx-auto h-16 w-16 select-none object-contain"
              />
              <h3 className="mt-1 text-xl font-extrabold text-primary">카메라 준비</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                네컷 촬영을 위해 카메라 접근 권한이 필요해요. 아래 버튼을 누르고 브라우저에서
                “허용”을 선택해주세요.
              </p>
              <SelectButton
                onClick={() => setStarted(true)}
                label="허용하고 시작하기"
                className="mt-4"
              />
              <p className="mt-2 text-[11px] text-foreground/60">
                사진은 기기에서만 처리되며 서버에 저장되지 않습니다.
              </p>
            </div>
          </WindowDialog>
        </div>
      </FestivalSelectBg>
    );
  }

  if (error) {
    return (
      <FestivalSelectBg onBack={onBack}>
        <div className="px-3 pb-6 pt-1">
          <WindowDialog onClose={onBack}>
            <div className="text-center">
              <div className="text-5xl">😢</div>
              <h3 className="mt-1 text-xl font-extrabold text-primary">카메라를 못 켰어요</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{error}</p>
              <SelectButton onClick={retry} label="다시 시도" className="mt-4" />
              <p className="mt-2 text-[11px] leading-snug text-foreground/60">
                계속 안 되면 주소창의 카메라 아이콘에서 권한을 “허용”으로 바꿔주세요.
              </p>
            </div>
          </WindowDialog>
        </div>
      </FestivalSelectBg>
    );
  }

  const activeIndex = busy ? Math.min(shots.length, 3) : shots.length < 4 ? shots.length : -1;
  const displayIndex = activeIndex >= 0 ? activeIndex : Math.min(shots.length, slots.length - 1);
  const activeSlot = slots[displayIndex];
  const aspect = activeSlot ? `${activeSlot.w} / ${activeSlot.h}` : "3 / 4";

  return (
    <FestivalSelectBg onBack={onBack}>
      <div className="px-3 pb-6 pt-1">
        <h2 className="mb-2 text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          {Math.min(shots.length + 1, 4)} / 4 컷
        </h2>
        <WindowPanel onClose={onBack}>
          {/* 카메라 미리보기 */}
          <div
            className="relative mx-auto overflow-hidden rounded-2xl ring-1 ring-border"
            style={{ aspectRatio: aspect, background: "#fdf9ee", maxWidth: 280 }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-cover"
              style={{ transform: "scaleX(-1)", zIndex: 0 }}
            />
            {slotOverlays[displayIndex] && (
              <img
                src={slotOverlays[displayIndex]}
                alt=""
                className="pointer-events-none absolute inset-0"
                style={{ width: "100%", height: "100%", zIndex: 1 }}
              />
            )}
            {!ready && (
              <div
                className="absolute inset-0 grid place-items-center bg-black/20"
                style={{ zIndex: 2 }}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="h-9 w-9 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  <p className="text-sm font-bold text-white drop-shadow">카메라 불러오는 중…</p>
                </div>
              </div>
            )}
            {countdown !== null && (
              <div
                className="absolute inset-0 grid place-items-center bg-black/30"
                style={{ zIndex: 3 }}
              >
                <div className="text-8xl font-extrabold text-white drop-shadow-lg">{countdown}</div>
              </div>
            )}
            <div
              className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white"
              style={{ zIndex: 3 }}
            >
              {f.name} · {Math.min(shots.length + 1, 4)}/4
            </div>
          </div>

          {/* 4컷 썸네일 */}
          <div className="mx-auto mt-3 grid max-w-[280px] grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="relative aspect-square overflow-hidden rounded-lg bg-white/70 ring-1 ring-amber-200"
              >
                {shots[i] && (
                  <>
                    <img src={shots[i]} alt="" className="h-full w-full object-cover" />
                    {slotOverlays[i] && (
                      <img
                        src={slotOverlays[i]}
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <SelectButton
            onClick={startShooting}
            disabled={!ready || busy}
            label={busy ? "촬영 중…" : ready ? "4컷 촬영하기" : "불러오는 중…"}
            className="mt-4"
          />
        </WindowPanel>
      </div>
    </FestivalSelectBg>
  );
}
