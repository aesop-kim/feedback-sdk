"use client";

import { useRef, useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import { IssueItem } from "@/components/admin/IssueItem";
import { RecordingPlayer, type RecordingPlayerHandle } from "@/components/admin/RecordingPlayer";
import { TranscriptSection } from "@/components/admin/TranscriptSection";
import styles from "@/components/admin/RecordingAnalysisPanel.module.css";
import { useAdminRequest } from "@/hooks/use-admin-request";
import { useAdminRevision } from "@/hooks/use-admin-revision";
import type { Issue, RecordingDetail } from "@/types/feedback";

type RecordingAnalysisPanelProps = {
  recordings: RecordingDetail[];
  selectedRecordingId: string | null;
  onSelectRecording: (recordingId: string) => void;
};

// API는 최신 녹화가 먼저 오지만, 번호는 보낸 순서(1이 첫 녹화)로 붙인다.
export function RecordingAnalysisPanel({ recordings, selectedRecordingId, onSelectRecording }: RecordingAnalysisPanelProps) {
  const orderedRecordings = [...recordings].reverse();
  const selectedIndex = orderedRecordings.findIndex((recording) => recording.id === selectedRecordingId);
  const recording = orderedRecordings[selectedIndex];

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>녹화 분석</h2>
        {orderedRecordings.length > 1 && recording ? (
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerButton}
              onClick={() => onSelectRecording(orderedRecordings[selectedIndex - 1].id)}
              disabled={selectedIndex === 0}
              aria-label="이전 녹화"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className={styles.pagerLabel} aria-live="polite">
              {selectedIndex + 1}/{orderedRecordings.length}
            </span>
            <button
              type="button"
              className={styles.pagerButton}
              onClick={() => onSelectRecording(orderedRecordings[selectedIndex + 1].id)}
              disabled={selectedIndex === orderedRecordings.length - 1}
              aria-label="다음 녹화"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}
      </header>
      {recording ? (
        // 분석이 끝나 상태가 바뀌면 다시 마운트해서, 확인이 필요한 이슈가 기본으로 펼쳐지게 한다.
        <RecordingAnalysis key={`${recording.id}:${recording.status}`} recording={recording} />
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>아직 받은 녹화가 없어요</p>
          <p className={styles.caption}>고객이 화면을 녹화해 보내면 말한 내용과 문제를 여기에 정리해요.</p>
        </div>
      )}
    </div>
  );
}

function needsCheck(issue: Issue): boolean {
  return issue.confidence === "ambiguous" && issue.status === "open";
}

function findDefaultOpenIssueId(issues: Issue[]): string | null {
  return (issues.find(needsCheck) ?? issues[0])?.id ?? null;
}

function RecordingAnalysis({ recording }: { recording: RecordingDetail }) {
  const playerRef = useRef<RecordingPlayerHandle>(null);
  const [openIssueId, setOpenIssueId] = useState<string | null>(() => findDefaultOpenIssueId(recording.issues));

  if (recording.status === "uploading") {
    return <AnalysisPending message="고객이 영상을 올리고 있어요. 잠시만 기다려 주세요" />;
  }
  if (recording.status === "uploaded" || recording.status === "analyzing") {
    return <AnalysisPending message="말한 내용을 정리하고 있어요. 보통 1분 안에 끝나요" />;
  }
  if (recording.status === "failed") {
    return <AnalysisFailed recordingId={recording.id} />;
  }

  const checkCount = recording.issues.filter(needsCheck).length;
  const seekTo = (milliseconds: number) => playerRef.current?.seekTo(milliseconds);

  return (
    <>
      <RecordingPlayer ref={playerRef} recording={recording} />
      <div className={styles.summaryLine}>
        <h3 className={styles.summaryTitle}>
          문제 <span className={styles.summaryNumber}>{recording.issues.length}</span>건
        </h3>
        {checkCount > 0 ? (
          <span className={styles.summaryAttention}>
            <span className={styles.attentionDot} aria-hidden="true" />
            확인 필요 {checkCount}건
          </span>
        ) : null}
      </div>
      {recording.issues.length === 0 ? (
        <p className={styles.noIssue}>이번 녹화에서는 고칠 점을 찾지 못했어요. 아래에서 말한 내용을 확인해 보세요.</p>
      ) : (
        <ol className={styles.issues}>
          {recording.issues.map((issue, index) => (
            <IssueItem
              key={issue.id}
              issue={issue}
              index={index + 1}
              isOpen={openIssueId === issue.id}
              onToggle={() => setOpenIssueId((current) => (current === issue.id ? null : issue.id))}
              onSeek={seekTo}
            />
          ))}
        </ol>
      )}
      <TranscriptSection segments={recording.transcript} onSeek={seekTo} />
    </>
  );
}

function AnalysisPending({ message }: { message: string }) {
  return (
    <div className={styles.pending} aria-busy="true">
      <span className={styles.skeletonVideo} />
      <span className={styles.skeletonLine} />
      <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <p className={styles.pendingMessage} role="status">
        {message}
      </p>
    </div>
  );
}

function AnalysisFailed({ recordingId }: { recordingId: string }) {
  const request = useAdminRequest();
  const { refresh } = useAdminRevision();
  const [isRequesting, setIsRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reanalyze() {
    setIsRequesting(true);
    setMessage(null);
    const result = await request<{ queued: boolean }>(`/api/admin/recordings/${recordingId}/reanalyze`, { method: "POST" });
    setIsRequesting(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (!result.body.queued) {
      setMessage("방금 요청했어요. 1분 뒤에 다시 해볼까요?");
      return;
    }
    refresh();
  }

  return (
    <div className={styles.failed}>
      <p className={styles.failedTitle}>말한 내용을 정리하지 못했어요</p>
      <p className={styles.caption}>영상은 안전하게 받아 두었어요. 다시 정리하면 보통 1분 안에 끝나요.</p>
      <AdminButton variant="weak" size="small" onClick={() => void reanalyze()} isLoading={isRequesting}>
        다시 정리하기
      </AdminButton>
      {message ? (
        <p className={styles.failedMessage} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
