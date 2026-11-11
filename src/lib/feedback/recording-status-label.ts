import { getFailureGuidance } from "@/lib/feedback/recording-failure";
import type { RecordingFailureKind, RecordingStatus, RecordingSummary } from "@/types/feedback";

// upload_failed: 서버에 가지 못한 녹화(위젯에만 있다). failed(분석 실패)와 문구·색을 나눈다.
export type WidgetRecordingStatus = RecordingStatus | "upload_failed";

// 위젯 녹화 카드의 상태 문구. 실패는 종류로 가른다.
// 업로드 미완료는 받은 영상이 없으니 사실대로 알리고 다시 녹화를 권한다(관리자 안내와 같은 이야기).
// 그 밖의 실패는 영상을 받았고 담당자가 직접 볼 수 있으니 고객에게 오류로 보이지 않게 한다.
// 재확인 녹화는 "문제 N건"이 "고친 게 실패했다"로 읽혀서, 받았다고만 하고 결과는 담당자 메시지로 알린다(V4-02).
export function getWidgetRecordingStatusText(input: {
  status: WidgetRecordingStatus;
  failureKind: RecordingFailureKind | null;
  issueCount: number;
  uploadProgress: number;
  isReverify?: boolean;
}): string {
  switch (input.status) {
    case "uploading":
      return `보내는 중 ${Math.round(input.uploadProgress * 100)}%`;
    case "uploaded":
    case "analyzing":
      return "정리하고 있어요";
    case "analyzed":
      if (input.isReverify) {
        return "받았어요. 확인하고 알려 드릴게요";
      }
      return input.issueCount > 0 ? `문제 ${input.issueCount}건을 정리했어요` : "정리를 마쳤어요";
    case "failed":
      return input.failureKind === "upload_incomplete" ? "녹화가 끝까지 올라가지 않았어요" : "받았어요. 담당자가 직접 볼게요";
    case "upload_failed":
      return "보내지 못했어요";
  }
}

// 위젯 녹화 카드 제목. 재확인 녹화는 관리자 분석 패널처럼 어떤 이슈를 다시 확인한 녹화인지 붙인다.
export function getWidgetRecordingTitle(reverifyIssueTitle: string | null | undefined): string {
  return reverifyIssueTitle ? `‘${reverifyIssueTitle}’ 다시 확인 녹화` : "화면 녹화";
}

// 고객이 다시 녹화해야 하는 녹화인지. 위젯 카드에 "다시 녹화하기"를 단다.
export function needsRerecord(recording: Pick<RecordingSummary, "failureKind">): boolean {
  return recording.failureKind === "upload_incomplete";
}

// 관리자 대화의 녹화 칩. 실패는 옆 분석 패널과 같은 제목을 써서 한 녹화에 설명이 둘이 되지 않게 한다.
// 재확인 녹화에서 찾은 내용은 남은 문제로 세지 않으므로, 패널 제목처럼 "찾은 내용"이라고 부른다(V5-02).
export function getAdminRecordingStateLabel(
  recording: Pick<RecordingSummary, "status" | "issueCount" | "failureKind">,
  isReverify = false,
): string {
  switch (recording.status) {
    case "uploading":
      return "올리는 중";
    case "uploaded":
    case "analyzing":
      return "정리하는 중";
    case "failed":
      return getFailureGuidance(recording.failureKind, false).title;
    case "analyzed":
      if (isReverify) {
        return recording.issueCount > 0 ? `찾은 내용 ${recording.issueCount}건` : "찾은 내용 없음";
      }
      return recording.issueCount > 0 ? `문제 ${recording.issueCount}건` : "찾은 문제 없음";
  }
}
