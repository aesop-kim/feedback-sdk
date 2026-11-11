// Broadcast는 "무언가 바뀌었다"는 신호만 보낸다. 내용은 받는 쪽이 인증된 API로 다시 가져온다.
// anon key로 누가 위조 신호를 보내도 다시 가져오기만 할 뿐, 위조한 내용은 화면에 나오지 않는다.

export type RealtimeSignalType =
  | "message.created"
  | "recording.updated"
  | "issue.updated"
  | "clarification.approved"
  | "clarification.answered"
  | "conversation.updated";

export type RealtimeSignal = { type: RealtimeSignalType; id: string };

export const REALTIME_EVENT = "signal";

export function getConversationChannelName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function getAdminChannelName(projectId: string): string {
  return `admin:${projectId}`;
}

export function isRealtimeSignal(value: unknown): value is RealtimeSignal {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.type === "string" && typeof candidate.id === "string";
}
