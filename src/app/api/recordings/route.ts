import { findAuthorizedConversation } from "@/lib/auth/request-auth";
import { getFramePath, getRecordingUploadPaths, isUploadRetryable } from "@/lib/feedback/recording-upload";
import { respondError, respondJson, respondUnauthorized, respondValidationError } from "@/lib/http/api-response";
import { RECORDINGS_BUCKET, getServerSupabase } from "@/lib/supabase/server-client";
import { createRecordingSchema } from "@/lib/validation/api-schemas";
import type { RecordingStatus } from "@/types/feedback";

type UploadTarget = { path: string; token: string; signedUrl: string };

async function createUploadTargets(recordingId: string, framePaths: string[]) {
  const storage = getServerSupabase().storage.from(RECORDINGS_BUCKET);
  const targets = await Promise.all(
    getRecordingUploadPaths(framePaths).map(async (relativePath): Promise<UploadTarget> => {
      const path = `${recordingId}/${relativePath}`;
      const { data, error } = await storage.createSignedUploadUrl(path);
      if (error || !data) {
        throw new Error(error?.message ?? "signed upload url 실패");
      }
      return { path, token: data.token, signedUrl: data.signedUrl };
    }),
  );
  const [video, audio, events, ...frames] = targets;
  return { video, audio, events, frames };
}

// 녹화 레코드를 만들고, 서버가 정한 경로로 signed upload URL을 한꺼번에 발급한다.
// recordingId를 주면("다시 보내기") 새로 만들지 않고 그 녹화의 업로드 주소만 다시 발급한다.
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

  let recordingId: string;
  let framePaths: string[];
  if (input.recordingId) {
    const { data: existing } = await supabase
      .from("recordings")
      .select("id, status, analysis_attempt, frames")
      .eq("id", input.recordingId)
      .eq("conversation_id", conversation.conversationId)
      .maybeSingle();
    if (!existing) {
      return respondError(404, "다시 보낼 녹화를 찾을 수 없어요.");
    }
    const retryable = isUploadRetryable({
      status: existing.status as RecordingStatus,
      analysisAttempt: existing.analysis_attempt as number,
    });
    if (!retryable) {
      return respondError(409, "이미 보낸 녹화예요.");
    }
    // 읽은 뒤 그사이 업로드가 끝났거나 워커가 가져갔다면 되돌리지 않는다. 같은 조건을 update에 다시 건다.
    const { data: resetRows, error: resetError } = await supabase
      .from("recordings")
      .update({ status: "uploading", error: null, upload_requested_at: new Date().toISOString() })
      .eq("id", input.recordingId)
      .in("status", ["uploading", "failed"])
      .eq("analysis_attempt", 0)
      .select("id");
    if (resetError) {
      return respondError(500, "업로드를 준비하지 못했어요.");
    }
    if (!resetRows || resetRows.length === 0) {
      return respondError(409, "이미 보낸 녹화예요.");
    }
    recordingId = input.recordingId;
    framePaths = ((existing.frames ?? []) as { path: string }[]).map((frame) => frame.path);
  } else {
    // 재확인 녹화는 같은 대화의 이슈에만 연결한다.
    if (input.reverifyIssueId) {
      const { data: reverifyIssue } = await supabase
        .from("issues")
        .select("id")
        .eq("id", input.reverifyIssueId)
        .eq("conversation_id", conversation.conversationId)
        .maybeSingle();
      if (!reverifyIssue) {
        return respondError(404, "다시 확인할 문제를 찾을 수 없어요.");
      }
    }

    framePaths = input.frames.map(getFramePath);
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
        frames: input.frames.map((frame) => ({ ...frame, path: getFramePath(frame) })),
        reverify_issue_id: input.reverifyIssueId ?? null,
      })
      .select("id")
      .single();
    if (error || !recording) {
      return respondError(500, "녹화를 준비하지 못했어요.");
    }
    recordingId = recording.id as string;
  }

  try {
    const uploads = await createUploadTargets(recordingId, framePaths);
    return respondJson({ recordingId, uploads }, input.recordingId ? 200 : 201);
  } catch {
    await supabase.from("recordings").update({ status: "failed", error: "업로드 주소 발급 실패" }).eq("id", recordingId);
    return respondError(500, "업로드를 준비하지 못했어요.");
  }
}
