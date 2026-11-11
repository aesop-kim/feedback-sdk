import type { TimedElementContext } from "@/lib/analysis/align-timeline";
import type { FrameReference } from "@/lib/analysis/build-analysis-context";
import type { AnalysisIssue } from "@/lib/analysis/issue-schema";
import type { ClarificationOption, ElementContext, HighlightBox } from "@/types/feedback";

// claude 결과를 replace_recording_issues RPC의 p_issues 항목 모양(snake_case)으로 바꾼다.

export type IssueRowPayload = {
  t_ms: number;
  quote: string;
  title: string;
  summary: string;
  suggestion: string;
  confidence: AnalysisIssue["confidence"];
  frame_path: string | null;
  element: ElementContext | null;
  clarification: { question: string; options: ClarificationOption[]; highlight: HighlightBox | null } | null;
};

function getFileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function findNearestByTime<TItem extends { tMs: number }>(items: TItem[], tMs: number): TItem | null {
  let nearest: TItem | null = null;
  for (const item of items) {
    if (!nearest || Math.abs(item.tMs - tMs) < Math.abs(nearest.tMs - tMs)) {
      nearest = item;
    }
  }
  return nearest;
}

function findFrame(frames: FrameReference[], frameRef: string | null, tMs: number): FrameReference | null {
  if (frameRef) {
    const fileName = getFileName(frameRef.trim());
    const matched = frames.find((frame) => getFileName(frame.path) === fileName);
    if (matched) {
      return matched;
    }
  }
  return findNearestByTime(frames, tMs);
}

function findElement(contexts: TimedElementContext[], selector: string | null, tMs: number): ElementContext | null {
  const sameSelector = selector ? contexts.filter((item) => item.context.selector === selector.trim()) : [];
  const matched = findNearestByTime(sameSelector, tMs) ?? findNearestByTime(contexts, tMs);
  if (!matched) {
    return null;
  }
  const { selector: matchedSelector, text, tagName, rect, viewport } = matched.context;
  return { selector: matchedSelector, text, tagName, rect, viewport };
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function findNormalizedHighlight(element: ElementContext | null): HighlightBox | null {
  if (!element || element.viewport.width <= 0 || element.viewport.height <= 0) {
    return null;
  }
  const { rect, viewport } = element;
  const x = clampUnit(rect.x / viewport.width);
  const y = clampUnit(rect.y / viewport.height);
  const width = clampUnit((rect.x + rect.width) / viewport.width) - x;
  const height = clampUnit((rect.y + rect.height) / viewport.height) - y;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: roundRatio(x), y: roundRatio(y), width: roundRatio(width), height: roundRatio(height) };
}

// isReverify: 고객이 고친 이슈를 다시 확인하려고 보낸 녹화. 여기서 나온 내용은 원래 이슈를 닫을지 다시 열지
// 판단하는 근거라서, 고객에게 또 묻는 질문 초안을 만들지 않고 "확인 필요"로도 표시하지 않는다(V4-06).
export function mapIssuesToRows(input: {
  recordingId: string;
  issues: AnalysisIssue[];
  contexts: TimedElementContext[];
  frames: FrameReference[];
  isReverify?: boolean;
}): IssueRowPayload[] {
  return input.issues.map((issue) => {
    const tMs = Math.max(0, Math.round(issue.tMs));
    const frame = findFrame(input.frames, issue.frameRef, tMs);
    const element = findElement(input.contexts, issue.selector, tMs);
    const confidence = input.isReverify ? "clear" : issue.confidence;
    const clarification =
      confidence === "ambiguous" && issue.clarification
        ? {
            question: issue.clarification.question,
            options: issue.clarification.options.map((label, index) => ({ id: `o${index + 1}`, label })),
            highlight: findNormalizedHighlight(element),
          }
        : null;
    return {
      t_ms: tMs,
      quote: issue.quote,
      title: issue.title,
      summary: issue.summary,
      suggestion: issue.suggestion,
      confidence,
      frame_path: frame ? `${input.recordingId}/frames/${getFileName(frame.path)}` : null,
      element,
      clarification,
    };
  });
}
