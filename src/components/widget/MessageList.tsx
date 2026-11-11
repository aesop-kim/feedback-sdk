"use client";

import { useEffect, useRef } from "react";
import { ClarificationCard } from "@/components/widget/ClarificationCard";
import { MessageBubble } from "@/components/widget/MessageBubble";
import { RecordingMessage } from "@/components/widget/RecordingMessage";
import { ReverifyCard } from "@/components/widget/ReverifyCard";
import { needsRerecord } from "@/lib/feedback/recording-status-label";
import { formatMessageTime, getMinuteKey } from "@/lib/recording/format-recording-time";
import type { PendingUpload } from "@/hooks/use-widget-recording";
import { findReverifyPrompt } from "@/lib/widget/reverify-prompt";
import type { ChatMessage, ReverifyRequest } from "@/types/feedback";
import styles from "@/components/widget/MessageList.module.css";

// 목록 항목 사이 간격(4px)과 같게 두어, 카드 위로 앞 말풍선 끝자락이 비치지 않게 한다.
const CARD_SCROLL_MARGIN = 4;

export type PendingText = { localId: string; body: string; isFailed: boolean };

type MessageListProps = {
  messages: ChatMessage[];
  reverifyRequest: ReverifyRequest | null | undefined;
  pendingTexts: PendingText[];
  pendingUpload: PendingUpload | null;
  onAnswer: (cardId: string, answer: { optionId?: string; text?: string }) => Promise<void>;
  onRetryText: (localId: string) => void;
  onStartReverify: (issueId: string | null) => void;
  onRetryUpload: () => void;
  onStartRecording: () => void;
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

// 마지막 메시지가 아직 답하지 않은 질문 카드면 그 id.
function findWaitingCardMessageId(messages: ChatMessage[]): string | null {
  const lastMessage = messages.at(-1);
  if (lastMessage?.type !== "clarification" || !lastMessage.clarification || lastMessage.clarification.answeredAt) {
    return null;
  }
  return lastMessage.id;
}

// 다시 녹화하기는 가장 최근 녹화에만 단다. 그 뒤에 새로 보냈으면 이미 다시 녹화한 것이다.
function findRerecordMessageId(messages: ChatMessage[], hasPendingUpload: boolean): string | null {
  const latestRecordingMessage = messages.findLast((message) => message.type === "recording" && message.recording);
  if (hasPendingUpload || !latestRecordingMessage?.recording || !needsRerecord(latestRecordingMessage.recording)) {
    return null;
  }
  return latestRecordingMessage.id;
}

type MessageContentProps = {
  message: ChatMessage;
  showSenderName: boolean;
  onAnswer: MessageListProps["onAnswer"];
  onRerecord: (() => void) | undefined;
};

function MessageContent({ message, showSenderName, onAnswer, onRerecord }: MessageContentProps) {
  if (message.type === "clarification" && message.clarification) {
    return (
      <>
        {showSenderName && message.sender === "admin" ? <span className={styles.senderName}>래티스</span> : null}
        <ClarificationCard card={message.clarification} onAnswer={onAnswer} />
      </>
    );
  }
  if (message.type === "recording" && message.recording) {
    return (
      <RecordingMessage
        durationMs={message.recording.durationMs}
        status={message.recording.status}
        failureKind={message.recording.failureKind}
        issueCount={message.recording.issueCount}
        onRerecord={onRerecord}
      />
    );
  }
  return <MessageBubble sender={message.sender} body={message.body} showSenderName={showSenderName} />;
}

export function MessageList({
  messages,
  reverifyRequest,
  pendingTexts,
  pendingUpload,
  onAnswer,
  onRetryText,
  onStartReverify,
  onRetryUpload,
  onStartRecording,
}: MessageListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const itemCount = messages.length + pendingTexts.length + (pendingUpload ? 1 : 0);

  const waitingCardMessageId = findWaitingCardMessageId(messages);
  const reverifyPrompt = findReverifyPrompt(messages, reverifyRequest);
  const rerecordMessageId = findRerecordMessageId(messages, pendingUpload !== null);

  useEffect(() => {
    // scrollIntoView는 고객사 페이지까지 스크롤할 수 있어서, 감싼 스크롤 영역만 직접 움직인다.
    const list = listRef.current;
    const scrollContainer = list?.closest<HTMLElement>("[data-widget-scroll]");
    if (!list || !scrollContainer) {
      return;
    }
    // 새 질문 카드는 패널보다 길 수 있다. 맨 아래가 아니라 카드 윗부분(장면과 질문)이 보이게 맞춘다.
    const waitingCard = waitingCardMessageId ? list.querySelector<HTMLElement>(`[data-message-id="${waitingCardMessageId}"]`) : null;
    if (waitingCard) {
      const offset = waitingCard.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top;
      scrollContainer.scrollTop += offset - CARD_SCROLL_MARGIN;
      return;
    }
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }, [itemCount, waitingCardMessageId]);

  return (
    // role="log"를 ol에 직접 주면 li의 목록 의미가 사라져서(axe listitem), 래퍼에 주고 ol/li는 그대로 둔다.
    <div role="log" aria-live="polite" aria-label="대화">
      <ol ref={listRef} className={styles.list}>
        {messages.map((message, index) => (
          <li
            key={message.id}
            className={styles.item}
            data-message-id={message.id}
            data-sender={message.sender}
            data-group-start={isGroupStart(messages, index)}
          >
            {reverifyPrompt?.messageId === message.id ? (
              <ReverifyCard title={reverifyPrompt.title} onStart={() => onStartReverify(reverifyPrompt.issueId)} />
            ) : (
              <MessageContent
                message={message}
                showSenderName={isGroupStart(messages, index)}
                onAnswer={onAnswer}
                onRerecord={rerecordMessageId === message.id ? onStartRecording : undefined}
              />
            )}
            {message.sender !== "system" && isGroupEnd(messages, index) ? (
              <time className={styles.time} dateTime={message.createdAt}>
                {formatMessageTime(message.createdAt)}
              </time>
            ) : null}
          </li>
        ))}
        {pendingTexts.map((pendingText) => (
          <li key={pendingText.localId} className={styles.item} data-sender="user">
            <MessageBubble
              sender="user"
              body={pendingText.body}
              showSenderName={false}
              isPending={!pendingText.isFailed}
              onRetry={pendingText.isFailed ? () => onRetryText(pendingText.localId) : undefined}
            />
          </li>
        ))}
        {pendingUpload ? (
          <li className={styles.item} data-sender="user" data-group-start="true">
            <RecordingMessage
              durationMs={pendingUpload.durationMs}
              status={pendingUpload.isFailed ? "upload_failed" : "uploading"}
              issueCount={0}
              uploadProgress={pendingUpload.progress}
              onRetry={pendingUpload.isFailed ? onRetryUpload : undefined}
            />
          </li>
        ) : null}
      </ol>
    </div>
  );
}
