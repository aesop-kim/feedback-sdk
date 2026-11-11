// 관리자 화면의 날짜·시간 표기. 서버·브라우저 시간대와 상관없이 한국 시간 기준으로 보여준다.

const TIME_ZONE = "Asia/Seoul";
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

type CalendarDate = { year: number; month: number; day: number };

const calendarFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const clockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
});

function getCalendarDate(date: Date): CalendarDate {
  const parts = calendarFormatter.formatToParts(date);
  const findPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: findPart("year"), month: findPart("month"), day: findPart("day") };
}

function getDayNumber({ year, month, day }: CalendarDate): number {
  return Math.round(Date.UTC(year, month - 1, day) / (24 * HOUR_MS));
}

function formatMonthDay(date: Date, now: Date): string {
  const calendar = getCalendarDate(date);
  const monthDay = `${calendar.month}월 ${calendar.day}일`;
  if (calendar.year !== getCalendarDate(now).year) {
    return `${calendar.year}년 ${monthDay}`;
  }
  return monthDay;
}

// "방금", "3분 전", "2시간 전", "어제", "11월 9일" (다른 해면 "2025년 11월 9일")
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const date = new Date(value);
  const elapsedMs = now.getTime() - date.getTime();
  if (elapsedMs < MINUTE_MS) {
    return "방금";
  }
  const dayGap = getDayNumber(getCalendarDate(now)) - getDayNumber(getCalendarDate(date));
  if (elapsedMs < HOUR_MS) {
    return `${Math.floor(elapsedMs / MINUTE_MS)}분 전`;
  }
  if (dayGap === 0) {
    return `${Math.floor(elapsedMs / HOUR_MS)}시간 전`;
  }
  if (dayGap === 1) {
    return "어제";
  }
  return formatMonthDay(date, now);
}

// "11월 11일 오후 10:40"
export function formatAbsoluteTime(value: string | Date, now: Date = new Date()): string {
  return `${formatMonthDay(new Date(value), now)} ${formatClockTime(value)}`;
}

// 대화 안 말풍선 옆 시각: "오후 10:40"
export function formatClockTime(value: string | Date): string {
  const parts = clockFormatter.formatToParts(new Date(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${displayHour}:${minute}`;
}

// 대화 안 날짜 구분선: "11월 11일" (다른 해면 연도 포함)
export function formatCalendarDate(value: string | Date, now: Date = new Date()): string {
  return formatMonthDay(new Date(value), now);
}

// 두 시각이 한국 시간 기준 같은 날인지
export function isSameCalendarDay(first: string | Date, second: string | Date): boolean {
  return getDayNumber(getCalendarDate(new Date(first))) === getDayNumber(getCalendarDate(new Date(second)));
}
