import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { respondError, respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { RECORDINGS_BUCKET, getServerSupabase } from "@/lib/supabase/server-client";
import { createRecordingSchema } from "@/lib/validation/api-schemas";

type UploadTarget = { path: string; token: string; signedUrl: string };

// 녹화 레코드를 만들고, 서버가 정한 경로로 signed upload URL을 한꺼번에 발급한다.
export async function POST(request: Request) {
  const conversation = await findAuthorizedConversation(request);
  if (!conversation) {
    return respondUnauthorized();
  }
  const parsed = createRecordingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const input = parsed.data;
  const supabase = getServerSupabase();

  const { data: recording, error } = await supabase
    .from("recordings")
    .insert({
      conversation_id: conversation.conversationId,
      page_url: input.pageUrl,
      page_title: input.pageTitle ?? null,
      viewport: input.viewport,
      t0_epoch_ms: input.t0EpochMs,
      duration_ms: input.durationMs,
      audio_offset_ms: input.audioOffsetMs,
      frames: input.frames.map((frame) => ({ ...frame, path: `frames/${frame.tMs}-${frame.reason}.jpg` })),
      reverify_issue_id: input.reverifyIssueId ?? null,
    })
    .select("id")
    .single();
  if (error || !recording) {
    return respondError(500, "녹화를 준비하지 못했어요.");
  }

  const recordingId = recording.id as string;
  const createUploadTarget = async (relativePath: string): Promise<UploadTarget> => {
    const path = `${recordingId}/${relativePath}`;
    const { data, error: signError } = await supabase.storage.from(RECORDINGS_BUCKET).createSignedUploadUrl(path);
    if (signError || !data) {
      throw new Error(signError?.message ?? "signed upload url 실패");
    }
    return { path, token: data.token, signedUrl: data.signedUrl };
  };

  try {
    const [video, audio, events, ...frames] = await Promise.all([
      createUploadTarget("video.webm"),
      createUploadTarget("audio.webm"),
      createUploadTarget("events.json"),
      ...input.frames.map((frame) => createUploadTarget(`frames/${frame.tMs}-${frame.reason}.jpg`)),
    ]);
    return respondJson({ recordingId, uploads: { video, audio, events, frames } }, 201);
  } catch {
    await supabase.from("recordings").update({ status: "failed", error: "업로드 주소 발급 실패" }).eq("id", recordingId);
    return respondError(500, "업로드를 준비하지 못했어요.");
  }
}
