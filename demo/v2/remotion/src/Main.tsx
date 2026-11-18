// 전체 타임라인: 스토리보드 1장 샷 표(25샷, 3120f)와 SFX 큐.
import type { ComponentType } from "react";
import { AbsoluteFill, Audio, Sequence, getStaticFiles, interpolate, staticFile } from "remotion";
import { C } from "./theme";
import { S01, S02, S03, S04, S05, S06, CARD_T } from "./scenes/Opener";
import { S07, S08, S09, S10, S11, S12, S13 } from "./scenes/Record";
import { S14, S15, S16 } from "./scenes/Ai";
import { S17, S18, S19, S20 } from "./scenes/Question";
import { S21, S22, S23, S24, S25 } from "./scenes/Outro";
import { S22b, CAPTURE_LEN } from "./scenes/Capture";

// [컴포넌트, 시작 프레임, 끝 프레임]
export const SHOTS: [ComponentType, number, number][] = [
  [S01, 0, 90],
  [S02, 90, 180],
  [S03, 180, 210],
  [S04, 210, 390],
  [S05, 390, 465],
  [S06, 465, 555],
  [S07, 555, 660],
  [S08, 660, 750],
  [S09, 750, 810],
  [S10, 810, 960],
  [S11, 960, 1140],
  [S12, 1140, 1320],
  [S13, 1320, 1395],
  [S14, 1395, 1500],
  [S15, 1500, 1680],
  [S16, 1680, 1800],
  [S17, 1800, 1965],
  [S18, 1965, 2010],
  [S19, 2010, 2205],
  [S20, 2205, 2310],
  [S21, 2310, 2445],
  [S22, 2445, 2595],
  [S22b, 2595, 2595 + CAPTURE_LEN],
  [S23, 2595 + CAPTURE_LEN, 2790 + CAPTURE_LEN],
  [S24, 2790 + CAPTURE_LEN, 2925 + CAPTURE_LEN],
  [S25, 2925 + CAPTURE_LEN, 3120 + CAPTURE_LEN],
];
export const TOTAL = 3120 + CAPTURE_LEN;
/** 캡처 장면(S22b)이 2595에 들어가면서 그 뒤 큐는 CAPTURE_LEN만큼 밀린다 */
const shift = (g: number) => (g >= 2595 ? g + CAPTURE_LEN : g);

// SFX 큐 (전역 프레임, 파일, 볼륨). 스토리보드 샷별 SFX 줄을 옮김.
const every = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const CUES: [number, string, number][] = [
  // S01
  [6, "tick", 0.5],
  [14, "tick", 0.5],
  [22, "pop-big", 0.6],
  // S02
  [90, "whoosh", 0.6],
  [120, "bell", 0.45],
  // S03
  [180, "hit", 0.7],
  [200, "whip", 0.6],
  // S04: 카드마다 "똑"(피치 상승), 99+ 이중 블립
  ...CARD_T.map((tt, i): [number, string, number] => [210 + tt, `drop-${Math.min(5, Math.floor(i / 2))}`, 0.42]),
  [370, "blip2", 0.5],
  // S05: 2음절에 하나씩 키 클릭
  ...every(394, 416, 4).map((g): [number, string, number] => [g, "key", 0.5]),
  ...every(420, 436, 4).map((g): [number, string, number] => [g, "key", 0.5]),
  // S06
  [467, "bloop", 0.6],
  // S07
  [555, "whoosh", 0.45],
  [593, "click", 0.6],
  [601, "swish", 0.5],
  // S08
  [666, "tick-soft", 0.6],
  [681, "tick-soft", 0.6],
  [696, "tick-soft", 0.6],
  [734, "click", 0.6],
  // S09
  [754, "rec-start", 0.5],
  // S10
  [868, "click", 0.6],
  [904, "click-hard", 0.6],
  // S11, S12
  [960, "whip", 0.4],
  [1140, "whip", 0.5],
  // S13
  [1350, "click", 0.6],
  [1352, "rec-stop", 0.5],
  [1364, "send", 0.6],
  // S14
  [1425, "tick-soft", 0.5],
  [1449, "tick-soft", 0.5],
  [1465, "tick-soft", 0.5],
  [1475, "tick-soft", 0.5],
  [1481, "chime", 0.45],
  // S15
  [1510, "thud", 0.5],
  [1518, "thud", 0.5],
  [1526, "thud", 0.5],
  [1544, "blip", 0.4],
  // S16
  [1686, "swish", 0.5],
  // S17
  [1848, "tick-soft", 0.5],
  [1854, "tick-soft", 0.5],
  [1860, "tick-soft", 0.5],
  [1866, "tick-soft", 0.5],
  [1920, "click", 0.6],
  [1930, "send", 0.6],
  // S18
  [1969, "whoosh-long", 0.6],
  [1991, "thud", 0.5],
  // S19
  [2016, "swish", 0.4],
  [2096, "click", 0.6],
  [2100, "drop-3", 0.4],
  [2170, "click", 0.6],
  [2172, "send", 0.6],
  // S20
  [2209, "drop-2", 0.45],
  [2235, "pop", 0.5],
  [2237, "chime", 0.45],
  // S21
  [2359, "click", 0.6],
  [2376, "click", 0.6],
  [2380, "tick", 0.45],
  [2406, "tick", 0.45],
  [2416, "tick", 0.45],
  [2428, "chime", 0.45],
  // S22
  [2451, "blip", 0.45],
  [2465, "click", 0.6],
  [2479, "drop-1", 0.4],
  [2487, "drop-2", 0.4],
  [2495, "drop-3", 0.4],
  [2585, "whip", 0.35],
  // S22b 캡처 (장면 프레임 + 2595, shift 전 좌표로 둔다 → 아래에서 따로 더함)
  // S23
  [2640, "tick-soft", 0.5],
  [2670, "tick-soft", 0.5],
  [2700, "tick-soft", 0.5],
  [2730, "tick-soft", 0.5],
  [2760, "chime", 0.45],
  // S24
  [2790, "swish", 0.35],
  ...every(2802, 2818, 4).map((g): [number, string, number] => [g, "key", 0.5]),
  [2824, "pop-big", 0.6],
  // S25
  [2929, "bloop", 0.55],
];

