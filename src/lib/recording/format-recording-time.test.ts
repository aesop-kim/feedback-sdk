import { describe, expect, it } from "vitest";
import { formatMessageTime, formatRecordingDuration } from "@/lib/recording/format-recording-time";

describe("format-recording-time", () => {
  it("녹화 길이를 분:초로 쓴다", () => {
    expect(formatRecordingDuration(42_000)).toBe("0:42");
    expect(formatRecordingDuration(180_000)).toBe("3:00");
    expect(formatRecordingDuration(65_400)).toBe("1:05");
    expect(formatRecordingDuration(null)).toBe("0:00");
  });

  it("오늘이면 시각만, 아니면 날짜까지 쓴다", () => {
    const now = new Date(2026, 10, 11, 23, 0);
    expect(formatMessageTime(new Date(2026, 10, 11, 22, 40).toISOString(), now)).toBe("오후 10:40");
    expect(formatMessageTime(new Date(2026, 10, 11, 0, 5).toISOString(), now)).toBe("오전 12:05");
    expect(formatMessageTime(new Date(2026, 10, 10, 9, 3).toISOString(), now)).toBe("11월 10일 오전 9:03");
  });
});
