// 이벤트 응모 안내 — 공지 문구와 카톡 링크를 한곳에 모아둔다.
// 문구가 바뀌면 이 파일만 고치면 되고 화면(EventNotice)은 건드릴 필요가 없다.

// 카카오톡 1:1 채팅방 URL. 비어 있으면 응모 버튼이 비활성화되고 "준비 중" 안내가 뜬다.
export const KAKAO_CHAT_URL = "";

export const EVENT_NOTICE_TITLE = "이벤트 안내";

// 한 줄에 한 문단. 줄바꿈(\n)은 그대로 유지된다. 비어 있으면 "준비 중" 안내가 대신 표시된다.
export const EVENT_NOTICE_BODY: string[] = [];
