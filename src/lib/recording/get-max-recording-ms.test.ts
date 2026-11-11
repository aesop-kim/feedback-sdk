import { describe, expect, it } from "vitest";
import { getMaxRecordingMs } from "@/lib/recording/get-max-recording-ms";
import { MAX_RECORDING_MS } from "@/lib/validation/api-schemas";

describe("getMaxRecordingMs", () => {
  it("값이 없으면 기본 3분이다", () => {
    expect(getMaxRecordingMs(undefined, false)).toBe(MAX_RECORDING_MS);
  });

  it("개발·테스트 서버에서는 더 짧은 값으로 줄일 수 있다", () => {
    expect(getMaxRecordingMs("5000", false)).toBe(5_000);
  });

  it("운영에서는 값을 무시한다", () => {
    expect(getMaxRecordingMs("5000", true)).toBe(MAX_RECORDING_MS);
  });

  it("숫자가 아니거나, 너무 짧거나, 3분보다 길면 기본값을 쓴다", () => {
    expect(getMaxRecordingMs("abc", false)).toBe(MAX_RECORDING_MS);
    expect(getMaxRecordingMs("1.5", false)).toBe(MAX_RECORDING_MS);
    expect(getMaxRecordingMs("999", false)).toBe(MAX_RECORDING_MS);
    expect(getMaxRecordingMs(String(MAX_RECORDING_MS + 1), false)).toBe(MAX_RECORDING_MS);
  });
});
