"use client";

import { useId, useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import styles from "@/components/admin/ClarificationDraft.module.css";
import { useAdminRequest } from "@/hooks/use-admin-request";
import { useAdminRevision } from "@/hooks/use-admin-revision";
import type { ClarificationCard, ClarificationOption } from "@/types/feedback";

const MIN_OPTION_COUNT = 2;
const MAX_OPTION_COUNT = 4;

// 자동으로 만든 질문 초안. 관리자가 고친 뒤 승인하면 고객 위젯에 질문 카드로 나간다.
export function ClarificationDraft({ card }: { card: ClarificationCard }) {
  const request = useAdminRequest();
  const { refresh } = useAdminRevision();
  const questionId = useId();
  const [question, setQuestion] = useState(card.question);
  const [options, setOptions] = useState<ClarificationOption[]>(card.options.slice(0, MAX_OPTION_COUNT));
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filledOptions = options.map((option) => ({ ...option, label: option.label.trim() })).filter((option) => option.label);
  const canSend = question.trim().length > 0 && filledOptions.length >= MIN_OPTION_COUNT && !isSending;

  function updateOption(optionId: string, label: string) {
    setOptions((current) => current.map((option) => (option.id === optionId ? { ...option, label } : option)));
  }

  function removeOption(optionId: string) {
    setOptions((current) => current.filter((option) => option.id !== optionId));
  }

  function addOption() {
    setOptions((current) => {
      const usedIds = new Set(current.map((option) => option.id));
      let nextNumber = current.length + 1;
      while (usedIds.has(`option-${nextNumber}`)) {
        nextNumber += 1;
      }
      return [...current, { id: `option-${nextNumber}`, label: "" }];
    });
  }

  async function approve() {
    if (!canSend) {
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    const result = await request(`/api/admin/clarifications/${card.id}/approve`, {
      method: "POST",
      body: { question: question.trim(), options: filledOptions },
    });
    setIsSending(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    refresh();
  }

  return (
    <div className={styles.draft}>
      <div className={styles.header}>
        <label className={styles.heading} htmlFor={questionId}>
          고객에게 물어볼 질문
        </label>
        <span className={styles.caption}>자동으로 만든 초안이에요. 고쳐서 보내도 돼요.</span>
      </div>
      <textarea
        id={questionId}
        className={styles.question}
        rows={2}
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        maxLength={300}
      />
      <ul className={styles.options} aria-label="답 보기">
        {options.map((option, index) => (
          <li key={option.id} className={styles.option}>
            <span className={styles.optionMarker} aria-hidden="true" />
            <input
              className={styles.optionInput}
              value={option.label}
              onChange={(event) => updateOption(option.id, event.target.value)}
              placeholder="보기를 입력해 주세요"
              aria-label={`보기 ${index + 1}`}
              maxLength={100}
            />
            {options.length > MIN_OPTION_COUNT ? (
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeOption(option.id)}
                aria-label={`보기 ${index + 1} 지우기`}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </li>
        ))}
        {/* 고객 카드에는 이 보기가 늘 맨 아래에 붙는다. 고객이 보는 그대로 미리 보여 주고, 고칠 수는 없다. */}
        <li className={`${styles.option} ${styles.customOption}`}>
          <span className={styles.optionMarker} aria-hidden="true" />
          <span className={styles.customOptionLabel}>직접 입력할게요</span>
          <span className={styles.customOptionNote}>항상 붙어요</span>
        </li>
      </ul>
      {options.length < MAX_OPTION_COUNT ? (
        <button type="button" className={styles.addButton} onClick={addOption}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          보기 추가하기
        </button>
      ) : null}
      <div className={styles.footer}>
        {errorMessage ? (
          <span className={styles.error} role="alert">
            {errorMessage}
          </span>
        ) : (
          <span className={styles.caption}>고객 화면에 이 장면과 함께 보여요</span>
        )}
        <AdminButton size="small" onClick={() => void approve()} disabled={!canSend} isLoading={isSending}>
          고객에게 물어보기
        </AdminButton>
      </div>
    </div>
  );
}
