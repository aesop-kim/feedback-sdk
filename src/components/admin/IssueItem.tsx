"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import { ClarificationDraft } from "@/components/admin/ClarificationDraft";
import { FrameThumbnail } from "@/components/admin/FrameThumbnail";
import styles from "@/components/admin/IssueItem.module.css";
import { useAdminRequest } from "@/hooks/use-admin-request";
import { useAdminRevision } from "@/hooks/use-admin-revision";
import { findCardAnswerText } from "@/lib/feedback/clarification-answer";
import { isRemainingIssue, type AdminIssueStatus } from "@/lib/feedback/issue-status";
import type { HighlightBox, Issue } from "@/types/feedback";

type IssueItemProps = {
  issue: Issue;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onSeek: (milliseconds: number) => void;
  // 원래 이슈 보기로 왔을 때 이 이슈에 초점을 준다.
  shouldFocus: boolean;
  // 고객이 이 이슈를 다시 확인하려고 보낸 녹화(없으면 null).
  reverifyRecordingId: string | null;
  onOpenRecording: (recordingId: string) => void;
  // 재확인 녹화에서 찾은 이슈. 결정은 원래 이슈에서 하므로 반영 완료를 받지 않는다(V5-01).
  isReverifyFinding: boolean;
};

type StatusPill = { label: string; tone: "grey" | "orange" | "blue" | "green" };

// 별일 없는 이슈(명확하고 열려 있음)는 배지를 달지 않는다. 손이 가야 하는 상태만 표시한다.
// 배지 문구는 짧은 명사형으로 맞춘다(UX-25).
function findStatusPill(issue: Issue): StatusPill | null {
  switch (issue.status) {
    case "resolved":
      return { label: "반영 완료", tone: "grey" };
    case "answered":
      return { label: "답변 받음", tone: "green" };
    case "asked":
      return { label: "질문 보냄", tone: "blue" };
    case "reverify":
      return { label: "다시 확인 중", tone: "blue" };
    case "closed":
      return { label: "해결됨", tone: "green" };
    case "open":
      return issue.confidence === "ambiguous" ? { label: "확인 필요", tone: "orange" } : null;
  }
}

const PILL_TONE_CLASS_NAMES: Record<StatusPill["tone"], string> = {
  grey: styles.pillGrey,
  orange: styles.pillOrange,
  blue: styles.pillBlue,
  green: styles.pillGreen,
};

// 강조 영역: 질문 카드에 지정된 영역을 먼저 쓰고, 없으면 요소 위치를 화면 크기로 나눠 0~1로 바꾼다.
function findHighlight(issue: Issue): HighlightBox | null {
  if (issue.clarification?.highlight) {
    return issue.clarification.highlight;
  }
  const element = issue.element;
  if (!element || element.viewport.width <= 0 || element.viewport.height <= 0) {
    return null;
  }
  return {
    x: element.rect.x / element.viewport.width,
    y: element.rect.y / element.viewport.height,
    width: element.rect.width / element.viewport.width,
    height: element.rect.height / element.viewport.height,
  };
}

export function IssueItem({
  issue,
  index,
  isOpen,
  onToggle,
  onSeek,
  shouldFocus,
  reverifyRecordingId,
  onOpenRecording,
  isReverifyFinding,
}: IssueItemProps) {
  const bodyId = useId();
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  const pill = findStatusPill(issue);

  useEffect(() => {
    if (shouldFocus) {
      summaryButtonRef.current?.focus();
    }
  }, [shouldFocus]);

  return (
    <li className={isRemainingIssue(issue.status) ? styles.item : `${styles.item} ${styles.resolved}`}>
      <button
        ref={summaryButtonRef}
        type="button"
        className={styles.summaryRow}
        onClick={onToggle} aria-expanded={isOpen} aria-controls={bodyId}>
        <span className={styles.index}>{index}</span>
        <span className={styles.heading}>
          <span className={styles.title}>{issue.title}</span>
          {isOpen ? null : <span className={styles.collapsedSummary}>{issue.summary}</span>}
        </span>
        {pill ? <span className={`${styles.pill} ${PILL_TONE_CLASS_NAMES[pill.tone]}`}>{pill.label}</span> : null}
        <svg
          className={isOpen ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="m3.5 6 4.5 4.5L12.5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen ? (
        <div id={bodyId} className={styles.body}>
          <FrameThumbnail frameUrl={issue.frameUrl} highlight={findHighlight(issue)} tMs={issue.tMs} onSeek={onSeek} />
          {issue.quote ? <blockquote className={styles.quote}>“{issue.quote}”</blockquote> : null}
          <p className={styles.summary}>{issue.summary}</p>
          {issue.suggestion ? (
            <div className={styles.suggestion}>
              <span className={styles.label}>수정 제안</span>
              <p className={styles.suggestionText}>{issue.suggestion}</p>
            </div>
          ) : null}
          {issue.element?.selector ? <SelectorChip selector={issue.element.selector} /> : null}
          <IssueClarification issue={issue} />
          {reverifyRecordingId ? (
            <button type="button" className={styles.reverifyLink} onClick={() => onOpenRecording(reverifyRecordingId)}>
              고객이 보낸 다시 확인 녹화 보기
            </button>
          ) : null}
          <IssueActions issue={issue} isReverifyFinding={isReverifyFinding} />
        </div>
      ) : null}
    </li>
  );
}

