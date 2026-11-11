"use client";

import { useEffect, useRef } from "react";
import { ClarificationCard } from "@/components/widget/ClarificationCard";
import { MessageBubble } from "@/components/widget/MessageBubble";
import { RecordingMessage } from "@/components/widget/RecordingMessage";
import { formatMessageTime, getMinuteKey } from "@/lib/recording/format-recording-time";
import type { PendingUpload } from "@/hooks/use-widget-recording";
import type { ChatMessage } from "@/types/feedback";
import styles from "@/components/widget/MessageList.module.css";

export type PendingText = { localId: string; body: string };

type MessageListProps = {
  messages: ChatMessage[];
  pendingTexts: PendingText[];
  pendingUpload: PendingUpload | null;
  onAnswer: (cardId: string, answer: { optionId?: string; text?: string }) => Promise<void>;
  onRetryUpload: () => void;
};

// 같은 사람이 같은 분에 보낸 메시지는 한 묶음으로 보고, 묶음 끝에만 시각을 단다.
function isGroupEnd(messages: ChatMessage[], index: number): boolean {
  const next = messages[index + 1];
  const current = messages[index];
  return !next || next.sender !== current.sender || getMinuteKey(next.createdAt) !== getMinuteKey(current.createdAt);
}

function isGroupStart(messages: ChatMessage[], index: number): boolean {
  const previous = messages[index - 1];
  return !previous || previous.sender !== messages[index].sender;
}

function MessageContent({ message, showSenderName, onAnswer }: { message: ChatMessage; showSenderName: boolean } & Pick<MessageListProps, "onAnswer">) {
  if (message.type === "clarification" && message.clarification) {
    return <ClarificationCard card={message.clarification} onAnswer={onAnswer} />;
  }
  if (message.type === "recording" && message.recording) {
    return (
      <RecordingMessage
        durationMs={message.recording.durationMs}
        status={message.recording.status}
        issueCount={message.recording.issueCount}
      />
    );
  }
  return <MessageBubble sender={message.sender} body={message.body} showSenderName={showSenderName} />;
}

export function MessageList({ messages, pendingTexts, pendingUpload, onAnswer, onRetryUpload }: MessageListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const itemCount = messages.length + pendingTexts.length + (pendingUpload ? 1 : 0);

  useEffect(() => {
    // scrollIntoView는 고객사 페이지까지 스크롤할 수 있어서, 감싼 스크롤 영역만 직접 내린다.
    const scrollContainer = listRef.current?.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [itemCount]);

  return (
    <ol ref={listRef} className={styles.list}>
      {messages.map((message, index) => (
        <li key={message.id} className={styles.item} data-sender={message.sender} data-group-start={isGroupStart(messages, index)}>
          <MessageContent message={message} showSenderName={isGroupStart(messages, index)} onAnswer={onAnswer} />
          {message.sender !== "system" && isGroupEnd(messages, index) ? (
            <time className={styles.time} dateTime={message.createdAt}>
              {formatMessageTime(message.createdAt)}
            </time>
          ) : null}
        </li>
      ))}
      {pendingTexts.map((pendingText) => (
        <li key={pendingText.localId} className={styles.item} data-sender="user">
          <MessageBubble sender="user" body={pendingText.body} showSenderName={false} isPending />
        </li>
      ))}
      {pendingUpload ? (
        <li className={styles.item} data-sender="user" data-group-start="true">
          <RecordingMessage
            durationMs={pendingUpload.durationMs}
            status={pendingUpload.isFailed ? "failed" : "uploading"}
            issueCount={0}
            uploadProgress={pendingUpload.progress}
            onRetry={pendingUpload.isFailed ? onRetryUpload : undefined}
          />
        </li>
      ) : null}
    </ol>
  );
}
