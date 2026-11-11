import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { getAnswerText } from "@/lib/feedback/clarification-answer";
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

  // 여기부터는 답변이 이미 저장된 뒤다. 이후 단계가 실패해도 500을 돌려주면 고객은 답이 안 간 줄 알고
  // 다시 눌러 409를 받는다. 그래서 실패는 로그만 남기고 성공으로 돌려준다.
  // 위젯은 성공하면 다시 불러오고, 카드의 answered_at으로 답한 상태를 보여 준다(텍스트 메시지와 무관).
  // 관리자 화면도 카드의 답변(clarification_answers)을 읽으므로 메시지가 빠져도 답은 보인다.
  // 관리자가 그사이 반영 완료로 바꿨다면 eq(status) 조건에 걸려 바뀌지 않는다.
  const nextStatus = getStatusAfterAnswer(cardIssue.status);
  if (nextStatus !== cardIssue.status) {
    const { error: statusError } = await supabase
      .from("issues")
      .update({ status: nextStatus })
      .eq("id", card.issue_id)
      .eq("status", cardIssue.status);
    if (statusError) {
      console.error(`[answer] ${cardId} 이슈 상태를 바꾸지 못했어요`, statusError.message);
    }
  }

  const answerText = getAnswerText(selectedOption?.label, parsed.data.text);
  let messageId: string | null = null;
  try {
    messageId = await insertMessage({
      conversationId: conversation.conversationId,
      sender: "user",
      type: "text",
      body: answerText,
      preview: `답변: ${answerText}`,
    });
  } catch (error) {
    console.error(`[answer] ${cardId} 답변 메시지를 남기지 못했어요`, error);
  }
  // 신호 실패는 sendChannelSignal이 로그만 남기고 삼킨다.
  await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "clarification.answered", id: cardId });
  if (messageId) {
    await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "message.created", id: messageId });
  }
  return respondJson({ cardId, answeredAt });
}
