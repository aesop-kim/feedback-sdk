import { formatRecordingDuration } from "@/lib/recording/format-recording-time";
import styles from "@/components/widget/RecordingPill.module.css";

// 막대 3개의 높이 비율(가운데가 가장 높다). 런처 아이콘의 파형과 같은 모양.
const LEVEL_BAR_WEIGHTS = [0.6, 1, 0.6];
const MIN_BAR_SCALE = 0.2;

type RecordingPillProps = {
  elapsedMs: number;
  maxDurationMs: number;
  isStopping: boolean;
  microphoneLevel: number;
  // 있으면 알약 위에 경고 줄을 보여 준다(녹화 중에는 토스트 자리가 없다).
  warning: string | null;
  onStop: () => void;
  onCancel: () => void;
};

export function RecordingPill({ elapsedMs, maxDurationMs, isStopping, microphoneLevel, warning, onStop, onCancel }: RecordingPillProps) {
  return (
    <div className={styles.pill} role="status" aria-label="화면 녹화 중" data-warning={warning !== null}>
      {warning ? (
        <p className={styles.warning} role="alert">
          {warning}
        </p>
      ) : null}
      <div className={styles.controls}>
        <button type="button" className={styles.cancelButton} onClick={onCancel} disabled={isStopping}>
          취소
        </button>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.level} aria-hidden="true">
          {LEVEL_BAR_WEIGHTS.map((weight, index) => (
            <span
              key={index}
              className={styles.levelBar}
              style={{ transform: `scaleY(${Math.max(MIN_BAR_SCALE, microphoneLevel * weight)})` }}
            />
          ))}
        </span>
        <span className={styles.timer}>
          {formatRecordingDuration(elapsedMs)}
          <span className={styles.limit}> / {formatRecordingDuration(maxDurationMs)}</span>
        </span>
        <button type="button" className={styles.stopButton} onClick={onStop} disabled={isStopping}>
          끝내고 보내기
        </button>
      </div>
    </div>
  );
}
