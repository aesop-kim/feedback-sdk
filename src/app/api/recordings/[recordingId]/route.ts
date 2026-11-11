import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { completeRecordingSchema } from "@/lib/validation/api-schemas";

// 업로드 완료 표시. uploading → uploaded 전환이 실제로 일어난 1회만 메시지를 만든다(재시도 안전).
// 분석은 로컬 워커가 status='uploaded'를 보고 가져간다.
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

  const { data: transitioned } = await getServerSupabase()
    .from("recordings")
    .update({ status: "uploaded" })
    .eq("id", recordingId)
    .eq("conversation_id", conversation.conversationId)
    .eq("status", "uploading")
    .select("id, duration_ms");

  if (!transitioned || transitioned.length === 0) {
    return respondJson({ recordingId, changed: false });
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
