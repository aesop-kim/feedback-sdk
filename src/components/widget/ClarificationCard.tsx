"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon } from "@/components/widget/WidgetIcons";
import { useSceneZoom } from "@/hooks/use-scene-zoom";
import { toHighlightStyle } from "@/lib/geometry/focus-transform";
import { findNextRadioIndex } from "@/lib/widget/radio-navigation";
import type { ClarificationCard as ClarificationCardData } from "@/types/feedback";
import styles from "@/components/widget/ClarificationCard.module.css";

const CUSTOM_OPTION_ID = "__custom__";
const SUBMIT_SCROLL_MARGIN = 16;

// 보기를 고르면 "답변 보내기"가 패널 아래로 숨어 있지 않게, 위젯 스크롤 영역만 필요한 만큼 내린다.
// scrollIntoView는 고객사 페이지까지 움직일 수 있어서 쓰지 않는다.
function revealInWidget(element: HTMLElement | null) {
  const scrollContainer = element?.closest<HTMLElement>("[data-widget-scroll]");
  if (!element || !scrollContainer) {
    return;
  }
  const overflow = element.getBoundingClientRect().bottom - scrollContainer.getBoundingClientRect().bottom + SUBMIT_SCROLL_MARGIN;
  if (overflow <= 0) {
    return;
  }
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scrollContainer.scrollBy({ top: overflow, behavior: prefersReducedMotion ? "auto" : "smooth" });
}

type ClarificationCardProps = {
  card: ClarificationCardData;
  onAnswer: (cardId: string, answer: { optionId?: string; text?: string }) => Promise<void>;
};

export function ClarificationCard({ card, onAnswer }: ClarificationCardProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // 고른 답은 바로 아래 고객 말풍선으로 남으므로, 여기서는 어떤 질문에 답했는지만 보여 준다.
  if (card.answeredAt) {
    return (
      <div className={styles.answered}>
        <p className={styles.answeredTitle}>
          <span className={styles.answeredIcon}>
            <CheckIcon size={16} />
          </span>
          답변을 보냈어요
        </p>
        <p className={styles.answeredQuestion}>{card.question}</p>
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
  // radiogroup은 Tab 정지점이 하나다: 고른 보기(없으면 첫 보기)만 Tab으로 닿고, 나머지는 방향키로 옮긴다.
  const focusableOptionId = selectedOptionId ?? options[0].id;

  const selectOption = (optionId: string) => {
    setSelectedOptionId(optionId);
    requestAnimationFrame(() => revealInWidget(submitButtonRef.current));
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = options.findIndex((option) => option.id === focusableOptionId);
    const nextIndex = findNextRadioIndex(event.key, currentIndex, options.length);
    if (nextIndex === null) {
      return;
    }
    event.preventDefault();
    selectOption(options[nextIndex].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <section className={styles.card} aria-label="확인 질문">
      {card.frameUrl ? <SceneFrame frameUrl={card.frameUrl} highlight={card.highlight} /> : null}
      <div className={styles.content}>
        {card.quote ? <p className={styles.quote}>“{card.quote}”</p> : null}
        <p className={styles.question}>{card.question}</p>
        <div className={styles.options} role="radiogroup" aria-label={card.question} onKeyDown={handleOptionKeyDown}>
          {options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={option.id === focusableOptionId ? 0 : -1}
                className={styles.option}
                data-selected={isSelected}
                onClick={() => selectOption(option.id)}
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
            aria-label="직접 입력한 답변"
            rows={2}
            maxLength={2000}
            autoFocus
          />
        ) : null}
        <button ref={submitButtonRef} type="button" className={styles.submitButton} onClick={handleSubmit} disabled={!canSend} aria-busy={isSending}>
          답변 보내기
        </button>
      </div>
    </section>
  );
}

// 고객이 가리킨 장면. 기본은 가리킨 곳을 크게, 누르면 화면 전체를 보여 준다.
function SceneFrame({ frameUrl, highlight }: { frameUrl: string; highlight: ClarificationCardData["highlight"] }) {
  const { isZoomed, toggleZoom, canvasStyle, handleImageLoad } = useSceneZoom(highlight);

  return (
    <button
      type="button"
      className={styles.frame}
      data-zoomed={isZoomed}
      onClick={toggleZoom}
      aria-label={isZoomed ? "화면 전체 보기" : "가리킨 곳 크게 보기"}
      disabled={!highlight}
    >
      <span className={styles.frameCanvas} style={canvasStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL이라 next/image 최적화를 거치지 않는다 */}
        <img
          className={styles.frameImage}
          src={frameUrl}
          alt="녹화 속 해당 장면"
          onLoad={handleImageLoad}
        />
        {highlight ? <span className={styles.highlight} style={toHighlightStyle(highlight)} /> : null}
      </span>
      {highlight ? <span className={styles.zoomHint}>{isZoomed ? "전체 보기" : "크게 보기"}</span> : null}
    </button>
  );
}
