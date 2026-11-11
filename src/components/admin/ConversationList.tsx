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
        {/* 설치 방법은 가운데 칸이 안내한다. 같은 말을 두 번 하지 않게 여기에는 제목만 둔다. */}
        <p className={styles.emptyTitle}>아직 받은 의견이 없어요</p>
      </div>
    );
  }
  const duplicateNames = findDuplicateNames(conversations);
  return (
    <ul className={styles.rows}>
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <ConversationRow
            conversation={conversation}
            isSelected={conversation.id === selectedConversationId}
            identifier={duplicateNames.has(conversation.endUser.name) ? getEndUserIdentifier(conversation.endUser) : null}
          />
        </li>
      ))}
    </ul>
  );
}

function findDuplicateNames(conversations: ConversationSummary[]): Set<string> {
  const seenNames = new Set<string>();
  const duplicateNames = new Set<string>();
  for (const { endUser } of conversations) {
    if (seenNames.has(endUser.name)) {
      duplicateNames.add(endUser.name);
    }
    seenNames.add(endUser.name);
  }
  return duplicateNames;
}

// 이름이 같은 고객을 가르는 짧은 표시: 이메일 앞부분, 없으면 외부 ID.
function getEndUserIdentifier(endUser: ConversationSummary["endUser"]): string {
  const emailLocalPart = endUser.email?.split("@")[0];
  return emailLocalPart || endUser.externalId;
}

// 배지 대신 한 줄 캡션으로: "녹화 1개 · 남은 문제 3건"
function getMetaItems(conversation: ConversationSummary): string[] {
  const items: string[] = [];
  if (conversation.recordingCount > 0) {
    items.push(`녹화 ${conversation.recordingCount}개`);
  }
  if (conversation.openIssueCount > 0) {
    items.push(`남은 문제 ${conversation.openIssueCount}건`);
  }
  return items;
}

type ConversationRowProps = { conversation: ConversationSummary; isSelected: boolean; identifier: string | null };

function ConversationRow({ conversation, isSelected, identifier }: ConversationRowProps) {
  const hasUnread = conversation.adminUnreadCount > 0;
  const metaItems = getMetaItems(conversation);
  return (
    <Link
      href={`/admin/${conversation.id}`}
      className={isSelected ? `${styles.row} ${styles.selected}` : styles.row}
      aria-current={isSelected ? "page" : undefined}
    >
      <div className={styles.topLine}>
        <span className={styles.name}>
          {conversation.endUser.name}
          {identifier ? <span className={styles.identifier}> · {identifier}</span> : null}
        </span>
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
      {metaItems.length > 0 ? <p className={styles.metaLine}>{metaItems.join(" · ")}</p> : null}
    </Link>
  );
}
