import { describe, expect, it } from "vitest";
import { formatAbsoluteTime, formatCalendarDate, formatClockTime, formatRelativeTime, isSameCalendarDay } from "@/lib/format/date-format";

// 2026-11-11 22:40 KST
const NOW = new Date("2026-11-11T13:40:00Z");

describe("formatRelativeTime", () => {
  it("1분 안이면 방금", () => {
    expect(formatRelativeTime("2026-11-11T13:39:30Z", NOW)).toBe("방금");
    expect(formatRelativeTime("2026-11-11T13:41:00Z", NOW)).toBe("방금");
  });

  it("1시간 안이면 분 단위", () => {
    expect(formatRelativeTime("2026-11-11T13:37:00Z", NOW)).toBe("3분 전");
    expect(formatRelativeTime("2026-11-11T12:41:00Z", NOW)).toBe("59분 전");
  });

  it("같은 날이면 시간 단위", () => {
    expect(formatRelativeTime("2026-11-11T11:40:00Z", NOW)).toBe("2시간 전");
  });

  it("한국 시간으로 하루 전이면 어제", () => {
    // 2026-11-10 23:50 KST
    expect(formatRelativeTime("2026-11-10T14:50:00Z", NOW)).toBe("어제");
  });

  it("그보다 오래되면 날짜", () => {
    expect(formatRelativeTime("2026-11-09T03:00:00Z", NOW)).toBe("11월 9일");
  });

  it("다른 해면 연도를 붙인다", () => {
    expect(formatRelativeTime("2025-12-30T03:00:00Z", NOW)).toBe("2025년 12월 30일");
  });

  it("자정 직후에는 몇 시간 전이 아니라 어제", () => {
    const justAfterMidnight = new Date("2026-11-11T15:10:00Z"); // 11-12 00:10 KST
    expect(formatRelativeTime("2026-11-11T13:40:00Z", justAfterMidnight)).toBe("어제");
  });
});

describe("formatAbsoluteTime", () => {
  it("오후 시간", () => {
    expect(formatAbsoluteTime("2026-11-11T13:40:00Z", NOW)).toBe("11월 11일 오후 10:40");
  });

  it("오전 0시는 12시로", () => {
    expect(formatAbsoluteTime("2026-11-10T15:05:00Z", NOW)).toBe("11월 11일 오전 12:05");
  });

  it("정오는 오후 12시", () => {
    expect(formatAbsoluteTime("2026-11-11T03:00:00Z", NOW)).toBe("11월 11일 오후 12:00");
  });
});

describe("formatClockTime / formatCalendarDate / isSameCalendarDay", () => {
  it("시각만", () => {
    expect(formatClockTime("2026-11-11T00:07:00Z")).toBe("오전 9:07");
  });

  it("날짜만", () => {
    expect(formatCalendarDate("2026-11-11T13:40:00Z", NOW)).toBe("11월 11일");
  });

  it("한국 시간 기준으로 같은 날을 판단한다", () => {
    expect(isSameCalendarDay("2026-11-10T15:10:00Z", "2026-11-11T14:00:00Z")).toBe(true);
    expect(isSameCalendarDay("2026-11-10T14:50:00Z", "2026-11-10T15:10:00Z")).toBe(false);
  });
});
