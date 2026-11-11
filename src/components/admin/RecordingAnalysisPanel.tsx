"use client";

import { useRef, useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import { IssueItem } from "@/components/admin/IssueItem";
import { RecordingPlayer, type RecordingPlayerHandle } from "@/components/admin/RecordingPlayer";
import { TranscriptSection } from "@/components/admin/TranscriptSection";
import styles from "@/components/admin/RecordingAnalysisPanel.module.css";
import { useAdminRequest } from "@/hooks/use-admin-request";
import { useAdminRevision } from "@/hooks/use-admin-revision";
import { getFailureGuidance } from "@/lib/feedback/recording-failure";
import { findLatestReverifyRecordingId, findReverifyOrigin, getReverifyRecordingLabel } from "@/lib/feedback/reverify-link";
import type { Issue, RecordingDetail, RecordingFailureKind } from "@/types/feedback";

type RecordingAnalysisPanelProps = {
  recordings: RecordingDetail[];
  selectedRecordingId: string | null;
  onSelectRecording: (recordingId: string) => void;
};

// API는 최신 녹화가 먼저 오지만, 번호는 보낸 순서(1이 첫 녹화)로 붙인다.
export function RecordingAnalysisPanel({ recordings, selectedRecordingId, onSelectRecording }: RecordingAnalysisPanelProps) {
  const playerRef = useRef<RecordingPlayerHandle>(null);
  // 재확인 녹화 ↔ 원래 이슈를 오갈 때 펼치고 초점을 줄 이슈.
  const [focusedIssueId, setFocusedIssueId] = useState<string | null>(null);
  const orderedRecordings = [...recordings].reverse();
  const selectedIndex = orderedRecordings.findIndex((recording) => recording.id === selectedRecordingId);
  const recording = orderedRecordings[selectedIndex];
  const reverifyOrigin = recording ? findReverifyOrigin(recordings, recording) : null;

  function openRecording(recordingId: string, issueId: string | null = null) {
    setFocusedIssueId(issueId);
    onSelectRecording(recordingId);
  }

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>녹화 분석</h2>
        {orderedRecordings.length > 1 && recording ? (
          <div className={styles.pager}>
            <button
              type="button"
              className={styles.pagerButton}
              onClick={() => openRecording(orderedRecordings[selectedIndex - 1].id)}
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
              onClick={() => openRecording(orderedRecordings[selectedIndex + 1].id)}
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
        <>
          {recording.reverifyIssueId ? (
            <div className={styles.reverifyBanner}>
              <p className={styles.reverifyLabel}>{getReverifyRecordingLabel(reverifyOrigin)}</p>
              {reverifyOrigin ? (
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => openRecording(reverifyOrigin.recordingId, reverifyOrigin.issueId)}
                >
                  원래 이슈 보기
                </button>
              ) : null}
            </div>
          ) : null}
          {/* 플레이어는 녹화가 바뀔 때만 다시 마운트해서, 분석이 끝나도 영상을 다시 받지 않는다. */}
          {canShowVideo(recording) ? <RecordingPlayer key={recording.id} ref={playerRef} recording={recording} /> : null}
          {/* 분석이 끝나 상태가 바뀌면 다시 마운트해서, 확인이 필요한 이슈가 기본으로 펼쳐지게 한다. */}
          <RecordingAnalysis
            key={`${recording.id}:${recording.status}`}
            recording={recording}
            hasVideo={canShowVideo(recording)}
            onSeek={(milliseconds) => playerRef.current?.seekTo(milliseconds)}
            focusedIssueId={focusedIssueId}
            findReverifyRecordingId={(issueId) => findLatestReverifyRecordingId(recordings, issueId)}
            onOpenRecording={(recordingId) => openRecording(recordingId)}
          />
        </>
      ) : (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>아직 받은 녹화가 없어요</p>
          <p className={styles.caption}>고객이 화면을 녹화해 보내면 말한 내용과 문제를 여기에 정리해요.</p>
        </div>
      )}
    </div>
  );
}

