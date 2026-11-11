import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { getStatusAfterAnswer } from "@/lib/feedback/issue-status";
import { respondError, respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { findFirstRelation } from "@/lib/supabase/first-relation";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { answerClarificationSchema } from "@/lib/validation/api-schemas";
import type { IssueStatus } from "@/types/feedback";

const ALREADY_ANSWERED_MESSAGE = "이미 답한 질문이에요.";

export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const conversation = await findAuthorizedConversation(request);
  if (!conversation) {
    return respondUnauthorized();
  }
  const parsed = answerClarificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const { cardId } = await params;
  const supabase = getServerSupabase();

  const { data: card } = await supabase
    .from("clarification_cards")
    .select("id, issue_id, options, approved_at, answered_at, issues!inner(conversation_id, status)")
    .eq("id", cardId)
    .maybeSingle();
  const cardIssue = findFirstRelation<{ conversation_id: string; status: IssueStatus }>(card?.issues);
  if (!card || !card.approved_at || cardIssue?.conversation_id !== conversation.conversationId) {
    return respondError(404, "질문을 찾을 수 없어요.");
  }
  if (card.answered_at) {
    return respondError(409, ALREADY_ANSWERED_MESSAGE);
  }

  const options = card.options as { id: string; label: string }[];
  const selectedOption = options.find((option) => option.id === parsed.data.optionId);
  if (parsed.data.optionId && !selectedOption) {
    return respondError(400, "선택지를 다시 골라 주세요.");
  }

  // 아직 답하지 않은 카드만 바꾼다. 동시에 여러 번 보내도 이 update를 따낸 요청 하나만 답변·메시지를 만든다.
  const answeredAt = new Date().toISOString();
  const { data: claimedRows } = await supabase
    .from("clarification_cards")
    .update({ answered_at: answeredAt })
    .eq("id", cardId)
    .is("answered_at", null)
    .select("id");
  if (!claimedRows || claimedRows.length === 0) {
    return respondError(409, ALREADY_ANSWERED_MESSAGE);
  }

  const { error: answerError } = await supabase.from("clarification_answers").insert({
    card_id: cardId,
    option_id: selectedOption?.id ?? null,
    text: parsed.data.text ?? null,
  });
  if (answerError) {
    // 답변을 못 남겼으면 카드를 다시 열어 고객이 다시 답할 수 있게 한다.
    await supabase.from("clarification_cards").update({ answered_at: null }).eq("id", cardId).eq("answered_at", answeredAt);
    return respondError(500, "답변을 저장하지 못했어요.");
  }

  // 관리자가 그사이 반영 완료로 바꿨다면 eq(status) 조건에 걸려 바뀌지 않는다.
  const nextStatus = getStatusAfterAnswer(cardIssue.status);
  if (nextStatus !== cardIssue.status) {
    await supabase.from("issues").update({ status: nextStatus }).eq("id", card.issue_id).eq("status", cardIssue.status);
  }

  const answerText = [selectedOption?.label, parsed.data.text].filter(Boolean).join(" · ");
  const messageId = await insertMessage({
    conversationId: conversation.conversationId,
    sender: "user",
    type: "text",
    body: answerText,
    preview: `답변: ${answerText}`,
  });
  await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "clarification.answered", id: cardId });
  await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "message.created", id: messageId });
  return respondJson({ cardId, answeredAt });
}
