import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/format/duration-format";

describe("formatDuration", () => {
  it("분:초", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(65_900)).toBe("1:05");
  });

  it("한 시간이 넘으면 시:분:초", () => {
    expect(formatDuration(3_723_000)).toBe("1:02:03");
  });

  it("값이 없거나 음수면 0:00", () => {
    expect(formatDuration(null)).toBe("0:00");
    expect(formatDuration(-10)).toBe("0:00");
  });
});
