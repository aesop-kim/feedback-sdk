import { describe, expect, it } from "vitest";
import {
  CLICK_FRAME_RESERVE,
  MAX_FRAME_COUNT,
  canCaptureFrame,
  getFramePath,
  getFrameTime,
  getScaledFrameSize,
  getUniqueFrameTime,
  isClickTooSoon,
  type FrameRecord,
} from "@/lib/recording/frame-capturer";

function createFrames(count: number, reason: FrameRecord["reason"]): FrameRecord[] {
  return Array.from({ length: count }, (_, index) => ({ tMs: index * 1000, reason }));
}

describe("frame-capturer", () => {
  it("전체 상한 120장을 넘기지 않는다", () => {
    expect(canCaptureFrame(createFrames(MAX_FRAME_COUNT - 1, "click"), "click")).toBe(true);
    expect(canCaptureFrame(createFrames(MAX_FRAME_COUNT, "click"), "click")).toBe(false);
  });

  it("주기 캡처는 클릭용 몫을 남기고 멈춘다", () => {
    const intervalFrames = createFrames(MAX_FRAME_COUNT - CLICK_FRAME_RESERVE, "interval");
    expect(canCaptureFrame(intervalFrames, "interval")).toBe(false);
    expect(canCaptureFrame(intervalFrames, "click")).toBe(true);
  });

  it("경과 시간은 t0 기준이고 음수는 0으로 맞춘다", () => {
    expect(getFrameTime(10_500.4, 10_000)).toBe(500);
    expect(getFrameTime(9_000, 10_000)).toBe(0);
  });

  it("같은 이유·같은 시각이 겹치면 1ms씩 민다", () => {
    const frames: FrameRecord[] = [
      { tMs: 100, reason: "click" },
      { tMs: 101, reason: "click" },
      { tMs: 100, reason: "interval" },
    ];
    expect(getUniqueFrameTime(frames, "click", 100)).toBe(102);
    expect(getUniqueFrameTime(frames, "interval", 101)).toBe(101);
  });

  it("짧은 간격의 연타 클릭은 건너뛴다", () => {
    const frames: FrameRecord[] = [{ tMs: 1_000, reason: "click" }];
    expect(isClickTooSoon(frames, 1_100)).toBe(true);
    expect(isClickTooSoon(frames, 1_400)).toBe(false);
  });

  it("긴 변을 1280px에 맞추고 키우지는 않는다", () => {
    expect(getScaledFrameSize(2560, 1440)).toEqual({ width: 1280, height: 720 });
    expect(getScaledFrameSize(900, 1600)).toEqual({ width: 720, height: 1280 });
    expect(getScaledFrameSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(getScaledFrameSize(0, 600)).toEqual({ width: 0, height: 0 });
  });

  it("저장 경로는 서버 규약과 같다", () => {
    expect(getFramePath({ tMs: 4200, reason: "click" })).toBe("frames/4200-click.jpg");
  });
});
