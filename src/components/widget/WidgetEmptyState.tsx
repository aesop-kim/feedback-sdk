import { ScreenMicIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetEmptyState.module.css";

type WidgetEmptyStateProps = { onStartRecording: () => void; isRecordingDisabled: boolean };

const RECORDING_STEPS = [
  "녹화를 누르고 ‘이 탭’을 골라요",
  "문제가 있는 곳을 가리키며 말해요",
  "끝내기를 누르면 저희가 정리해서 확인해요",
];

export function WidgetEmptyState({ onStartRecording, isRecordingDisabled }: WidgetEmptyStateProps) {
  return (
    <section className={styles.emptyState}>
      <div>
        <h2 className={styles.title}>화면을 보여주며 말로 알려주세요</h2>
        <p className={styles.description}>어느 화면의 어떤 버튼인지 따로 적지 않아도 돼요</p>
        <ol className={styles.steps}>
          {RECORDING_STEPS.map((step, index) => (
            <li key={step} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.action}>
        <button type="button" className={styles.primaryButton} onClick={onStartRecording} disabled={isRecordingDisabled}>
          <ScreenMicIcon size={22} />
          화면 녹화로 설명하기
        </button>
        <p className={styles.hint}>최대 3분이에요. 글로 남기려면 아래에 적어 주세요</p>
      </div>
    </section>
  );
}
