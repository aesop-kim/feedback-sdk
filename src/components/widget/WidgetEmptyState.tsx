import styles from "@/components/widget/WidgetEmptyState.module.css";

const RECORDING_STEPS = [
  "녹화를 누르고 ‘이 탭’을 골라요",
  "문제가 있는 곳을 가리키며 말해요",
  "녹화를 끝내고 확인한 뒤 보내요",
];

export function WidgetEmptyState() {
  return (
    <section className={styles.emptyState}>
      <h2 className={styles.title}>말로 설명하면 저희가 정리할게요</h2>
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
    </section>
  );
}
