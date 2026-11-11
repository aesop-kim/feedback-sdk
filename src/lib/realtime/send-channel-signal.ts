import type { SupabaseClient } from "@supabase/supabase-js";
import { REALTIME_EVENT, type RealtimeSignal } from "@/lib/realtime/realtime-signal";

// 채널 하나에 신호를 보내고 채널을 닫는다. 서버 Route Handler와 분석 워커가 같이 쓴다.
// 신호 실패는 데이터 저장을 막지 않는다. 화면은 다음 조회 때 맞춰진다.
export async function sendChannelSignal(
  supabase: SupabaseClient,
  channelName: string,
  signal: RealtimeSignal,
  logPrefix: string,
): Promise<void> {
  const channel = supabase.channel(channelName);
  try {
    await channel.httpSend(REALTIME_EVENT, signal);
  } catch (error) {
    console.warn(`${logPrefix} ${channelName} 신호 전송 실패`, error);
  } finally {
    await supabase.removeChannel(channel);
  }
}
