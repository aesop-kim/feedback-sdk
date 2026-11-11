"use client";

import Link from "next/link";
import styles from "@/components/admin/ConversationList.module.css";
import { formatRelativeTime } from "@/lib/format/date-format";
import type { ConversationSummary } from "@/types/feedback";

const SKELETON_ROW_COUNT = 6;

type ConversationListProps = {
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  isLoading: boolean;
  errorMessage: string | null;
};

export function ConversationList({ conversations, selectedConversationId, isLoading, errorMessage }: ConversationListProps) {
  return (
    <div className={styles.list}>
      <div className={styles.header}>
        <h2 className={styles.heading}>받은 의견</h2>
        {conversations.length > 0 ? <span className={styles.count}>{conversations.length}</span> : null}
      </div>
      <ConversationListBody
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    </div>
  );
}

function ConversationListBody({ conversations, selectedConversationId, isLoading, errorMessage }: ConversationListProps) {
  if (isLoading) {
    return (
      <ul className={styles.rows} aria-busy="true" aria-label="대화 목록을 불러오고 있어요">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <li key={index} className={styles.skeletonRow}>
            <span className={styles.skeletonName} />
            <span className={styles.skeletonPreview} />
            <span className={styles.skeletonMeta} />
          </li>
        ))}
      </ul>
    );
  }
  if (conversations.length === 0 && errorMessage) {
    return <p className={styles.notice}>{errorMessage}</p>;
  }
  if (conversations.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>아직 받은 의견이 없어요</p>
        <p className={styles.emptyCaption}>고객이 위젯으로 의견을 보내면 여기에 바로 보여요.</p>
      </div>
    );
  }
  return (
    <ul className={styles.rows}>
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationRow conversation={conversation} isSelected={conversation.id === selectedConversationId} />
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({ conversation, isSelected }: { conversation: ConversationSummary; isSelected: boolean }) {
  const hasUnread = conversation.adminUnreadCount > 0;
  return (
    <Link
      href={`/admin/${conversation.id}`}
      className={isSelected ? `${styles.row} ${styles.selected}` : styles.row}
      aria-current={isSelected ? "page" : undefined}
    >
      <div className={styles.topLine}>
        <span className={styles.name}>{conversation.endUser.name}</span>
        <time className={styles.time} dateTime={conversation.lastMessageAt}>
          {formatRelativeTime(conversation.lastMessageAt)}
        </time>
      </div>
      <div className={styles.previewLine}>
        <span className={hasUnread ? `${styles.preview} ${styles.previewUnread}` : styles.preview}>
          {conversation.lastMessagePreview ?? "대화를 시작했어요"}
        </span>
        {hasUnread ? (
          <span className={styles.unread} aria-label={`안 읽은 메시지 ${conversation.adminUnreadCount}개`}>
            {conversation.adminUnreadCount}
          </span>
        ) : null}
      </div>
      {conversation.recordingCount > 0 || conversation.openIssueCount > 0 ? (
        <div className={styles.metaLine}>
          {conversation.recordingCount > 0 ? <span className={styles.chip}>녹화 {conversation.recordingCount}</span> : null}
          {conversation.openIssueCount > 0 ? (
            <span className={`${styles.chip} ${styles.chipAttention}`}>남은 문제 {conversation.openIssueCount}</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
