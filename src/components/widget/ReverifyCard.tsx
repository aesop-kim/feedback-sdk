import { ScreenMicIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/ReverifyCard.module.css";

type ReverifyCardProps = { title: string; onStart: () => void };

// 관리자가 "반영 완료"를 누르면 오는 안내. 회색 캡션 대신 카드로 보여 주고, 고친 화면을 다시 녹화하게 한다.
export function ReverifyCard({ title, onStart }: ReverifyCardProps) {
  return (
    <section className={styles.card} aria-label="수정 확인 요청">
      <p className={styles.heading}>고쳤어요. 한 번 확인해 주세요</p>
      {title ? <p className={styles.issueTitle}>‘{title}’</p> : null}
      <p className={styles.description}>같은 화면에서 다시 해 보고, 말로 알려 주세요</p>
      <button type="button" className={styles.startButton} onClick={onStart}>
        <ScreenMicIcon size={22} />
        다시 녹화해서 확인하기
      </button>
    </section>
  );
}
