import { CloseIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetHeader.module.css";

const GREETING = "불편한 점을 보여 주세요";
const FALLBACK_COMPACT_TITLE = "피드백 보내기";

// isCompact: 대화가 시작되면 인사말을 접고 회사 이름 한 줄만 남겨 대화 칸을 넓힌다.
type WidgetHeaderProps = { projectName: string; userName: string; isCompact: boolean; onClose: () => void };

function getGreeting(userName: string): string {
  return userName ? `${userName}님, ${GREETING}` : GREETING;
}

export function WidgetHeader({ projectName, userName, isCompact, onClose }: WidgetHeaderProps) {
  return (
    <header className={styles.header} data-compact={isCompact}>
      <div className={styles.text}>
        {isCompact ? (
          <h1 className={styles.compactTitle}>{projectName || FALLBACK_COMPACT_TITLE}</h1>
        ) : (
          <>
            {projectName ? <p className={styles.caption}>{projectName}</p> : null}
            <h1 className={styles.title}>{getGreeting(userName)}</h1>
          </>
        )}
      </div>
      <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">
        <CloseIcon size={22} />
      </button>
    </header>
  );
}
