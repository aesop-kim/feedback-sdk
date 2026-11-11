// 녹화 길이 "0:42", 메시지 시각 "오후 10:40" / "11월 11일 오후 10:40".

export function formatRecordingDuration(durationMs: number | null): string {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatClock(date: Date): string {
  const hours = date.getHours();
  const meridiem = hours < 12 ? "오전" : "오후";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${meridiem} ${displayHours}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatMessageTime(isoTime: string, now: Date = new Date()): string {
  const date = new Date(isoTime);
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return formatClock(date);
  }
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${formatClock(date)}`;
}

export function getMinuteKey(isoTime: string): string {
  return isoTime.slice(0, 16);
}
