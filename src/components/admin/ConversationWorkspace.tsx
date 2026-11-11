"use client";

import { useState } from "react";
import { ConversationThread } from "@/components/admin/ConversationThread";
import { RecordingAnalysisPanel } from "@/components/admin/RecordingAnalysisPanel";
import styles from "@/components/admin/ConversationWorkspace.module.css";
import { useAdminConversation } from "@/hooks/use-admin-conversation";
import { useAdminRevision } from "@/hooks/use-admin-revision";

// 가운데 대화 + 오른쪽 녹화 분석. 대화 속 녹화 줄을 누르면 오른쪽에서 그 녹화를 연다.
export function ConversationWorkspace({ conversationId }: { conversationId: string }) {
  const { revision } = useAdminRevision();
  const { detail, errorMessage, isLoading } = useAdminConversation(conversationId, revision);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);

  if (!detail) {
    return (
      <>
        <section className={styles.threadColumn} aria-busy={isLoading}>
          {errorMessage ? <p className={styles.notice}>{errorMessage}</p> : <ThreadSkeleton />}
        </section>
        <aside className={styles.analysisColumn} aria-busy={isLoading} />
      </>
    );
  }

  const recordingIds = detail.recordings.map((recording) => recording.id);
  const activeRecordingId =
    selectedRecordingId && recordingIds.includes(selectedRecordingId) ? selectedRecordingId : (recordingIds[0] ?? null);

  return (
    <>
      <section className={styles.threadColumn} aria-label={`${detail.endUser.name} 님과의 대화`}>
        <ConversationThread
          conversation={detail}
          selectedRecordingId={activeRecordingId}
          onSelectRecording={setSelectedRecordingId}
        />
      </section>
      <aside className={styles.analysisColumn} aria-label="녹화 분석">
        <RecordingAnalysisPanel
          recordings={detail.recordings}
          selectedRecordingId={activeRecordingId}
          onSelectRecording={setSelectedRecordingId}
        />
      </aside>
    </>
  );
}

function ThreadSkeleton() {
  return (
    <div className={styles.skeleton}>
      <span className={styles.skeletonTitle} />
      <span className={styles.skeletonCaption} />
      <span className={`${styles.skeletonBubble} ${styles.skeletonLeft}`} />
      <span className={`${styles.skeletonBubble} ${styles.skeletonRight}`} />
      <span className={`${styles.skeletonBubble} ${styles.skeletonLeft}`} />
    </div>
  );
}
