// 장면(JPEG) 캡처의 순수 규칙: 언제 찍을지, 몇 장까지, 어떤 크기로, 어떤 이름(tMs)으로.
// 브라우저 API 없이 테스트할 수 있게 capture-session.ts에서 분리했다.

export type FrameReason = "interval" | "click";

export const MAX_FRAME_COUNT = 120;
export const CLICK_FRAME_RESERVE = 20;
const FRAME_LONG_SIDE = 1280;
export const FRAME_JPEG_QUALITY = 0.7;
const MIN_CLICK_FRAME_GAP_MS = 250;

export type FrameRecord = { tMs: number; reason: FrameReason };

// 주기 캡처가 상한을 다 쓰면 클릭 장면을 못 담으므로, 클릭용 몫을 남겨 둔다.
export function canCaptureFrame(frames: FrameRecord[], reason: FrameReason): boolean {
  if (frames.length >= MAX_FRAME_COUNT) {
    return false;
  }
  if (reason === "click") {
    return true;
  }
  const intervalCount = frames.filter((frame) => frame.reason === "interval").length;
  return intervalCount < MAX_FRAME_COUNT - CLICK_FRAME_RESERVE;
}

// 녹화 시작(t0) 기준 경과 시간. 시작 전 이벤트는 0으로 맞춘다.
export function getFrameTime(epochMs: number, t0: number): number {
  return Math.max(0, Math.round(epochMs - t0));
}

// 저장 경로가 frames/{tMs}-{reason}.jpg라 같은 이유·같은 시각이 겹치면 1ms씩 뒤로 민다.
export function getUniqueFrameTime(frames: FrameRecord[], reason: FrameReason, tMs: number): number {
  const takenTimes = new Set(frames.filter((frame) => frame.reason === reason).map((frame) => frame.tMs));
  let candidate = tMs;
  while (takenTimes.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

// 연타 클릭은 거의 같은 장면이라 최소 간격 안의 두 번째 클릭은 건너뛴다.
export function isClickTooSoon(frames: FrameRecord[], tMs: number): boolean {
  return frames.some((frame) => frame.reason === "click" && Math.abs(frame.tMs - tMs) < MIN_CLICK_FRAME_GAP_MS);
}

export function getScaledFrameSize(width: number, height: number, longSide = FRAME_LONG_SIDE): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(1, longSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function getFramePath(frame: FrameRecord): string {
  return `frames/${frame.tMs}-${frame.reason}.jpg`;
}
