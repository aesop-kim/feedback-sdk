import { findAdminRejection } from "@/lib/auth/require-admin";
import { getConversationMessages, getConversationSummaries, getRecordingDetails } from "@/lib/feedback/feedback-repository";
import { respondError, respondJson } from "@/lib/http/api-response";
import { getServerSupabase } from "@/lib/supabase/server-client";

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const { conversationId } = await params;
  const summaries = await getConversationSummaries();
  const summary = summaries.find((conversation) => conversation.id === conversationId);
  if (!summary) {
    return respondError(404, "대화를 찾을 수 없어요.");
  }
  const [messages, recordings] = await Promise.all([
    getConversationMessages(conversationId, "admin"),
    getRecordingDetails(conversationId),
  ]);
  await getServerSupabase().from("conversations").update({ admin_unread_count: 0 }).eq("id", conversationId);
  return respondJson({ conversation: { ...summary, adminUnreadCount: 0, messages, recordings } });
}
