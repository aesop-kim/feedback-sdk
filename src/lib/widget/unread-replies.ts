// 런처 배지용 안 읽은 답장 수. 고객이 마지막으로 본 메시지 시각(lastReadAt)을 위젯 저장소에 두어 새로고침해도 유지한다.
import type { ChatMessage } from "@/types/feedback";

type MessageTime = Pick<ChatMessage, "sender" | "createdAt">;

export function getLastReadStorageKey(projectKey: string, userId: string): string {
  return `lattice-feedback:${projectKey}:${userId}:last-read-at`;
}

// 고객 자신이 보낸 것을 뺀 메시지(관리자 답장, 시스템 안내) 가운데 lastReadAt보다 뒤에 온 것.
export function countUnreadReplies(messages: MessageTime[], lastReadAt: string | null): number {
  if (!lastReadAt) {
    return 0;
  }
  const lastReadTime = Date.parse(lastReadAt);
  return messages.filter((message) => message.sender !== "user" && Date.parse(message.createdAt) > lastReadTime).length;
}

// 서버 시각끼리 비교하려고 기기 시계 대신 가장 늦은 메시지 시각을 읽은 시각으로 쓴다.
export function findLatestMessageTime(messages: MessageTime[]): string | null {
  let latest: string | null = null;
  for (const message of messages) {
    if (!latest || Date.parse(message.createdAt) > Date.parse(latest)) {
      latest = message.createdAt;
    }
  }
  return latest;
}

export function findStoredLastReadAt(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    // 서드파티 저장소가 막힌 환경이면 새로고침 때 배지를 잃는 것으로 끝낸다.
    return null;
  }
}

export function storeLastReadAt(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 저장하지 못해도 이번 화면 안에서는 메모리 값으로 계속 센다.
  }
}
