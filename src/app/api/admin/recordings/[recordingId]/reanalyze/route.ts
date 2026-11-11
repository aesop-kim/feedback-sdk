import { findAdminRejection } from "@/lib/auth/require-admin";
import { respondError, respondJson } from "@/lib/http/api-response";
import {
  PROGRESSED_ISSUE_REJECTION,
  PROGRESSED_ISSUE_STATUSES,
  findReanalyzeRejection,
  findRecordingFailureKind,
} from "@/lib/feedback/recording-failure";
import { RECORDINGS_BUCKET, getServerSupabase } from "@/lib/supabase/server-client";
import type { RecordingStatus } from "@/types/feedback";

const REANALYZE_INTERVAL_MS = 60_000;

// 재분석 = status를 uploaded로 되돌려 로컬 워커가 다시 가져가게 한다.
// 승인된 질문 카드가 있거나, 관리자가 이미 처리한 이슈(반영 완료·재확인·해결됨)가 있거나,
// 업로드가 끝나지 않은 녹화(녹음 파일 없음)는 거부하고, 1분 안에 다시 누르면 무시.
// 워커가 기존 이슈를 지우고 새로 만들기 때문에, 처리 기록이 있는 녹화를 다시 돌리면 그 기록이 사라진다.
export async function POST(_request: Request, { params }: { params: Promise<{ recordingId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const { recordingId } = await params;
  const supabase = getServerSupabase();

  const { data: recording, error: recordingError } = await supabase
    .from("recordings")
    .select("status, error, analysis_attempt")
    .eq("id", recordingId)
    .maybeSingle();
  if (recordingError) {
    return respondError(500, "녹화를 불러오지 못했어요.");
  }
  if (!recording) {
    return respondError(404, "녹화를 찾을 수 없어요.");
  }
  const { data: audioFiles } = await supabase.storage.from(RECORDINGS_BUCKET).list(recordingId, { search: "audio.webm" });
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

  const { count: approvedCardCount, error: cardError } = await supabase
    .from("clarification_cards")
    .select("id, issues!inner(recording_id)", { count: "exact", head: true })
    .eq("issues.recording_id", recordingId)
    .not("approved_at", "is", null);
  if (cardError) {
    return respondError(500, "다시 정리할 수 있는지 확인하지 못했어요.");
  }
  if ((approvedCardCount ?? 0) > 0) {
    return respondError(409, "고객에게 보낸 질문이 있어서 다시 분석할 수 없어요.");
  }

  const { count: progressedIssueCount, error: issueError } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("recording_id", recordingId)
    .in("status", PROGRESSED_ISSUE_STATUSES);
  if (issueError) {
    return respondError(500, "다시 정리할 수 있는지 확인하지 못했어요.");
  }
  if ((progressedIssueCount ?? 0) > 0) {
    return respondError(409, PROGRESSED_ISSUE_REJECTION);
  }

  const threshold = new Date(Date.now() - REANALYZE_INTERVAL_MS).toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("recordings")
    .update({ status: "uploaded", error: null })
    .eq("id", recordingId)
    .in("status", ["analyzed", "failed"])
    .or(`analysis_started_at.is.null,analysis_started_at.lt.${threshold}`)
    .select("id");
  if (updateError) {
    return respondError(500, "다시 정리를 요청하지 못했어요.");
  }

  return respondJson({ recordingId, queued: Boolean(updated && updated.length > 0) });
}
