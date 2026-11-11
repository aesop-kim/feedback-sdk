"use client";

import { Fragment, useEffect, useRef } from "react";
import { ReplyComposer } from "@/components/admin/ReplyComposer";
import { ThreadMessage } from "@/components/admin/ThreadMessage";
import styles from "@/components/admin/ConversationThread.module.css";
import { formatCalendarDate, formatRelativeTime, isSameCalendarDay } from "@/lib/format/date-format";
import type { ConversationDetail } from "@/types/feedback";

type ConversationThreadProps = {
  conversation: ConversationDetail;
  selectedRecordingId: string | null;
  onSelectRecording: (recordingId: string) => void;
};

export function ConversationThread({ conversation, selectedRecordingId, onSelectRecording }: ConversationThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageId = conversation.messages.at(-1)?.id;

  // 새 메시지가 오면 맨 아래로.
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [lastMessageId]);

  const { endUser } = conversation;
  const reverifyRecordingIds = new Set(
    conversation.recordings.filter((recording) => recording.reverifyIssueId).map((recording) => recording.id),
  );

  return (
    <div className={styles.thread}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <h1 className={styles.name}>{endUser.name}</h1>
          <p className={styles.contact}>
            {endUser.email ? <span>{endUser.email}</span> : null}
            <span className={styles.externalId}>{endUser.externalId}</span>
          </p>
        </div>
        <p className={styles.activity}>
          마지막 활동 <time dateTime={conversation.lastMessageAt}>{formatRelativeTime(conversation.lastMessageAt)}</time>
        </p>
      </header>

      {/* 새 메시지(고객 답장·답변)가 오면 화면 낭독기가 읽도록 log 영역으로 둔다(UX-15). */}
      <div ref={scrollRef} className={styles.messages} role="log" aria-live="polite" aria-label="주고받은 메시지">
        {conversation.messages.length === 0 ? <p className={styles.empty}>아직 주고받은 메시지가 없어요</p> : null}
        {conversation.messages.map((message, index) => {
          const previousMessage = conversation.messages[index - 1];
          const isNewDay = !previousMessage || !isSameCalendarDay(previousMessage.createdAt, message.createdAt);
          const nextMessage = conversation.messages[index + 1];
          const isGroupEnd =
            !nextMessage ||
            nextMessage.sender !== message.sender ||
            new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime() > 60_000;
          return (
            <Fragment key={message.id}>
              {isNewDay ? (
                <div className={styles.daySeparator}>
                  <span>{formatCalendarDate(message.createdAt)}</span>
                </div>
              ) : null}
              <ThreadMessage
                message={message}
                showTime={isGroupEnd}
                isRecordingSelected={message.recording?.id === selectedRecordingId}
                isReverifyRecording={Boolean(message.recording && reverifyRecordingIds.has(message.recording.id))}
                onSelectRecording={onSelectRecording}
              />
            </Fragment>
          );
        })}
      </div>

      <ReplyComposer conversationId={conversation.id} customerName={endUser.name} />
    </div>
  );
}
