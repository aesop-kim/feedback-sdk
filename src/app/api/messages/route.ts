import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { findReverifyRequest, getConversationMessages, insertMessage } from "@/lib/feedback/feedback-repository";
import { respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { sendMessageSchema } from "@/lib/validation/api-schemas";

export async function GET(request: Request) {
  const conversation = await findAuthorizedConversation(request);
  if (!conversation) {
    return respondUnauthorized();
  }
  const [messages, reverifyRequest] = await Promise.all([
    getConversationMessages(conversation.conversationId, "widget"),
    findReverifyRequest(conversation.conversationId),
  ]);
  await getServerSupabase().from("conversations").update({ user_unread_count: 0 }).eq("id", conversation.conversationId);
  return respondJson({ messages, reverifyRequest });
}

export async function POST(request: Request) {
  const conversation = await findAuthorizedConversation(request);
  if (!conversation) {
    return respondUnauthorized();
  }
  const parsed = sendMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const messageId = await insertMessage({
    conversationId: conversation.conversationId,
    sender: "user",
    type: "text",
    body: parsed.data.body,
    preview: parsed.data.body,
  });
  await sendConversationSignal(conversation.conversationId, conversation.projectId, { type: "message.created", id: messageId });
  return respondJson({ messageId }, 201);
}