// 상태마다 마무리 버튼이 다르다. 재확인 중인 이슈에 반영 완료 버튼을 다시 보여 주면 고객에게 요청이 또 가므로,
// 고객이 다시 확인한 뒤에는 해결됨으로 닫거나 다시 여는 것만 고르게 한다. 닫은 이슈도 다시 열 수 있다.
// 재확인 녹화에서 찾은 이슈도 반영 완료를 누르면 고객에게 "수정을 반영했어요"가 또 가므로 안내만 둔다(V5-01).
function IssueActions({ issue, isReverifyFinding }: { issue: Issue; isReverifyFinding: boolean }) {
  if (isReverifyFinding) {
    return <p className={styles.resolvedNote}>다시 확인 녹화에서 찾은 내용이라 따로 반영하지 않아요. 원래 이슈에서 정해 주세요</p>;
  }
  switch (issue.status) {
    case "resolved":
      return <p className={styles.resolvedNote}>반영 완료로 바꾸고 고객에게 다시 확인을 부탁했어요</p>;
    case "closed":
      return <ClosedActions issueId={issue.id} />;
    case "reverify":
      return <ReverifyActions issueId={issue.id} />;
    default:
      return <ResolveButton issueId={issue.id} />;
  }
}

// 반영 완료·해결됨으로 닫기·다시 열기 요청. 성공하면 화면을 새로 고치고, 실패하면 이유를 남긴다.
function useIssueStatusChange(issueId: string) {
  const request = useAdminRequest();
  const { refresh } = useAdminRevision();
  const [savingStatus, setSavingStatus] = useState<AdminIssueStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function changeStatus(status: AdminIssueStatus): Promise<boolean> {
    setSavingStatus(status);
    setErrorMessage(null);
    const result = await request(`/api/admin/issues/${issueId}`, { method: "PATCH", body: { status } });
    setSavingStatus(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return false;
    }
    refresh();
    return true;
  }

  return { savingStatus, errorMessage, changeStatus };
}

function ActionError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <span className={styles.actionError} role="alert">
      {message}
    </span>
  );
}

// 해결됨으로 닫기는 반영 완료처럼 제자리에서 한 번 더 묻는다. 닫은 뒤에도 다시 열 수 있다.
function ReverifyActions({ issueId }: { issueId: string }) {
  const { savingStatus, errorMessage, changeStatus } = useIssueStatusChange(issueId);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirmingClose, setIsConfirmingClose] = useState(false);

  useEffect(() => {
    if (isConfirmingClose) {
      confirmButtonRef.current?.focus();
    }
  }, [isConfirmingClose]);

  async function closeIssue() {
    if (await changeStatus("closed")) {
      setIsConfirmingClose(false);
    }
  }

  if (isConfirmingClose) {
    return (
      <div className={styles.actions} role="group" aria-label="해결됨으로 닫기 확인">
        <span className={styles.confirmQuestion}>해결됨으로 닫을까요?</span>
        <AdminButton ref={confirmButtonRef} size="small" onClick={() => void closeIssue()} isLoading={savingStatus === "closed"}>
          닫기
        </AdminButton>
        <AdminButton variant="text" size="small" onClick={() => setIsConfirmingClose(false)} disabled={savingStatus === "closed"}>
          다음에
        </AdminButton>
        <span className={styles.actionCaption}>고객에게 해결로 정리했다고 알려요. 닫은 뒤에도 다시 열 수 있어요</span>
        <ActionError message={errorMessage} />
      </div>
    );
  }

  return (
    <div className={styles.actions} role="group" aria-label="다시 확인 결과">
      <span className={styles.actionCaption}>고객이 다시 녹화해 보냈어요. 고쳐졌으면 닫고, 아직 남아 있으면 다시 열어 주세요. 어느 쪽이든 고객에게 알려요</span>
      <div className={styles.actionButtons}>
        <AdminButton variant="weak" size="small" onClick={() => setIsConfirmingClose(true)} disabled={savingStatus === "open"}>
          해결됨으로 닫기
        </AdminButton>
        <AdminButton variant="text" size="small" onClick={() => void changeStatus("open")} isLoading={savingStatus === "open"}>
          다시 열기
        </AdminButton>
      </div>
      <ActionError message={errorMessage} />
    </div>
  );
}

