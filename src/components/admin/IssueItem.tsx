"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import { ClarificationDraft } from "@/components/admin/ClarificationDraft";
import { FrameThumbnail } from "@/components/admin/FrameThumbnail";
import styles from "@/components/admin/IssueItem.module.css";
import { useAdminRequest } from "@/hooks/use-admin-request";
import { useAdminRevision } from "@/hooks/use-admin-revision";
import type { ClarificationCard, HighlightBox, Issue } from "@/types/feedback";

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

function findAnswerText(card: ClarificationCard): string | null {
  if (!card.answer) {
    return null;
  }
  const optionLabel = card.options.find((option) => option.id === card.answer?.optionId)?.label;
  return [optionLabel, card.answer.text].filter(Boolean).join(" · ") || null;
}

export function IssueItem({ issue, index, isOpen, onToggle, onSeek, shouldFocus, reverifyRecordingId, onOpenRecording }: IssueItemProps) {
  const bodyId = useId();
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  const pill = findStatusPill(issue);

  useEffect(() => {
    if (shouldFocus) {
      summaryButtonRef.current?.focus();
    }
  }, [shouldFocus]);

  return (
    <li className={isFinished(issue) ? `${styles.item} ${styles.resolved}` : styles.item}>
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
          <IssueActions issue={issue} />
        </div>
      ) : null}
    </li>
  );
}

// 관리자가 손을 뗀 이슈: 반영 완료(고객 확인 대기)와 해결됨(닫힘).
function isFinished(issue: Issue): boolean {
  return issue.status === "resolved" || issue.status === "closed";
}

// 상태마다 마무리 버튼이 다르다. 재확인 중인 이슈에 반영 완료 버튼을 다시 보여 주면 고객에게 요청이 또 가므로,
// 고객이 다시 확인한 뒤에는 해결됨으로 닫거나 다시 여는 것만 고르게 한다.
function IssueActions({ issue }: { issue: Issue }) {
  switch (issue.status) {
    case "resolved":
      return <p className={styles.resolvedNote}>반영 완료로 바꾸고 고객에게 다시 확인을 부탁했어요</p>;
    case "closed":
      return <p className={styles.resolvedNote}>고객 확인까지 끝나서 해결됨으로 닫았어요</p>;
    case "reverify":
      return <ReverifyActions issueId={issue.id} />;
    default:
      return <ResolveButton issueId={issue.id} />;
  }
}

function ReverifyActions({ issueId }: { issueId: string }) {
  const request = useAdminRequest();
  const { refresh } = useAdminRevision();
  const [savingStatus, setSavingStatus] = useState<"closed" | "open" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function changeStatus(status: "closed" | "open") {
    setSavingStatus(status);
    setErrorMessage(null);
    const result = await request(`/api/admin/issues/${issueId}`, { method: "PATCH", body: { status } });
    setSavingStatus(null);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    refresh();
  }

  return (
    <div className={styles.actions} role="group" aria-label="다시 확인 결과">
      <span className={styles.actionCaption}>고객이 다시 녹화해 보냈어요. 영상을 보고 골라 주세요</span>
      <div className={styles.actionButtons}>
        <AdminButton
          variant="weak"
          size="small"
          onClick={() => void changeStatus("closed")}
          isLoading={savingStatus === "closed"}
          disabled={savingStatus === "open"}
        >
          확인 끝 · 해결됨
        </AdminButton>
        <AdminButton
          variant="text"
          size="small"
          onClick={() => void changeStatus("open")}
          isLoading={savingStatus === "open"}
          disabled={savingStatus === "closed"}
        >
          아직 안 고쳐졌어요 · 다시 열기
        </AdminButton>
      </div>
      {errorMessage ? (
        <span className={styles.actionError} role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}

function IssueClarification({ issue }: { issue: Issue }) {
  const card = issue.clarification;
  if (!card) {
    return null;
  }
  // 반영 완료 뒤에도 고객 답변은 남겨서, 왜 이렇게 고쳤는지 나중에 볼 수 있게 한다.
  const answerText = findAnswerText(card);
  if (answerText) {
    return (
      <p className={styles.answer}>
        <span className={styles.answerLabel}>고객 답변</span>
        <span className={styles.answerDot}>·</span>
        {answerText}
      </p>
    );
  }
  if (isFinished(issue)) {
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
  const request = useAdminRequest();
  const { refresh } = useAdminRevision();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isConfirming) {
      confirmButtonRef.current?.focus();
    }
  }, [isConfirming]);

  async function resolveIssue() {
    setIsSaving(true);
    setErrorMessage(null);
    const result = await request(`/api/admin/issues/${issueId}`, { method: "PATCH", body: { status: "resolved" } });
    setIsSaving(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    setIsConfirming(false);
    refresh();
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
        {errorMessage ? (
          <span className={styles.actionError} role="alert">
            {errorMessage}
          </span>
        ) : null}
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
