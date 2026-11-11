import type { ClarificationCard } from "@/types/feedback";

// 고객 답변 한 줄: 고른 선택지와 직접 쓴 말을 " · "로 잇는다. 고객 메시지와 관리자 화면이 같은 문구를 쓴다.
export function getAnswerText(optionLabel: string | null | undefined, text: string | null | undefined): string {
  return [optionLabel, text].filter(Boolean).join(" · ");
}

// 카드에 남은 답변 문구. 아직 답하지 않았거나 비어 있으면 null.
export function findCardAnswerText(card: Pick<ClarificationCard, "options" | "answer">): string | null {
  if (!card.answer) {
    return null;
  }
  const optionLabel = card.options.find((option) => option.id === card.answer?.optionId)?.label;
  return getAnswerText(optionLabel, card.answer.text) || null;
}
