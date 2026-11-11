import "server-only";
import { getServerSupabase } from "@/lib/supabase/server-client";
import {
  REALTIME_EVENT,
  getAdminChannelName,
  getConversationChannelName,
  type RealtimeSignal,
} from "@/lib/realtime/realtime-signal";

async function sendToChannel(channelName: string, signal: RealtimeSignal): Promise<void> {
  const channel = getServerSupabase().channel(channelName);
  try {
    await channel.httpSend(REALTIME_EVENT, signal);
  } catch (error) {
    // 신호 실패는 데이터 저장을 막지 않는다. 화면은 다음 조회 때 맞춰진다.
    console.warn(`[realtime] ${channelName} 신호 전송 실패`, error);
  } finally {
    await getServerSupabase().removeChannel(channel);
  }
}

export async function sendConversationSignal(
  conversationId: string,
  projectId: string,
  signal: RealtimeSignal,
): Promise<void> {
  await Promise.all([
    sendToChannel(getConversationChannelName(conversationId), signal),
    sendToChannel(getAdminChannelName(projectId), { type: "conversation.updated", id: conversationId }),
  ]);
}
