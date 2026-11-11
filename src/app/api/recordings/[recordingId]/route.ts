import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { completeRecordingSchema } from "@/lib/validation/api-schemas";

// 업로드 완료 표시. uploading → uploaded 전환이 실제로 일어난 1회만 메시지를 만든다(재시도 안전).
// 분석은 로컬 워커가 status='uploaded'를 보고 가져간다.
// 재확인 녹화면 연결된 이슈를 resolved → reverify로 바꿔 관리자가 다시 보게 한다.
export async function PATCH(request: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  const conversation = await findAuthorizedConversation(request);
  if (!conversation) {
    return respondUnauthorized();
  }
  const parsed = completeRecordingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const { recordingId } = await params;

  const supabase = getServerSupabase();
  const { data: transitioned } = await supabase
    .from("recordings")
    .update({ status: "uploaded" })
    .eq("id", recordingId)
    .eq("conversation_id", conversation.conversationId)
    .eq("status", "uploading")
    .select("id, reverify_issue_id");

  if (!transitioned || transitioned.length === 0) {
    return respondJson({ recordingId, changed: false });
  }

  const reverifyIssueId = transitioned[0].reverify_issue_id as string | null;
  if (reverifyIssueId) {
    await supabase.from("issues").update({ status: "reverify" }).eq("id", reverifyIssueId).eq("status", "resolved");
  }

  const messageId = await insertMessage({
    conversationId: conversation.conversationId,
    sender: "user",
    type: "recording",
    body: null,
    recordingId,
    preview: "화면 녹화를 보냈어요",
  });
  await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "message.created", id: messageId });
  return respondJson({ recordingId, changed: true });
}
