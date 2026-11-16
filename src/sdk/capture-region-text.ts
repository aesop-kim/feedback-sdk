import type { CaptureRegion } from "@/sdk/select-region";

const EXCLUDED_ELEMENTS = "script, style, noscript, iframe, textarea, input, [contenteditable], [hidden], [aria-hidden='true'], .rr-block, [data-feedback-capture-ignore]";
const MAX_NODES = 2_000;
const MAX_LABELS = 2;
const MAX_LABEL_LENGTH = 45;

export function readCaptureRegionText({ x, y, width, height }: CaptureRegion): string[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const labels = new Set<string>();

  for (let i = 0; i < MAX_NODES && labels.size < MAX_LABELS; i += 1) {
    const node = walker.nextNode();
    if (!node) {
      break;
    }
    const parent = node.parentElement;
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (!parent || !text || parent.closest(EXCLUDED_ELEMENTS)) {
      continue;
    }
    const style = getComputedStyle(parent);
    if (style.visibility !== "visible" || parent.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) === false) {
      continue;
    }
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    // 선택 범위에 전부 들어온 글만 가져온다.
    if (rects.length && rects.every((rect) => rect.left >= x && rect.top >= y && rect.right <= x + width && rect.bottom <= y + height)) {
      labels.add(text.length > MAX_LABEL_LENGTH ? `${text.slice(0, MAX_LABEL_LENGTH)}…` : text);
    }
  }

  return [...labels];
}
