"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import { ConversationList } from "@/components/admin/ConversationList";
import { LatticeMark } from "@/components/admin/LatticeMark";
import styles from "@/components/admin/AdminShell.module.css";
import { AdminConversationListContext } from "@/hooks/use-admin-conversation-list";
import { useAdminConversations } from "@/hooks/use-admin-conversations";
import { AdminRevisionContext } from "@/hooks/use-admin-revision";
import { useRealtimeSignal } from "@/hooks/use-realtime-signal";
import { getAdminChannelName } from "@/lib/realtime/realtime-signal";

// 관리자 화면 뼈대: 상단 바 + 왼쪽 대화 목록. 가운데(대화)·오른쪽(녹화 분석)은 children.
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const { data, errorMessage, isLoading } = useAdminConversations(revision);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useRealtimeSignal(data?.projectId ? getAdminChannelName(data.projectId) : null, refresh);

  const revisionValue = useMemo(() => ({ revision, refresh }), [revision, refresh]);
  const conversationCount = data ? data.conversations.length : null;
  const conversationListValue = useMemo(() => ({ conversationCount }), [conversationCount]);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => null);
    router.replace("/admin/login");
  }

  return (
    <AdminRevisionContext value={revisionValue}>
      <div className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.wordmark}>
            <LatticeMark />
            <span>래티스 피드백</span>
          </div>
          <div className={styles.account}>
            {data?.projectName ? <span className={styles.projectName}>{data.projectName}</span> : null}
            <span className={styles.divider} aria-hidden="true" />
            <AdminButton variant="text" size="small" onClick={handleLogout} disabled={isLoggingOut}>
              로그아웃
            </AdminButton>
          </div>
        </header>
        <div className={styles.body}>
          <nav className={styles.listColumn} aria-label="받은 대화">
            <ConversationList
              conversations={data?.conversations ?? []}
              selectedConversationId={params.conversationId ?? null}
              isLoading={isLoading}
              errorMessage={errorMessage}
            />
          </nav>
          <AdminConversationListContext value={conversationListValue}>{children}</AdminConversationListContext>
        </div>
      </div>
    </AdminRevisionContext>
  );
}
