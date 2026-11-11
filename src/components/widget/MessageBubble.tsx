import type { ChatMessage } from "@/types/feedback";
import styles from "@/components/widget/MessageBubble.module.css";

type MessageBubbleProps = Pick<ChatMessage, "sender" | "body"> & {
  showSenderName: boolean;
  isPending?: boolean;
  // 있으면 보내지 못한 말풍선: 글은 그대로 두고 아래에 '다시 보내기'를 단다.
  onRetry?: () => void;
};

export function MessageBubble({ sender, body, showSenderName, isPending = false, onRetry }: MessageBubbleProps) {
  if (sender === "system") {
    return <p className={styles.systemCaption}>{body}</p>;
  }
  if (sender === "admin") {
    return (
      <div className={styles.adminRow}>
        {showSenderName ? <span className={styles.senderName}>래티스</span> : null}
        <p className={`${styles.bubble} ${styles.adminBubble}`}>{body}</p>
      </div>
    );
  }
  return (
    <div className={styles.userRow}>
      <p className={`${styles.bubble} ${styles.userBubble}`} data-pending={isPending} data-failed={Boolean(onRetry)}>
        {body}
      </p>
      {onRetry ? (
        <div className={styles.failedRow}>
          <span className={styles.failedText}>보내지 못했어요</span>
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            다시 보내기
          </button>
        </div>
      ) : null}
    </div>
  );
}
