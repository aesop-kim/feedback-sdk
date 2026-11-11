import { findAdminRejection } from "@/lib/auth/require-admin";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { sendMessageSchema } from "@/lib/validation/api-schemas";

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const parsed = sendMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const { conversationId } = await params;
  const { data: conversation } = await getServerSupabase()
    .from("conversations")
    .select("id, project_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) {
    return respondError(404, "대화를 찾을 수 없어요.");
  }
  const messageId = await insertMessage({
    conversationId,
    sender: "admin",
    type: "text",
    body: parsed.data.body,
    preview: parsed.data.body,
  });
  await sendConversationSignal(conversationId, conversation.project_id, { type: "message.created", id: messageId });
  return respondJson({ messageId }, 201);
}
