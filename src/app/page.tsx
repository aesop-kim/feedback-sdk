import Link from "next/link";
import styles from "@/app/home-page.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>래티스 피드백</p>
      <h1 className={styles.title}>화면을 보여주며 말로 남기는 피드백</h1>
      <p className={styles.description}>
        고객사 페이지에 스크립트 한 줄을 넣으면 의견 창이 열려요. 고객은 화면을 녹화하며 말로 설명하고, 관리자는 정리된 문제 목록으로 받아요.
      </p>
      <Link href="/admin" className={styles.link}>
        관리자 화면으로 가기
      </Link>
    </main>
  );
}
