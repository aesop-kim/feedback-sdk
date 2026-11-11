// 고객사 페이지의 요소를 분석 워커가 다시 찾을 수 있는 모양(selector·글자·위치)으로 바꾼다.
import type { ElementContext } from "@/types/feedback";

const MAX_TEXT_LENGTH = 80;
const MAX_SELECTOR_DEPTH = 5;

function escapeIdentifier(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
}

function isUniqueSelector(selector: string, root: ParentNode): boolean {
  try {
    return root.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function getNthOfTypeSegment(element: Element): string {
  const tagName = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (!parent) {
    return tagName;
  }
  const sameTagSiblings = Array.from(parent.children).filter((child) => child.tagName === element.tagName);
  if (sameTagSiblings.length === 1) {
    return tagName;
  }
  return `${tagName}:nth-of-type(${sameTagSiblings.indexOf(element) + 1})`;
}

// 라이브러리가 렌더링마다 새로 만드는 id(radix-:r1:, _r_0_ 등)는 다시 찾을 때 쓸 수 없다.
function isStableId(id: string): boolean {
  return !/^radix-|:|^_r_|^r\d/.test(id);
}

function findAnchorSelector(element: Element, root: ParentNode): string | null {
  if (element.id && isStableId(element.id)) {
    const idSelector = `#${escapeIdentifier(element.id)}`;
    if (isUniqueSelector(idSelector, root)) {
      return idSelector;
    }
  }
  const testId = element.getAttribute("data-testid");
  if (testId) {
    const testIdSelector = `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
    if (isUniqueSelector(testIdSelector, root)) {
      return testIdSelector;
    }
  }
  return null;
}

// #id → [data-testid] → 태그 + nth-of-type 사슬(최대 5단계) 순서로, 유일해지는 가장 짧은 경로를 고른다.
export function getElementSelector(element: Element): string {
  const root = element.ownerDocument;
  const anchorSelector = findAnchorSelector(element, root);
  if (anchorSelector) {
    return anchorSelector;
  }

  const segments: string[] = [];
  let current: Element | null = element;
  while (current && segments.length < MAX_SELECTOR_DEPTH) {
    const ancestorAnchor: string | null = segments.length > 0 ? findAnchorSelector(current, root) : null;
    if (ancestorAnchor) {
      segments.unshift(ancestorAnchor);
      return segments.join(" > ");
    }
    if (current.tagName === "HTML") {
      segments.unshift("html");
      break;
    }
    segments.unshift(getNthOfTypeSegment(current));
    const selector = segments.join(" > ");
    if (isUniqueSelector(selector, root)) {
      return selector;
    }
    current = current.parentElement;
  }
  return segments.join(" > ");
}

function getElementText(element: Element): string {
  const htmlElement = element as HTMLElement;
  const rawText = typeof htmlElement.innerText === "string" ? htmlElement.innerText : element.textContent;
  const text = (rawText ?? "").replace(/\s+/g, " ").trim();
  const label = text || (element.getAttribute("aria-label") ?? "").trim();
  return label.slice(0, MAX_TEXT_LENGTH);
}

export function getElementContext(element: Element): ElementContext {
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  return {
    selector: getElementSelector(element),
    text: getElementText(element),
    tagName: element.tagName.toLowerCase(),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    viewport: { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
  };
}

export function findElementAtPoint(x: number, y: number, ownerDocument: Document = document): Element | null {
  return ownerDocument.elementFromPoint(x, y);
}
