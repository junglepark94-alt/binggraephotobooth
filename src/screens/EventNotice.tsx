import { FestivalSelectBg, SelectButton } from "@/components/common";
import { EVENT_NOTICE_BODY, EVENT_NOTICE_TITLE, KAKAO_CHAT_URL } from "@/data/event";

// 이벤트 공지 화면 — 지도의 게시판 핫스팟과 결과 화면의 "이벤트 응모하기"가 함께 들어온다.
// 공지 문구를 보여주고, 카톡 1:1 채팅방으로 넘겨주는 것이 전부다 (서버 통신 없음).
export function EventNotice({ onBack }: { onBack: () => void }) {
  const linkReady = KAKAO_CHAT_URL.trim().length > 0;

  return (
    <FestivalSelectBg onBack={onBack}>
      <div className="space-y-3 px-4 pb-10 pt-1">
        <h2 className="text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          {EVENT_NOTICE_TITLE}
        </h2>

        <div className="festival-card p-5">
          {EVENT_NOTICE_BODY.length > 0 ? (
            <div className="space-y-2.5">
              {EVENT_NOTICE_BODY.map((line, i) => (
                <p
                  key={i}
                  className="whitespace-pre-line text-[13px] leading-relaxed text-amber-900"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="text-4xl">📝</div>
              <p className="mt-2 text-sm font-bold text-amber-900">공지문을 준비하고 있어요</p>
              <p className="mt-1 text-xs text-muted-foreground">곧 이벤트 안내를 올려드릴게요!</p>
            </div>
          )}
        </div>

        <SelectButton
          label="카톡으로 응모하기"
          disabled={!linkReady}
          onClick={() => window.open(KAKAO_CHAT_URL, "_blank", "noopener,noreferrer")}
        />
        {!linkReady && (
          <p className="text-center text-xs text-muted-foreground">응모 링크는 곧 열려요!</p>
        )}
      </div>
    </FestivalSelectBg>
  );
}
