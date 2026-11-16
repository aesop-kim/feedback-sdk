import { CaptureIcon, ScreenMicIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetFeedbackActions.module.css";

type WidgetFeedbackActionsProps = {
  onStartRecording: () => void;
  onStartCapture?: () => void;
  isDisabled: boolean;
  showHint: boolean;
};

export function WidgetFeedbackActions({ onStartRecording, onStartCapture, isDisabled, showHint }: WidgetFeedbackActionsProps) {
  return (
    <div className={styles.action}>
      <button type="button" className={styles.primaryButton} onClick={onStartRecording} disabled={isDisabled}>
        <ScreenMicIcon size={22} />
        화면 녹화로 설명하기
      </button>
      {onStartCapture ? (
        <button type="button" className={styles.captureButton} onClick={onStartCapture} disabled={isDisabled}>
          <CaptureIcon size={22} />
          화면 캡처로 설명하기
        </button>
      ) : null}
      {showHint ? <p className={styles.hint}>최대 3분이에요. 글로 남기려면 아래에 적어 주세요</p> : null}
    </div>
  );
}
