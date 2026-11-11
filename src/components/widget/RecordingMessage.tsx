import { ScreenIcon } from "@/components/widget/WidgetIcons";
import { formatRecordingDuration } from "@/lib/recording/format-recording-time";
import {
  getWidgetRecordingStatusText,
  getWidgetRecordingTitle,
  type WidgetRecordingStatus,
} from "@/lib/feedback/recording-status-label";
import type { RecordingFailureKind } from "@/types/feedback";
import styles from "@/components/widget/RecordingMessage.module.css";

type RecordingMessageProps = {
  durationMs: number | null;
  status: WidgetRecordingStatus;
  failureKind?: RecordingFailureKind | null;
  issueCount: number;
  // 재확인 녹화면 원래 이슈 제목.
  reverifyIssueTitle?: string | null;
  uploadProgress?: number;
  onRetry?: () => void;
  // 있으면 받은 영상이 없는 녹화: 아래에 '다시 녹화하기'를 단다.
  onRerecord?: () => void;
};

export function RecordingMessage({
  durationMs,
  status,
  failureKind = null,
  issueCount,
  reverifyIssueTitle = null,
  uploadProgress = 0,
  onRetry,
  onRerecord,
}: RecordingMessageProps) {
  return (
    <div className={styles.row}>
      <div className={styles.card}>
        <span className={styles.iconTile}>
          <ScreenIcon size={20} />
        </span>
        <div className={styles.text}>
          <p className={styles.title}>
            {getWidgetRecordingTitle(reverifyIssueTitle)} · <span className={styles.duration}>{formatRecordingDuration(durationMs)}</span>
          </p>
          <p className={styles.status} data-status={status} data-failure-kind={failureKind ?? undefined}>
            {getWidgetRecordingStatusText({ status, failureKind, issueCount, uploadProgress, isReverify: Boolean(reverifyIssueTitle) })}
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
        {onRerecord ? (
          <button type="button" className={styles.retryButton} onClick={onRerecord}>
            다시 녹화하기
          </button>
        ) : null}
      </div>
    </div>
  );
}