// 대사(S10~S12): narration.wav 구간. 파일이 없으면(저장소 밖 원본) 건너뛴다.
const NARRATION: [number, string][] = [
  [825, "n1"],
  [966, "n2"],
  [1053, "n3"],
  [1152, "n4"],
  [1232, "n5"],
];

// 캡처 장면 효과음(전역 프레임)
const CAPTURE_CUES: [number, string, number][] = [
  [2595 + 44, "click", 0.6],
  [2595 + 52, "swish", 0.4],
  [2595 + 100, "click", 0.5],
  [2595 + 136, "pop", 0.5],
  [2595 + 156, "whoosh", 0.35],
  ...[182, 188, 194, 200, 206].map((g): [number, string, number] => [2595 + g, "key", 0.4]),
  [2595 + 222, "send", 0.55],
  [2595 + 230, "blip", 0.4],
  [2595 + 268, "click", 0.6],
  [2595 + 278, "chime", 0.45],
];

export function Main() {
  const files = new Set(getStaticFiles().map((s) => s.name));
  const hasBgm = files.has("sfx/bgm.wav");
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {SHOTS.map(([Comp, a, b], i) => (
        <Sequence key={i} from={a} durationInFrames={b - a} name={`S${String(i + 1).padStart(2, "0")}`}>
          <Comp />
        </Sequence>
      ))}
      {[...CUES.map(([g, n, v]): [number, string, number] => [shift(g), n, v]), ...CAPTURE_CUES].map(([g, name, vol], i) => (
        <Sequence key={`sfx-${i}`} from={g} durationInFrames={45} name={`sfx ${name}`} layout="none">
          <Audio src={staticFile(`sfx/${name}.wav`)} volume={vol} />
        </Sequence>
      ))}
      {NARRATION.filter(([, id]) => files.has(`audio/${id}.wav`)).map(([g, id]) => (
        <Sequence key={id} from={g} durationInFrames={120} name={`대사 ${id}`} layout="none">
          <Audio src={staticFile(`audio/${id}.wav`)} volume={1} />
        </Sequence>
      ))}
      {hasBgm ? <Audio src={staticFile("sfx/bgm.wav")} volume={(g) => bgmVolume(g)} /> : null}
    </AbsoluteFill>
  );
}

/** 배경음악 볼륨: 효과음·자막이 묻히지 않게 낮게, 끝에서 사라짐 */
function bgmVolume(g: number) {
  return interpolate(g, [0, 20, TOTAL - 45, TOTAL], [0, 0.32, 0.32, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}