// 업로드가 끝난 녹화는 정리 중이거나 실패했어도 영상을 먼저 볼 수 있게 한다.
function canShowVideo(recording: RecordingDetail): boolean {
  return recording.status !== "uploading" && Boolean(recording.videoUrl);
}

function needsCheck(issue: Issue): boolean {
  return issue.confidence === "ambiguous" && issue.status === "open";
}

function findDefaultOpenIssueId(issues: Issue[], focusedIssueId: string | null): string | null {
  if (focusedIssueId && issues.some((issue) => issue.id === focusedIssueId)) {
    return focusedIssueId;
  }
  return (issues.find(needsCheck) ?? issues[0])?.id ?? null;
}

type RecordingAnalysisProps = {
  recording: RecordingDetail;
  hasVideo: boolean;
  onSeek: (milliseconds: number) => void;
  focusedIssueId: string | null;
  findReverifyRecordingId: (issueId: string) => string | null;
  onOpenRecording: (recordingId: string) => void;
};

function RecordingAnalysis({
  recording,
  hasVideo,
  onSeek,
  focusedIssueId,
  findReverifyRecordingId,
  onOpenRecording,
}: RecordingAnalysisProps) {
  const [openIssueId, setOpenIssueId] = useState<string | null>(() => findDefaultOpenIssueId(recording.issues, focusedIssueId));

  if (recording.status === "uploading") {
    return <AnalysisPending message="고객이 영상을 올리고 있어요. 잠시만 기다려 주세요" hasVideo={false} />;
  }
  if (recording.status === "uploaded" || recording.status === "analyzing") {
    return <AnalysisPending message="말한 내용을 정리하고 있어요. 보통 1분 안에 끝나요" hasVideo={hasVideo} />;
  }
  if (recording.status === "failed") {
    return (
      <AnalysisFailed recordingId={recording.id} reason={recording.error} failureKind={recording.failureKind} hasVideo={hasVideo} />
    );
  }

  const checkCount = recording.issues.filter(needsCheck).length;

  return (
    <>
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
              onSeek={onSeek}
              shouldFocus={focusedIssueId === issue.id}
              reverifyRecordingId={findReverifyRecordingId(issue.id)}
              onOpenRecording={onOpenRecording}
            />
          ))}
        </ol>
      )}
      <TranscriptSection segments={recording.transcript} onSeek={onSeek} />
    </>
  );
}

function AnalysisPending({ message, hasVideo }: { message: string; hasVideo: boolean }) {
  return (
    <div className={hasVideo ? `${styles.pending} ${styles.pendingBelowVideo}` : styles.pending} aria-busy="true">
      {hasVideo ? null : <span className={styles.skeletonVideo} />}
      <span className={styles.skeletonLine} />
      <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <p className={styles.pendingMessage} role="status">
        {message}
      </p>
    </div>
  );
}

type AnalysisFailedProps = {
  recordingId: string;
  reason: string | null;
  failureKind: RecordingFailureKind | null;
  hasVideo: boolean;
};

// 안내와 버튼은 실패 종류로 가른다. 업로드 미완료는 다시 정리할 수 없고, 무음은 다시 녹화 요청이 먼저다.
function AnalysisFailed({ recordingId, reason, failureKind, hasVideo }: AnalysisFailedProps) {
  const guidance = getFailureGuidance(failureKind, hasVideo);
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
      <p className={styles.failedTitle}>{guidance.title}</p>
      {reason ? (
        <p className={styles.failedReason}>
          <span className={styles.failedReasonLabel}>이유</span>
          {reason}
        </p>
      ) : null}
      <p className={styles.caption}>{guidance.guide}</p>
      {guidance.reanalyzeAction === "primary" ? (
        <AdminButton variant="weak" size="small" onClick={() => void reanalyze()} isLoading={isRequesting}>
          다시 정리하기
        </AdminButton>
      ) : null}
      {guidance.reanalyzeAction === "secondary" ? (
        <AdminButton variant="text" size="small" onClick={() => void reanalyze()} isLoading={isRequesting}>
          그래도 다시 정리하기
        </AdminButton>
      ) : null}
      {message ? (
        <p className={styles.failedMessage} role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