// 잘못 닫았거나 문제가 다시 나왔을 때 되돌린다.
function ClosedActions({ issueId }: { issueId: string }) {
  const { savingStatus, errorMessage, changeStatus } = useIssueStatusChange(issueId);
  return (
    <div className={styles.actions} role="group" aria-label="해결된 이슈">
      <p className={styles.resolvedNote}>고객 확인까지 끝나서 해결됨으로 닫았어요</p>
      <div className={styles.actionButtons}>
        <AdminButton variant="text" size="small" onClick={() => void changeStatus("open")} isLoading={savingStatus === "open"}>
          다시 열기
        </AdminButton>
        <span className={styles.actionCaption}>문제가 남아 있으면 다시 열어요. 고객에게 다시 고친다고 알려요</span>
      </div>
      <ActionError message={errorMessage} />
    </div>
  );
}

function IssueClarification({ issue }: { issue: Issue }) {
  const card = issue.clarification;
  if (!card) {
    return null;
  }
  // 반영 완료 뒤에도 고객 답변은 남겨서, 왜 이렇게 고쳤는지 나중에 볼 수 있게 한다.
  const answerText = findCardAnswerText(card);
  if (answerText) {
    return (
      <p className={styles.answer}>
        <span className={styles.answerLabel}>고객 답변</span>
        <span className={styles.answerDot}>·</span>
        {answerText}
      </p>
    );
  }
  if (!isRemainingIssue(issue.status)) {
    return null;
  }
  if (card.approvedAt) {
    return (
      <div className={styles.waiting} role="status">
        <span className={styles.waitingLead}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          고객에게 질문을 보냈어요
        </span>
        <span className={styles.waitingQuestion}>{card.question}</span>
        고객 답변을 기다리고 있어요
      </div>
    );
  }
  if (issue.confidence === "ambiguous") {
    return <ClarificationDraft card={card} />;
  }
  return null;
}

function SelectorChip({ selector }: { selector: string }) {
  const [isCopied, setIsCopied] = useState(false);

  async function copySelector() {
    try {
      await navigator.clipboard.writeText(selector);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <div className={styles.selector}>
      <code className={styles.selectorCode} title={selector}>
        {selector}
      </code>
      <button type="button" className={styles.copyButton} onClick={() => void copySelector()} aria-label="선택자 복사하기">
        {isCopied ? (
          "복사했어요"
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.75" />
            <path d="M10.5 3.5v-.25A1.75 1.75 0 0 0 8.75 1.5h-5.5A1.75 1.75 0 0 0 1.5 3.25v5.5c0 .97.78 1.75 1.75 1.75h.25" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        )}
      </button>
    </div>
  );
}

// 반영 완료는 고객 위젯에 바로 메시지를 보내고 API로 되돌릴 수 없다. 그래서 누르기 전에 제자리에서 한 번 더 묻는다.
function ResolveButton({ issueId }: { issueId: string }) {
  const { savingStatus, errorMessage, changeStatus } = useIssueStatusChange(issueId);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const isSaving = savingStatus === "resolved";

  useEffect(() => {
    if (isConfirming) {
      confirmButtonRef.current?.focus();
    }
  }, [isConfirming]);

  async function resolveIssue() {
    if (await changeStatus("resolved")) {
      setIsConfirming(false);
    }
  }

  if (isConfirming) {
    return (
      <div className={styles.actions} role="group" aria-label="반영 완료 확인">
        <span className={styles.confirmQuestion}>고객에게 확인을 부탁할까요?</span>
        <AdminButton ref={confirmButtonRef} size="small" onClick={() => void resolveIssue()} isLoading={isSaving}>
          부탁하기
        </AdminButton>
        <AdminButton variant="text" size="small" onClick={() => setIsConfirming(false)} disabled={isSaving}>
          닫기
        </AdminButton>
        <ActionError message={errorMessage} />
      </div>
    );
  }

  return (
    <div className={styles.actions}>
      <AdminButton variant="weak" size="small" onClick={() => setIsConfirming(true)}>
        반영 완료로 바꾸기
      </AdminButton>
      <span className={styles.actionCaption}>누르면 고객에게 다시 확인해 달라고 알려요</span>
    </div>
  );
}
