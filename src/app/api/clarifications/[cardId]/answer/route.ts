import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { respondError, respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { findFirstRelation } from "@/lib/supabase/first-relation";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { answerClarificationSchema } from "@/lib/validation/api-schemas";

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
    .select("id, issue_id, options, approved_at, answered_at, issues!inner(conversation_id)")
    .eq("id", cardId)
    .maybeSingle();
  const cardConversationId = findFirstRelation<{ conversation_id: string }>(card?.issues)?.conversation_id;
  if (!card || !card.approved_at || cardConversationId !== conversation.conversationId) {
    return respondError(404, "질문을 찾을 수 없어요.");
  }
  if (card.answered_at) {
    return respondError(409, "이미 답한 질문이에요.");
  }

  const options = card.options as { id: string; label: string }[];
  const selectedOption = options.find((option) => option.id === parsed.data.optionId);
  if (parsed.data.optionId && !selectedOption) {
    return respondError(400, "선택지를 다시 골라 주세요.");
  }

  const answeredAt = new Date().toISOString();
  await supabase.from("clarification_answers").insert({
    card_id: cardId,
    option_id: selectedOption?.id ?? null,
    text: parsed.data.text ?? null,
  });
  await supabase.from("clarification_cards").update({ answered_at: answeredAt }).eq("id", cardId);
  await supabase.from("issues").update({ status: "answered" }).eq("id", card.issue_id);

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
