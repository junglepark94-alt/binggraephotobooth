// 이벤트 응모 안내 — 공지 문구와 카톡 링크를 한곳에 모아둔다.
// 문구가 바뀌면 이 파일만 고치면 되고 화면(EventNotice)은 건드릴 필요가 없다.
import prizeCeramic from "@/assets/prize_ceramic.webp";

// 카카오톡 오픈채팅 URL. 비어 있으면 응모 버튼이 비활성화되고 "준비 중" 안내가 뜬다.
// (공지 본문에는 생 URL을 넣지 않는다 — 이 링크가 곧 응모 버튼이다.)
export const KAKAO_CHAT_URL = "https://open.kakao.com/o/sYHIF7Di";

export const EVENT_NOTICE_TITLE = "빙그레네컷 이벤트";

export const EVENT_NOTICE_INTRO = "나만의 빙그레네컷을 촬영하고 특별한 선물도 받아보세요!";

// 구획별 소제목 + 줄 목록(+ 선택적 사진). 비어 있으면 "준비 중" 안내가 대신 표시된다.
export const EVENT_NOTICE_SECTIONS: {
  heading: string;
  lines: string[];
  image?: { src: string; alt: string };
}[] = [
  {
    heading: "참여 방법",
    lines: [
      "1. 마음에 드는 제품 프레임을 선택해 빙그레네컷을 촬영해 주세요.",
      "2. 완성된 사진을 저장해 주세요.",
      "3. 아래 카카오톡 1:1 오픈채팅에 사진을 올리면 참여 완료!",
    ],
  },
  {
    heading: "이벤트 경품",
    lines: ["우수작 20명: 이도온화 바나나맛우유 도자기", "참가자 전원: 바나나맛우유 기프티콘"],
    // 빙그레 배포 보도사진(빙그레×이도온화 도자기 식기세트) — 원본 JPEG를 WebP로 변환해 넣었다.
    image: { src: prizeCeramic, alt: "이도온화 바나나맛우유 도자기 식기세트" },
  },
  {
    heading: "이벤트 기간",
    lines: ["8월 3일(월) ~ 8월 14일(금)"],
  },
  {
    heading: "안내 사항",
    lines: [
      "이벤트는 빙그레 임직원을 대상으로 진행됩니다.",
      "1인 중복 참여 가능합니다.",
      "당첨자는 제출한 사진을 기준으로 선정하며, 개별 안내 예정입니다.",
      "참여 시 사진 확인 및 경품 발송을 위해 필요한 정보가 수집될 수 있습니다.",
    ],
  },
];
