// 영상 한 장(1920x1080) 안에서 앱 화면과 캡션이 놓이는 자리. render-cards와 assemble이 같이 쓴다.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const OUTPUT_WIDTH = 1920;
export const OUTPUT_HEIGHT = 1080;
export const FRAMES_PER_SECOND = 30;

// 앱 화면은 16:9를 유지하고, 아래에 캡션 자리를 남긴다(캡션이 UI를 가리지 않게).
export const SCREEN = { x: 176, y: 56, width: 1568, height: 882, radius: 16 };

// 캡션 알약의 세로 중심. 화면 아래 여백(938~1080)의 가운데.
export const CAPTION_CENTER_Y = 1009;

export const BACKGROUND_COLOR = "#F2F4F6";

export const DEMO_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECT_DIRECTORY = path.resolve(DEMO_DIRECTORY, "..");
export const CARDS_DIRECTORY = path.join(DEMO_DIRECTORY, "cards");
export const SCENES_DIRECTORY = path.join(DEMO_DIRECTORY, "scenes");
