"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/widget/WidgetIcons";
import type { ClarificationCard as ClarificationCardData } from "@/types/feedback";
import styles from "@/components/widget/ClarificationCard.module.css";

const CUSTOM_OPTION_ID = "__custom__";

type ClarificationCardProps = {
  card: ClarificationCardData;
  onAnswer: (cardId: string, answer: { optionId?: string; text?: string }) => Promise<void>;
};

function getAnsweredLabel(card: ClarificationCardData): string {
  const selectedOption = card.options.find((option) => option.id === card.answer?.optionId);
  return [selectedOption?.label, card.answer?.text].filter(Boolean).join(" · ");
}

export function ClarificationCard({ card, onAnswer }: ClarificationCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (card.answeredAt) {
    return (
      <div className={styles.answered}>
        <span className={styles.answeredIcon}>
          <CheckIcon size={16} />
        </span>
        <p className={styles.answeredText}>
          답변을 보냈어요
          {getAnsweredLabel(card) ? <span className={styles.answeredChoice}> · {getAnsweredLabel(card)}</span> : null}
        </p>
      </div>
    );
  }

  const isCustomSelected = selectedOptionId === CUSTOM_OPTION_ID;
  const canSend = !isSending && (isCustomSelected ? customText.trim().length > 0 : selectedOptionId !== null);

  const handleSubmit = async () => {
    if (!canSend || !selectedOptionId) {
      return;
    }
    setIsSending(true);
    try {
      await onAnswer(card.id, isCustomSelected ? { text: customText.trim() } : { optionId: selectedOptionId });
    } finally {
      setIsSending(false);
    }
  };

  const options = [...card.options, { id: CUSTOM_OPTION_ID, label: "직접 입력할게요" }];

  return (
    <section className={styles.card} aria-label="확인 질문">
      <p className={styles.eyebrow}>확인하고 싶은 게 있어요</p>
      {card.frameUrl ? (
        <div className={styles.frame}>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL이라 next/image 최적화를 거치지 않는다 */}
          <img className={styles.frameImage} src={card.frameUrl} alt="녹화 속 해당 장면" />
          {card.highlight ? (
            <span
              className={styles.highlight}
              style={{
                left: `${card.highlight.x * 100}%`,
                top: `${card.highlight.y * 100}%`,
                width: `${card.highlight.width * 100}%`,
                height: `${card.highlight.height * 100}%`,
              }}
            />
          ) : null}
        </div>
      ) : null}
      {card.quote ? <p className={styles.quote}>“{card.quote}”</p> : null}
      <p className={styles.question}>{card.question}</p>
      <div className={styles.options} role="radiogroup" aria-label={card.question}>
        {options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={styles.option}
              data-selected={isSelected}
              onClick={() => setSelectedOptionId(option.id)}
            >
              <span className={styles.radio} aria-hidden="true" />
              <span className={styles.optionLabel}>{option.label}</span>
            </button>
          );
        })}
      </div>
      {isCustomSelected ? (
        <textarea
          className={styles.customInput}
          value={customText}
          onChange={(event) => setCustomText(event.target.value)}
          placeholder="어떤 점이 그랬는지 적어 주세요"
          rows={2}
          maxLength={2000}
          autoFocus
        />
      ) : null}
      <button type="button" className={styles.submitButton} onClick={handleSubmit} disabled={!canSend}>
        답변 보내기
      </button>
    </section>
  );
}
