import styles from "@/app/admin/(dashboard)/dashboard-page.module.css";

export default function AdminHomePage() {
  return (
    <>
      <section className={styles.placeholder}>
        <p className={styles.title}>대화를 골라 주세요</p>
        <p className={styles.caption}>왼쪽 목록에서 대화를 고르면 주고받은 메시지와 녹화 분석을 함께 볼 수 있어요.</p>
      </section>
      <aside className={styles.sideColumn} aria-hidden="true" />
    </>
  );
}
