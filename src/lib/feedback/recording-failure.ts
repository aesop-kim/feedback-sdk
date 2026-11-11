import type { RecordingFailureKind, RecordingStatus } from "@/types/feedback";

// 워커가 무음 녹화를 거를 때 남기는 문구. 관리자 화면은 이 문구로 "다시 녹화 요청"을 안내한다.
export const SILENT_AUDIO_ERROR = "목소리가 녹음되지 않았어요. 크롬에서 고른 마이크를 확인해 주세요";

// 실패한 녹화를 관리자가 어떻게 다뤄야 하는지 가른다.
// silent_audio·upload_incomplete는 다시 분석해도 소용없어서 고객에게 다시 녹화를 요청해야 하고,
// analysis는 "다시 정리하기"로 풀릴 수 있다.
export function findRecordingFailureKind(recording: {
  status: RecordingStatus;
  error: string | null;
  analysisAttempt: number;
}): RecordingFailureKind | null {
  if (recording.status !== "failed") {
    return null;
  }
  if (recording.analysisAttempt === 0) {
    return "upload_incomplete";
  }
  if (recording.error?.includes(SILENT_AUDIO_ERROR)) {
    return "silent_audio";
  }
  return "analysis";
}
