import type { SupabaseClient } from "@supabase/supabase-js";

export type ExpiredUpload = { id: string; conversation_id: string; project_id: string; message_id: string | null };

// 업로드가 끝나지 않아 만료된 녹화를 고객에게 알리는 메시지. 받은 영상이 없으니 다시 녹화해 달라고 한다.
// 녹화 메시지(recording)가 아니라 시스템 메시지로 보낸다. 녹화 메시지는 녹화마다 하나뿐이라서(unique index),
// 고객이 나중에 같은 녹화를 "다시 보내기"로 끝까지 올리면 완료 처리의 메시지 저장이 막히기 때문이다.
export const EXPIRED_UPLOAD_MESSAGE = {
  body: "보내던 화면 녹화가 끝까지 올라가지 않았어요. 번거로우시겠지만 한 번 더 녹화해 주세요.",
  preview: "녹화가 끝까지 올라가지 않았어요",
};

// 업로드 중에 고객이 떠나 오래 'uploading'에 머문 녹화를 failed로 바꾸고, 바뀐 녹화마다 고객에게 한 번 알린다.
// RPC가 실제로 상태를 바꾼 행만 돌려주므로 같은 녹화에 메시지가 두 번 가지 않는다.
// 분석 워커와 e2e가 같이 쓴다. 메시지 저장이 실패해도 만료는 이미 끝났으니 로그만 남기고 다음 행으로 간다.
export async function expireStaleUploads(supabase: SupabaseClient, staleMinutes: number): Promise<ExpiredUpload[]> {
  const { data, error } = await supabase.rpc("expire_stale_uploads", { p_stale_minutes: staleMinutes });
  if (error) {
    throw new Error(`expire_stale_uploads 실패: ${error.message}`);
  }
  const expired = (data as Omit<ExpiredUpload, "message_id">[] | null) ?? [];
  const results: ExpiredUpload[] = [];
  for (const recording of expired) {
    results.push({ ...recording, message_id: await insertExpiredUploadMessage(supabase, recording.conversation_id) });
  }
  return results;
}

async function insertExpiredUploadMessage(supabase: SupabaseClient, conversationId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender: "system", type: "system", body: EXPIRED_UPLOAD_MESSAGE.body })
    .select("id")
    .single();
  if (error || !data) {
    console.error(`[expire] ${conversationId} 만료 안내 메시지 저장 실패: ${error?.message}`);
    return null;
  }
  const { data: conversation } = await supabase.from("conversations").select("user_unread_count").eq("id", conversationId).single();
  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: EXPIRED_UPLOAD_MESSAGE.preview,
      user_unread_count: (conversation?.user_unread_count ?? 0) + 1,
    })
    .eq("id", conversationId);
  return data.id as string;
}
