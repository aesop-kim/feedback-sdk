import styles from "@/components/admin/LatticeMark.module.css";

// 래티스 로고 마크: 파란 정사각형 안에 2x2 격자.
export function LatticeMark() {
  return (
    <svg className={styles.mark} width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect width="20" height="20" rx="5" fill="currentColor" />
      <rect x="5" y="5" width="4" height="4" rx="1" className={styles.cell} />
      <rect x="11" y="5" width="4" height="4" rx="1" className={styles.cell} />
      <rect x="5" y="11" width="4" height="4" rx="1" className={styles.cell} />
      <rect x="11" y="11" width="4" height="4" rx="1" className={styles.cellDim} />
    </svg>
  );
}
