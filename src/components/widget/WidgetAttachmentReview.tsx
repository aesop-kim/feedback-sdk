"use client";

import { useEffect, useRef } from "react";
import styles from "@/components/widget/WidgetAttachmentReview.module.css";

type WidgetAttachmentReviewProps = {
  summary: string;
  description?: string;
  notice?: string | null;
  isSending?: boolean;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function WidgetAttachmentReview({
  summary, description, notice, isSending = false, cancelLabel, onCancel, onConfirm,
}: WidgetAttachmentReviewProps) {
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    card?.focus({ preventScroll: true });
    const scroll = card?.closest<HTMLElement>("[data-widget-scroll]");
    if (scroll) {
      scroll.scrollTop = scroll.scrollHeight;
    }
  }, []);

  return (
    <section ref={cardRef} className={styles.review} aria-labelledby="attachment-review-heading" tabIndex={-1}>
      <p className={styles.summary}>{summary}</p>
      {description ? <p className={styles.description}>작성한 설명 · {description}</p> : null}
      <h2 id="attachment-review-heading" className={styles.question}>이대로 피드백을 전송할까요?</h2>
      {notice ? <p className={styles.summary} role="status">{notice}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} disabled={isSending} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={styles.confirm} disabled={isSending} onClick={onConfirm}>
          {isSending ? "전송 중…" : "전송 확인"}
        </button>
      </div>
    </section>
  );
}
