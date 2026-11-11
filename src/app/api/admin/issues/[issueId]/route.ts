import { findAdminRejection } from "@/lib/auth/require-admin";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { updateIssueSchema } from "@/lib/validation/api-schemas";

// 이슈를 "반영 완료"로 바꾸면 고객에게 다시 확인해 달라는 메시지를 보낸다.
export async function PATCH(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const parsed = updateIssueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const { issueId } = await params;
  const supabase = getServerSupabase();
  const { data: issue } = await supabase
    .from("issues")
    .select("id, title, conversation_id, status, conversations!inner(project_id)")
    .eq("id", issueId)
    .maybeSingle();
  if (!issue) {
    return respondError(404, "이슈를 찾을 수 없어요.");
  }
  if (issue.status === "resolved") {
    return respondJson({ issueId, changed: false });
  }
  await supabase.from("issues").update({ status: parsed.data.status }).eq("id", issueId);
  const projectRelation = (Array.isArray(issue.conversations) ? issue.conversations[0] : issue.conversations) as { project_id: string };
  const messageId = await insertMessage({
    conversationId: issue.conversation_id,
    sender: "system",
    type: "system",
    body: `‘${issue.title}’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요.`,
    preview: "수정을 반영했어요",
  });
  await sendConversationSignal(issue.conversation_id, projectRelation.project_id, { type: "message.created", id: messageId });
  return respondJson({ issueId, changed: true });
}
