import imgBravocone from "@/assets/bravocone.png";
import imgNougarbar from "@/assets/nougarbar.png";
import imgHodumaru from "@/assets/hodumaru.png";
import imgYomamte from "@/assets/yomamte.png";
import imgBabambar from "@/assets/babambar.png";
import imgTogether from "@/assets/together.jpg";
import imgPollapo from "@/assets/pollapo.png";
import imgTwinbar from "@/assets/twinbar.png";
import imgBananamilk from "@/assets/bananamilk.png";
import imgMelona from "@/assets/melona.png";

export type Fortune = { name: string; img: string; luck: number; message: string };

export const FORTUNES: Fortune[] = [
  {
    name: "부라보콘",
    img: imgBravocone,
    luck: 100,
    message:
      "오늘 하루 부라브라보 할 일이 가득하겠어요. 당신의 자신감이 멋진 결과를 만들어낼 거예요!",
  },
  {
    name: "누가바",
    img: imgNougarbar,
    luck: 85,
    message:
      "고소한 누가처럼 당신의 진심이 누군가의 마음을 녹일 거예요. 용기를 내 먼저 얘기해 보세요. 진심을 알아줄거예요.",
  },
  {
    name: "호두마루",
    img: imgHodumaru,
    luck: 80,
    message: "호두처럼 묵묵히 쌓아온 노력의 결실을 맛볼 때예요!",
  },
  {
    name: "요맘때",
    img: imgYomamte,
    luck: 70,
    message:
      "지친 마음에 달콤한 휴식이 필요해요. 가끔은 나를 위한 시간을 가져보세요. 새로운 에너지를 충전하면 더 좋은 일이 생길 거예요!",
  },
  {
    name: "바밤바",
    img: imgBabambar,
    luck: 60,
    message:
      "밤의 부드럽고 포슬함처럼 오늘 하루 조금 느려서 답답할 수도 있지만, 곧 좋은 소식이 기다리고 있겠어요!",
  },
  {
    name: "투게더",
    img: imgTogether,
    luck: 78,
    message: "함께라서 더 행복한 하루! 소중한 사람들과의 시간이 큰 행운을 가져다줘요.",
  },
  {
    name: "폴라포",
    img: imgPollapo,
    luck: 90,
    message: "폴라포처럼 끝~내주게 시원한 하루가 될 거예요!",
  },
  {
    name: "쌍쌍바",
    img: imgTwinbar,
    luck: 72,
    message: "사랑하는 사람과 잘될 수 있는 날이에요. 쌍쌍바 권해보는 거 어떠신가요?",
  },
  {
    name: "바나나맛우유",
    img: imgBananamilk,
    luck: 69,
    message: "막혔던 일이 시원하게 해결되고, 달달하고 기분 좋은 전환점이 찾아올 거예요.",
  },
  {
    name: "메로나",
    img: imgMelona,
    luck: 50,
    message:
      "주변이 시끄러운 하루 일 수 있어요. 오늘은 메론 본연의 맛이 담긴 메로나를 먹으면서 적당한 휴식이 필요한 날이겠어요..",
  },
];
