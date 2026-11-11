import styles from "@/components/admin/ThreadMessage.module.css";
import { getAdminRecordingStateLabel } from "@/lib/feedback/recording-status-label";
import { formatClockTime } from "@/lib/format/date-format";
import { formatDuration } from "@/lib/format/duration-format";
import type { ChatMessage, ClarificationCard, RecordingSummary } from "@/types/feedback";

type ThreadMessageProps = {
  message: ChatMessage;
  showTime: boolean;
  isRecordingSelected: boolean;
  isReverifyRecording: boolean;
  onSelectRecording: (recordingId: string) => void;
};

export function ThreadMessage({ message, showTime, isRecordingSelected, isReverifyRecording, onSelectRecording }: ThreadMessageProps) {
  if (message.sender === "system" || message.type === "system") {
    return <p className={styles.system}>{message.body}</p>;
  }

  const sideClassName = message.sender === "admin" ? styles.fromAdmin : styles.fromUser;
  const time = showTime ? (
    <time className={styles.time} dateTime={message.createdAt}>
      {formatClockTime(message.createdAt)}
    </time>
  ) : null;

  return (
    <div className={`${styles.row} ${sideClassName} ${showTime ? styles.groupEnd : ""}`}>
      <MessageContent
        message={message}
        isRecordingSelected={isRecordingSelected}
        isReverifyRecording={isReverifyRecording}
        onSelectRecording={onSelectRecording}
      />
      {time}
    </div>
  );
}

function MessageContent({ message, isRecordingSelected, isReverifyRecording, onSelectRecording }: Omit<ThreadMessageProps, "showTime">) {
  if (message.type === "recording" && message.recording) {
    return (
      <RecordingRow
        recording={message.recording}
        isSelected={isRecordingSelected}
        isReverify={isReverifyRecording}
        onSelect={onSelectRecording}
      />
    );
  }
  if (message.type === "clarification" && message.clarification) {
    return <ClarificationSummary card={message.clarification} />;
  }
  return <p className={styles.bubble}>{message.body}</p>;
}

function RecordingRow({
  recording,
  isSelected,
  isReverify,
  onSelect,
}: {
  recording: RecordingSummary;
  isSelected: boolean;
  isReverify: boolean;
  onSelect: (recordingId: string) => void;
}) {
  return (
    <button
      type="button"
      className={isSelected ? `${styles.recording} ${styles.recordingSelected}` : styles.recording}
      onClick={() => onSelect(recording.id)}
      aria-pressed={isSelected}
    >
      <span className={styles.recordingIcon} aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="3.5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M10.5 7 14.5 4.5v7L10.5 9" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={styles.recordingLabel}>
        {isReverify ? "다시 확인 녹화" : "화면 녹화"} <span className={styles.number}>{formatDuration(recording.durationMs)}</span>
        <span className={styles.dot}>·</span>
        <span className={recording.status === "failed" ? styles.recordingFailed : undefined}>{getAdminRecordingStateLabel(recording, isReverify)}</span>
      </span>
      <svg className={styles.chevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function findAnswerLabel(card: ClarificationCard): string | null {
  if (!card.answer) {
    return null;
  }
  const optionLabel = card.options.find((option) => option.id === card.answer?.optionId)?.label;
  return [optionLabel, card.answer.text].filter(Boolean).join(" · ") || null;
}

function ClarificationSummary({ card }: { card: ClarificationCard }) {
  const answerLabel = findAnswerLabel(card);
  return (
    <div className={styles.clarification}>
      <p className={styles.clarificationQuestion}>
        <span className={styles.clarificationLead}>질문을 보냈어요</span>
        {card.question}
      </p>
      {answerLabel ? (
        <p className={styles.clarificationAnswer}>
          <span className={styles.answerLabel}>고객 답변</span>
          {answerLabel}
        </p>
      ) : (
        <p className={styles.clarificationWaiting}>답변을 기다리고 있어요</p>
      )}
    </div>
  );
}
