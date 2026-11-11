import { CloseIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetHeader.module.css";

type WidgetHeaderProps = { projectName: string; userName: string; onClose: () => void };

export function WidgetHeader({ projectName, userName, onClose }: WidgetHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {projectName ? <p className={styles.caption}>{projectName}</p> : null}
        <h1 className={styles.title}>{userName ? `${userName}님, 무엇이든 알려주세요` : "무엇이든 알려주세요"}</h1>
      </div>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
        <CloseIcon size={22} />
      </button>
    </header>
  );
}
