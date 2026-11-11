import styles from "@/components/widget/MessageSkeleton.module.css";

const SKELETON_ROWS = [
  { side: "left", width: "62%" },
  { side: "right", width: "48%" },
  { side: "left", width: "74%" },
] as const;

export function MessageSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="대화를 불러오고 있어요">
      {SKELETON_ROWS.map((row, index) => (
        <span key={index} className={styles.bubble} data-side={row.side} style={{ width: row.width }} />
      ))}
    </div>
  );
}
