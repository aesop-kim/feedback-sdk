// "수정을 반영했어요" 안내 가운데 고객에게 재확인 녹화 버튼을 붙일 메시지를 고른다.
import type { ChatMessage, ReverifyRequest } from "@/types/feedback";

const REVERIFY_BODY_PATTERN = /수정을 반영했어요/;
const QUOTED_TITLE_PATTERN = /‘(.+)’/;

export type ReverifyPrompt = { messageId: string; issueId: string | null; title: string };

type PromptMessage = Pick<ChatMessage, "id" | "sender" | "type" | "body">;

function isReverifyMessage(message: PromptMessage): boolean {
  return message.sender === "system" && REVERIFY_BODY_PATTERN.test(message.body ?? "");
}

function findQuotedTitle(body: string | null): string {
  return body?.match(QUOTED_TITLE_PATTERN)?.[1] ?? "";
}

// reverifyRequest: GET /api/messages가 주는 열린 재확인 요청. null이면 요청 없음,
// undefined면 그 필드를 모르는 서버라 안내 메시지만 보고 이슈 연결 없이 버튼을 붙인다.
export function findReverifyPrompt(messages: PromptMessage[], reverifyRequest: ReverifyRequest | null | undefined): ReverifyPrompt | null {
  if (reverifyRequest === null) {
    return null;
  }
  const lastIndex = messages.findLastIndex(
    (message) => isReverifyMessage(message) && (!reverifyRequest || findQuotedTitle(message.body) === reverifyRequest.title),
  );
  const fallbackIndex = reverifyRequest ? messages.findLastIndex(isReverifyMessage) : -1;
  const promptIndex = lastIndex >= 0 ? lastIndex : fallbackIndex;
  if (promptIndex < 0) {
    return null;
  }
  const promptMessage = messages[promptIndex];
  if (reverifyRequest) {
    return { messageId: promptMessage.id, issueId: reverifyRequest.issueId, title: reverifyRequest.title };
  }
  // 이슈 연결을 모르는 서버: 안내 뒤에 고객이 이미 녹화를 보냈으면 버튼을 거둔다.
  const hasRecordedAfter = messages.slice(promptIndex + 1).some((message) => message.sender === "user" && message.type === "recording");
  if (hasRecordedAfter) {
    return null;
  }
  return { messageId: promptMessage.id, issueId: null, title: findQuotedTitle(promptMessage.body) };
}
