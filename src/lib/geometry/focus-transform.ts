import type { HighlightBox } from "@/types/feedback";

export type FocusTransform = { scale: number; translateX: number; translateY: number };

const TARGET_COVERAGE = 0.5;
const MAX_SCALE = 3;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

// 하이라이트 영역이 화면 폭(또는 높이)의 절반쯤 차지하도록 확대하고, 영역 중심을 가운데로 옮긴다.
// 반환값은 컨테이너 크기 기준 비율(translate는 0 ~ -(scale-1)) — 이미지 바깥 빈 공간이 보이지 않게 고정한다.
export function getFocusTransform(highlight: HighlightBox | null): FocusTransform {
  if (!highlight || highlight.width <= 0 || highlight.height <= 0) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }
  const largestSide = Math.max(highlight.width, highlight.height);
  const scale = clamp(TARGET_COVERAGE / largestSide, 1, MAX_SCALE);
  const centerX = highlight.x + highlight.width / 2;
  const centerY = highlight.y + highlight.height / 2;
  return {
    scale,
    translateX: clamp(0.5 - centerX * scale, 1 - scale, 0),
    translateY: clamp(0.5 - centerY * scale, 1 - scale, 0),
  };
}

export function toCssTransform(transform: FocusTransform): string {
  return `translate(${transform.translateX * 100}%, ${transform.translateY * 100}%) scale(${transform.scale})`;
}
