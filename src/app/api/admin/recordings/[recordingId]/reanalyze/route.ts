import { findAdminRejection } from "@/lib/auth/require-admin";
import { respondError, respondJson } from "@/lib/http/api-response";
import { findReanalyzeRejection, findRecordingFailureKind } from "@/lib/feedback/recording-failure";
import { getServerSupabase } from "@/lib/supabase/server-client";
import type { RecordingStatus } from "@/types/feedback";

const REANALYZE_INTERVAL_MS = 60_000;

// 재분석 = status를 uploaded로 되돌려 로컬 워커가 다시 가져가게 한다.
// 승인된 질문 카드가 있거나 업로드가 끝나지 않은 녹화(녹음 파일 없음)는 거부하고, 1분 안에 다시 누르면 무시.
export async function POST(_request: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const { recordingId } = await params;
  const supabase = getServerSupabase();

  const { data: recording } = await supabase
    .from("recordings")
    .select("status, error, analysis_attempt")
    .eq("id", recordingId)
    .maybeSingle();
  if (!recording) {
    return respondError(404, "녹화를 찾을 수 없어요.");
  }
  const { data: audioFiles } = await supabase.storage.from("recordings").list(recordingId, { search: "audio.webm" });
  const uploadRejection = findReanalyzeRejection({
    failureKind: findRecordingFailureKind({
      status: recording.status as RecordingStatus,
      error: recording.error as string | null,
      analysisAttempt: recording.analysis_attempt as number,
    }),
    hasAudio: (audioFiles ?? []).some((file) => file.name === "audio.webm"),
  });
  if (uploadRejection) {
    return respondError(409, uploadRejection);
  }

  const { count: approvedCardCount } = await supabase
    .from("clarification_cards")
    .select("id, issues!inner(recording_id)", { count: "exact", head: true })
    .eq("issues.recording_id", recordingId)
    .not("approved_at", "is", null);
  if ((approvedCardCount ?? 0) > 0) {
    return respondError(409, "고객에게 보낸 질문이 있어서 다시 분석할 수 없어요.");
  }

  const threshold = new Date(Date.now() - REANALYZE_INTERVAL_MS).toISOString();
  const { data: updated } = await supabase
    .from("recordings")
    .update({ status: "uploaded", error: null })
    .eq("id", recordingId)
    .in("status", ["analyzed", "failed"])
    .or(`analysis_started_at.is.null,analysis_started_at.lt.${threshold}`)
    .select("id");

  return respondJson({ recordingId, queued: Boolean(updated && updated.length > 0) });
}
