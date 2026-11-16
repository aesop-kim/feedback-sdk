import { CloseIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetHeader.module.css";

const GREETING = "불편한 점을 보여주세요";

type WidgetHeaderProps = { projectName: string; userName: string; onClose: () => void };

function getGreeting(userName: string): string {
  return userName ? `${userName}님, ${GREETING}` : GREETING;
}

export function WidgetHeader({ projectName, userName, onClose }: WidgetHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {projectName ? <p className={styles.caption}>{projectName}</p> : null}
        <h1 className={styles.title}>{getGreeting(userName)}</h1>
      </div>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
        <CloseIcon size={22} />
      </button>
    </header>
  );
}
