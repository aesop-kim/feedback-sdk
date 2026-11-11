import { describe, expect, it } from "vitest";
import { getRms, isSilentRms, toMicrophoneLevel } from "@/lib/recording/request-microphone";

describe("마이크 음량", () => {
  it("RMS를 계산한다", () => {
    expect(getRms(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5, 5);
    expect(getRms(new Float32Array([]))).toBe(0);
  });

  it("무음이면 막대 0, 큰 소리면 1까지", () => {
    expect(toMicrophoneLevel(0)).toBe(0);
    expect(toMicrophoneLevel(0.0004)).toBe(0);
    expect(toMicrophoneLevel(0.02)).toBeGreaterThan(0.4);
    expect(toMicrophoneLevel(0.5)).toBe(1);
  });

  it("무음 기준은 0.0005 미만", () => {
    expect(isSilentRms(0.0004)).toBe(true);
    expect(isSilentRms(0.002)).toBe(false);
  });
});
