import type { IssueStatus, RecordingFailureKind, RecordingStatus } from "@/types/feedback";

// 워커가 무음 녹화를 거를 때 남기는 문구. 관리자 화면은 이 문구로 "다시 녹화 요청"을 안내한다.
export const SILENT_AUDIO_ERROR = "목소리가 녹음되지 않았어요. 크롬에서 고른 마이크를 확인해 주세요";

// 워커가 녹화 파일(audio.webm)을 찾지 못했을 때 남기는 문구. 저장소 원문 오류는 로그에만 남긴다.
export const MISSING_RECORDING_FILE_ERROR = "녹화 파일이 없어요. 업로드가 끝나지 않은 녹화예요. 고객에게 다시 녹화해 달라고 요청해 주세요";

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
  if (recording.error?.includes(SILENT_AUDIO_ERROR)) {
    return "silent_audio";
  }
  if (recording.analysisAttempt === 0 || recording.error?.includes(MISSING_RECORDING_FILE_ERROR)) {
    return "upload_incomplete";
  }
  return "analysis";
}

// 다시 정리하기를 거절할 이유. 업로드가 끝나지 않았거나 녹음 파일이 없으면 다시 돌려도 같은 이유로 실패한다.
export function findReanalyzeRejection(input: { failureKind: RecordingFailureKind | null; hasAudio: boolean }): string | null {
  if (input.failureKind === "upload_incomplete" || !input.hasAudio) {
    return "업로드가 끝나지 않은 녹화라 다시 정리할 수 없어요. 고객에게 다시 녹화해 달라고 요청해 주세요.";
  }
  return null;
}

// 관리자가 이미 처리한 이슈 상태. 다시 정리하면 이슈를 새로 만들면서 이 이슈들이 지워져
// 처리 기록과 재확인 녹화 연결(reverify_issue_id)이 사라진다. replace_recording_issues도 같은 상태를 막는다.
export const PROGRESSED_ISSUE_STATUSES: IssueStatus[] = ["resolved", "reverify", "closed"];

export const PROGRESSED_ISSUE_REJECTION =
  "반영 완료했거나 해결된 이슈가 있어서 다시 정리할 수 없어요. 다시 정리하면 그 처리 기록이 사라져요.";

export function hasProgressedIssue(issueStatuses: IssueStatus[]): boolean {
  return issueStatuses.some((status) => PROGRESSED_ISSUE_STATUSES.includes(status));
}

export type ReanalyzeAction = "primary" | "secondary" | "none";

export type FailureGuidance = { title: string; guide: string; reanalyzeAction: ReanalyzeAction };

// 관리자 화면의 실패 안내. 오류 문구가 아니라 실패 종류로 가른다.
export function getFailureGuidance(failureKind: RecordingFailureKind | null, hasVideo: boolean): FailureGuidance {
  if (failureKind === "upload_incomplete") {
    return {
      title: "녹화를 끝까지 받지 못했어요",
      guide: "받은 영상이 없어서 다시 정리할 수 없어요. 고객에게 다시 녹화해 달라고 답장해 주세요.",
      reanalyzeAction: "none",
    };
  }
  if (failureKind === "silent_audio") {
    return {
      title: "말한 내용을 정리하지 못했어요",
      guide: "다시 정리해도 결과가 같아요. 고객에게 마이크를 확인하고 다시 녹화해 달라고 답장해 주세요.",
      reanalyzeAction: "secondary",
    };
  }
  if (hasVideo) {
    return {
      title: "말한 내용을 정리하지 못했어요",
      guide: "영상은 위에서 바로 볼 수 있어요. 다시 정리하면 보통 1분 안에 끝나요.",
      reanalyzeAction: "primary",
    };
  }
  return {
    title: "말한 내용을 정리하지 못했어요",
    guide: "녹화는 받아 두었어요. 다시 정리하면 보통 1분 안에 끝나요.",
    reanalyzeAction: "primary",
  };
}
