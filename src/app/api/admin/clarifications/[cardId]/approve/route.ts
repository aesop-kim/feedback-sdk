import { findAdminRejection } from "@/lib/auth/require-admin";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { approveClarificationSchema } from "@/lib/validation/api-schemas";

// 관리자가 AI가 만든 질문을 (필요하면 고쳐서) 승인하면, 고객 위젯에 질문 카드가 나간다.
export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const parsed = approveClarificationSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const { cardId } = await params;
  const supabase = getServerSupabase();

  const { data: card } = await supabase
    .from("clarification_cards")
    .select("id, issue_id, question, approved_at, issues!inner(conversation_id, conversations!inner(project_id))")
    .eq("id", cardId)
    .maybeSingle();
  if (!card) {
    return respondError(404, "질문을 찾을 수 없어요.");
  }
  if (card.approved_at) {
    return respondJson({ cardId, alreadyApproved: true });
  }
  const issueRelation = (Array.isArray(card.issues) ? card.issues[0] : card.issues) as {
    conversation_id: string;
    conversations: { project_id: string } | { project_id: string }[];
  };
  const conversationId = issueRelation.conversation_id;
  const projectRelation = Array.isArray(issueRelation.conversations) ? issueRelation.conversations[0] : issueRelation.conversations;

  // 아직 승인되지 않은 카드만 바꾼다. 동시에 두 번 눌러도 질문 메시지는 한 번만 생긴다.
  const { data: approvedRows } = await supabase
    .from("clarification_cards")
    .update({
      approved_at: new Date().toISOString(),
      ...(parsed.data.question ? { question: parsed.data.question } : {}),
      ...(parsed.data.options ? { options: parsed.data.options } : {}),
    })
    .eq("id", cardId)
    .is("approved_at", null)
    .select("id");
  if (!approvedRows || approvedRows.length === 0) {
    return respondJson({ cardId, alreadyApproved: true });
  }
  await supabase.from("issues").update({ status: "asked" }).eq("id", card.issue_id);

  const messageId = await insertMessage({
    conversationId,
    sender: "admin",
    type: "clarification",
    body: null,
    clarificationCardId: cardId,
    preview: "확인하고 싶은 게 있어요",
  });
  await sendConversationSignal(conversationId, projectRelation.project_id, { type: "clarification.approved", id: cardId });
  await sendConversationSignal(conversationId, projectRelation.project_id, { type: "message.created", id: messageId });
  return respondJson({ cardId, messageId });
}
