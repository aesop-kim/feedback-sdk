import styles from "@/components/widget/LoadingDots.module.css";

// TDS 버튼 로더: 점 3개가 0.1초 간격으로 차례로 밝아진다. 버튼 글자 대신 넣는다.
export function LoadingDots({ label }: { label: string }) {
  return (
    <span className={styles.dots} role="status" aria-label={label}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  );
}
