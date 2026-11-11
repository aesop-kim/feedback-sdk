import { Composition, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";
import { Main, TOTAL } from "./Main";
import { FPS, H, W } from "./theme";

// Pretendard 가변 폰트를 로컬에서 읽는다(jsdelivr pretendard@1.3.9에서 받은 파일).
loadFont({
  family: "Pretendard",
  url: staticFile("fonts/PretendardVariable.woff2"),
  weight: "45 920",
  format: "woff2",
});

export const Root = () => (
  <Composition id="LatticeDemoV2" component={Main} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
