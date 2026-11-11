// 스토리보드 0장 전역 규칙을 상수로 옮긴 것. 색은 TDS(src/styles/tokens.css) 값, 강조색은 blue #3182F6 하나만 쓴다.
import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

export const C = {
  bg: "#F2F4F6",
  surface: "#FFFFFF",
  ink: "#191F28",
  accent: "#3182F6",
  blue50: "#E8F3FF",
  grey50: "#F9FAFB",
  grey100: "#F2F4F6",
  grey200: "#E5E8EB",
  grey300: "#D1D6DB",
  grey400: "#B0B8C1",
  grey500: "#8B95A1",
  grey600: "#6B7684",
  grey700: "#4E5968",
  grey800: "#333D4B",
  screen: "#F6F7F9",
} as const;

export const FONT = "Pretendard, 'Pretendard Variable', 'Apple SD Gothic Neo', sans-serif";

// 글자 토큰 (스토리보드 표)
export const T = {
  display: { fontWeight: 800, fontSize: 160, letterSpacing: -3 },
  title: { fontWeight: 700, fontSize: 112, letterSpacing: -2 },
  head: { fontWeight: 600, fontSize: 72, letterSpacing: -1 },
  rollOn: { fontWeight: 700, fontSize: 104 },
  rollOff: { fontWeight: 500, fontSize: 72 },
  cap: { fontWeight: 600, fontSize: 48 },
  sub: { fontWeight: 500, fontSize: 40 },
} as const;

// 모션 토큰
export const E_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const E_INOUT = Easing.bezier(0.65, 0, 0.35, 1);
export const LINEAR = (t: number) => t;
export const SPR_POP = { damping: 15, stiffness: 200, mass: 0.8 };
export const SPR_SOFT = { damping: 20, stiffness: 170, mass: 1 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** from→to 를 프레임 a→b 동안 easing으로 보간. 범위 밖은 고정. */
export function tw(f: number, a: number, b: number, from: number, to: number, easing: (t: number) => number = E_OUT) {
  if (b <= a) return f < a ? from : to;
  return interpolate(f, [a, b], [from, to], { ...clamp, easing });
}

/** 여러 구간 키프레임. keys = [[frame, value], ...]. 구간마다 easing. */
export function kf(f: number, keys: [number, number][], easing: (t: number) => number = E_INOUT) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [fa, va] = keys[i - 1];
    const [fb, vb] = keys[i];
    if (f <= fb) return tw(f, fa, fb, va, vb, easing);
  }
  return keys[keys.length - 1][1];
}

export function pop(f: number, start: number) {
  return spring({ frame: f - start, fps: FPS, config: SPR_POP });
}
export function soft(f: number, start: number) {
  return spring({ frame: f - start, fps: FPS, config: SPR_SOFT });
}

/** 두 hex 색을 섞는다. t=0이면 a. */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = Math.max(0, Math.min(1, t));
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** 결정적 의사 난수 (시드 고정). */
export function rand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// 기본 UI 레이어: 1440x900 화면을 1.0667배 해서 1536x960, 화면 가운데.
export const UI = { w: 1440, h: 900, s: 1536 / 1440, x: 192, y: 60 };
/** UI 좌표(1440x900) → 프레임 좌표(1920x1080) */
export function ui(x: number, y: number): [number, number] {
  return [UI.x + x * UI.s, UI.y + y * UI.s];
}
