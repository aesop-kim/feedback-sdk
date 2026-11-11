import { ScreenMicIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetEmptyState.module.css";

type WidgetEmptyStateProps = { onStartRecording: () => void; isRecordingDisabled: boolean };

export function WidgetEmptyState({ onStartRecording, isRecordingDisabled }: WidgetEmptyStateProps) {
  return (
    <section className={styles.emptyState}>
      <h2 className={styles.title}>불편했던 점을 알려주세요</h2>
      <p className={styles.description}>화면을 보여주며 말로 설명하면 더 정확하게 고칠 수 있어요</p>
      <button type="button" className={styles.primaryButton} onClick={onStartRecording} disabled={isRecordingDisabled}>
        <ScreenMicIcon size={22} />
        화면 녹화로 설명하기
      </button>
      <p className={styles.hint}>글로 남기고 싶다면 아래에 바로 적어도 돼요</p>
    </section>
  );
}
