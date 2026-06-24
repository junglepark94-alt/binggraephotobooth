import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { type FrameKey } from "@/data/frames";
import { type Inventory, type Step, EMPTY_INVENTORY } from "@/lib/game";
import { MainScreen } from "@/screens/MainScreen";
import { LetterScreen } from "@/screens/LetterScreen";
import { FestivalMap } from "@/screens/FestivalMap";
import { SelectScreen } from "@/screens/SelectScreen";
import { ShootScreen } from "@/screens/ShootScreen";
import { ResultScreen } from "@/screens/ResultScreen";
import { DrawScreen } from "@/screens/DrawScreen";
import { EndScreen } from "@/screens/EndScreen";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "빙그레 네컷 — 인생네컷 포토부스" },
      {
        name: "description",
        content: "빙그레 프레임을 골라 브라우저에서 바로 네 컷을 찍어보세요.",
      },
    ],
  }),
});

// 첫 방문(캐시 없음) 시 화면 전환마다 이미지가 뒤늦게 뜨는 것을 막기 위해,
// 앱 진입 직후 모든 에셋을 백그라운드로 미리 받아 브라우저 캐시를 데운다.
// (메인 화면을 보는 몇 초 동안 받아두므로 사용자는 대기를 느끼지 않는다.)
function usePreloadAssets() {
  useEffect(() => {
    const mods = import.meta.glob("../assets/*.{png,jpg,jpeg}", {
      eager: true,
      query: "?url",
      import: "default",
    }) as Record<string, string>;
    const urls = Object.values(mods);
    const t = window.setTimeout(() => {
      for (const url of urls) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, []);
}

function App() {
  usePreloadAssets();
  const [step, setStep] = useState<Step>("main");
  const [frameKey, setFrameKey] = useState<FrameKey | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [inv, setInv] = useState<Inventory>(EMPTY_INVENTORY);
  const [mapIntroSeen, setMapIntroSeen] = useState(false);

  const restart = () => {
    setShots([]);
    setFrameKey(null);
    setInv(EMPTY_INVENTORY);
    setMapIntroSeen(false);
    setStep("main");
  };

  return (
    <div className="min-h-[100dvh] text-foreground">
      <div className="mx-auto w-full max-w-md px-0 pb-0 pt-0 md:max-w-3xl lg:max-w-6xl md:px-8 md:pb-10 md:pt-12">
        {step === "main" && <MainScreen onStart={() => setStep("letter")} />}
        {step === "letter" && (
          <LetterScreen onBack={() => setStep("main")} onNext={() => setStep("map")} />
        )}
        {step === "map" && (
          <FestivalMap
            inv={inv}
            setInv={setInv}
            onPhoto={() => setStep("select")}
            onDraw={() => setStep("draw")}
            onEnd={() => setStep("end")}
            introSeen={mapIntroSeen}
            onIntroSeen={() => setMapIntroSeen(true)}
          />
        )}
        {step === "select" && (
          <SelectScreen
            value={frameKey}
            onChange={setFrameKey}
            onBack={() => setStep("map")}
            onNext={() => frameKey && setStep("shoot")}
          />
        )}
        {step === "shoot" && frameKey && (
          <ShootScreen
            frameKey={frameKey}
            onBack={() => setStep("select")}
            onDone={(s) => {
              setShots(s);
              setInv((v) => ({ ...v, photo: true }));
              setStep("result");
            }}
          />
        )}
        {step === "result" && frameKey && (
          <ResultScreen
            frameKey={frameKey}
            shots={shots}
            onRetake={() => {
              setShots([]);
              setStep("shoot");
            }}
            onChangeFrame={() => {
              setShots([]);
              setStep("select");
            }}
            onBackToMap={() => setStep("map")}
          />
        )}
        {step === "draw" && (
          <DrawScreen onBack={() => setStep("map")} onEnd={() => setStep("end")} />
        )}
        {step === "end" && <EndScreen onRestart={restart} />}
      </div>
    </div>
  );
}
