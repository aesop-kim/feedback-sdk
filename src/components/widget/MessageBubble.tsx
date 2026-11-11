import type { ChatMessage } from "@/types/feedback";
import styles from "@/components/widget/MessageBubble.module.css";

type MessageBubbleProps = Pick<ChatMessage, "sender" | "body"> & { showSenderName: boolean; isPending?: boolean };

export function MessageBubble({ sender, body, showSenderName, isPending = false }: MessageBubbleProps) {
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
      <p className={`${styles.bubble} ${styles.userBubble}`} data-pending={isPending}>
        {body}
      </p>
    </div>
  );
}
