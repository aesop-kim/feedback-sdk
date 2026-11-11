import { formatRecordingDuration } from "@/lib/recording/format-recording-time";
import styles from "@/components/widget/RecordingPill.module.css";

type RecordingPillProps = { elapsedMs: number; maxDurationMs: number; isStopping: boolean; onStop: () => void };

export function RecordingPill({ elapsedMs, maxDurationMs, isStopping, onStop }: RecordingPillProps) {
  return (
    <div className={styles.pill} role="status" aria-label="화면 녹화 중">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.timer}>
        {formatRecordingDuration(elapsedMs)}
        <span className={styles.limit}> / {formatRecordingDuration(maxDurationMs)}</span>
      </span>
      <button type="button" className={styles.stopButton} onClick={onStop} disabled={isStopping}>
        끝내기
      </button>
    </div>
  );
}
