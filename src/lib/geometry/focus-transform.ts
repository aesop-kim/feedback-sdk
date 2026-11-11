import type { HighlightBox } from "@/types/feedback";

export type FocusTransform = { scale: number; translateX: number; translateY: number };

// 가로 / 세로 비율. image는 장면 이미지(=하이라이트 좌표계), container는 이미지를 보여 주는 창.
export type FrameAspect = { image: number; container: number };

const TARGET_COVERAGE = 0.5;
const MAX_SCALE = 3;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

// 창 높이를 이미지 높이에 대한 비율로 바꾼다. 비율을 모르면 창과 이미지가 같은 모양이라고 본다.
function getContainerHeightRatio(aspect: FrameAspect | undefined): number {
  if (!aspect || aspect.image <= 0 || aspect.container <= 0) {
    return 1;
  }
  return aspect.image / aspect.container;
}

// 하이라이트 영역이 창의 절반쯤 차지하도록 확대하고, 영역 중심을 창 가운데로 옮긴다.
// 반환값은 이미지 크기 기준 비율(CSS translate %와 같은 기준)이고, 창 안에 이미지 바깥 빈 공간이 보이지 않게 고정한다.
export function getFocusTransform(highlight: HighlightBox | null, aspect?: FrameAspect): FocusTransform {
  const heightRatio = getContainerHeightRatio(aspect);
  const minimumScale = Math.max(1, heightRatio);
  if (!highlight || highlight.width <= 0 || highlight.height <= 0) {
    return getCoverTransform(heightRatio);
  }
  const largestSide = Math.max(highlight.width, highlight.height / heightRatio);
  const scale = clamp(TARGET_COVERAGE / largestSide, minimumScale, Math.max(MAX_SCALE, minimumScale));
  const centerX = highlight.x + highlight.width / 2;
  const centerY = highlight.y + highlight.height / 2;
  return {
    scale,
    translateX: clamp(0.5 - centerX * scale, 1 - scale, 0),
    translateY: clamp(heightRatio / 2 - centerY * scale, heightRatio - scale, 0),
  };
}

function getCoverTransform(heightRatio: number): FocusTransform {
  const scale = Math.max(1, heightRatio);
  return { scale, translateX: (1 - scale) / 2, translateY: 0 };
}

// 장면 전체가 창 안에 다 보이도록 줄이고 가운데에 둔다(남는 곳은 창 배경색).
export function getFitTransform(aspect?: FrameAspect): FocusTransform {
  const heightRatio = getContainerHeightRatio(aspect);
  const scale = Math.min(1, heightRatio);
  return { scale, translateX: (1 - scale) / 2, translateY: (heightRatio - scale) / 2 };
}

export function toCssTransform(transform: FocusTransform): string {
  return `translate(${transform.translateX * 100}%, ${transform.translateY * 100}%) scale(${transform.scale})`;
}

function toPercent(value: number): string {
  return `${clamp(value, 0, 1) * 100}%`;
}

export function toHighlightStyle(highlight: HighlightBox): { left: string; top: string; width: string; height: string } {
  return {
    left: toPercent(highlight.x),
    top: toPercent(highlight.y),
    width: toPercent(highlight.width),
    height: toPercent(highlight.height),
  };
}
