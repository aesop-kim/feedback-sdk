import "server-only";
import { getAdminChannelName, getConversationChannelName, type RealtimeSignal } from "@/lib/realtime/realtime-signal";
import { sendChannelSignal } from "@/lib/realtime/send-channel-signal";
import { getServerSupabase } from "@/lib/supabase/server-client";

export async function sendConversationSignal(
  conversationId: string,
  projectId: string,
  signal: RealtimeSignal,
): Promise<void> {
  const supabase = getServerSupabase();
  await Promise.all([
    sendChannelSignal(supabase, getConversationChannelName(conversationId), signal, "[realtime]"),
    sendChannelSignal(supabase, getAdminChannelName(projectId), { type: "conversation.updated", id: conversationId }, "[realtime]"),
  ]);
}
