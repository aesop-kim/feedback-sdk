import { ScreenIcon } from "@/components/widget/WidgetIcons";
import { formatRecordingDuration } from "@/lib/recording/format-recording-time";
import type { RecordingStatus } from "@/types/feedback";
import styles from "@/components/widget/RecordingMessage.module.css";

// upload_failed: 서버에 가지 못한 녹화(위젯에만 있다). failed(분석 실패)와 문구·색을 나눈다.
type RecordingMessageStatus = RecordingStatus | "upload_failed";

type RecordingMessageProps = {
  durationMs: number | null;
  status: RecordingMessageStatus;
  issueCount: number;
  uploadProgress?: number;
  onRetry?: () => void;
};

function getStatusText(status: RecordingMessageStatus, issueCount: number, uploadProgress: number): string {
  switch (status) {
    case "uploading":
      return `보내는 중 ${Math.round(uploadProgress * 100)}%`;
    case "uploaded":
    case "analyzing":
      return "정리하고 있어요";
    case "analyzed":
      return issueCount > 0 ? `문제 ${issueCount}건을 정리했어요` : "정리를 마쳤어요";
    case "failed":
      // 분석은 우리 쪽 일이다. 영상은 받았고 담당자가 직접 볼 수 있으니 고객에게 오류로 보이지 않게 한다.
      return "받았어요. 담당자가 직접 볼게요";
    case "upload_failed":
      return "보내지 못했어요";
  }
}

export function RecordingMessage({ durationMs, status, issueCount, uploadProgress = 0, onRetry }: RecordingMessageProps) {
  return (
    <div className={styles.row}>
      <div className={styles.card}>
        <span className={styles.iconTile}>
          <ScreenIcon size={20} />
        </span>
        <div className={styles.text}>
          <p className={styles.title}>
            화면 녹화 · <span className={styles.duration}>{formatRecordingDuration(durationMs)}</span>
          </p>
          <p className={styles.status} data-status={status}>
            {getStatusText(status, issueCount, uploadProgress)}
          </p>
          {status === "uploading" ? (
            <span className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressBar} style={{ transform: `scaleX(${uploadProgress})` }} />
            </span>
          ) : null}
        </div>
        {onRetry ? (
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            다시 보내기
          </button>
        ) : null}
      </div>
    </div>
  );
}
