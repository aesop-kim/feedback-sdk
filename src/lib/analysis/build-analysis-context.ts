import type { TimedElementContext } from "@/lib/analysis/align-timeline";
import type { TranscriptSegment } from "@/types/feedback";

// 세그먼트마다 주변 요소 컨텍스트와 대표 장면(프레임)을 묶어 분석 입력을 만든다.

export type FrameReason = "interval" | "click";

// path: recordings.frames에 저장된 상대 경로(`frames/{tMs}-{reason}.jpg`)
export type FrameReference = { tMs: number; reason: FrameReason; path: string };

export type AnalysisSegment = TranscriptSegment & {
  index: number;
  contexts: TimedElementContext[];
  frame: FrameReference | null;
};

export type AnalysisContext = { segments: AnalysisSegment[]; frames: FrameReference[] };

const CONTEXT_WINDOW_MS = 1_000;
export const MAX_ANALYSIS_FRAMES = 12;

function findNearestFrame(frames: FrameReference[], anchorMs: number): FrameReference | null {
  let nearest: FrameReference | null = null;
  for (const frame of frames) {
    if (!nearest || Math.abs(frame.tMs - anchorMs) < Math.abs(nearest.tMs - anchorMs)) {
      nearest = frame;
    }
  }
  return nearest;
}

function getAnchorMs(segment: TranscriptSegment, contexts: TimedElementContext[]): number {
  const firstClick = contexts.find((item) => item.kind === "click");
  if (firstClick) {
    return firstClick.tMs;
  }
  return Math.round((segment.startMs + segment.endMs) / 2);
}

// 창 안의 click 프레임 중 가장 가까운 것, 없으면 가장 가까운 interval 프레임, 그것도 없으면 아무 프레임.
function chooseSegmentFrame(
  segment: TranscriptSegment,
  contexts: TimedElementContext[],
  frames: FrameReference[],
): FrameReference | null {
  const anchorMs = getAnchorMs(segment, contexts);
  const windowStart = segment.startMs - CONTEXT_WINDOW_MS;
  const windowEnd = segment.endMs + CONTEXT_WINDOW_MS;
  const clickFrames = frames.filter(
    (frame) => frame.reason === "click" && frame.tMs >= windowStart && frame.tMs <= windowEnd,
  );
  return (
    findNearestFrame(clickFrames, anchorMs) ??
    findNearestFrame(
      frames.filter((frame) => frame.reason === "interval"),
      anchorMs,
    ) ??
    findNearestFrame(frames, anchorMs)
  );
}

function getSelectorKey(contexts: TimedElementContext[]): string {
  return [...new Set(contexts.map((item) => item.context.selector))].sort().join("|");
}

function getFramePriority(segment: AnalysisSegment, previous: AnalysisSegment | undefined): number {
  let priority = 0;
  const selectorKey = getSelectorKey(segment.contexts);
  if (selectorKey !== "" && selectorKey !== (previous ? getSelectorKey(previous.contexts) : "")) {
    priority += 2;
  }
  if (segment.frame?.reason === "click") {
    priority += 1;
  }
  return priority;
}

// 후보 프레임이 상한을 넘으면 컨텍스트가 바뀌는 세그먼트(+click 프레임)를 먼저 남긴다.
function selectFrames(segments: AnalysisSegment[], maxFrames: number): FrameReference[] {
  const priorityByPath = new Map<string, { frame: FrameReference; priority: number }>();
  segments.forEach((segment, position) => {
    if (!segment.frame) {
      return;
    }
    const priority = getFramePriority(segment, segments[position - 1]);
    const existing = priorityByPath.get(segment.frame.path);
    if (!existing || existing.priority < priority) {
      priorityByPath.set(segment.frame.path, { frame: segment.frame, priority });
    }
  });
  return [...priorityByPath.values()]
    .sort((left, right) => right.priority - left.priority || left.frame.tMs - right.frame.tMs)
    .slice(0, maxFrames)
    .map((item) => item.frame)
    .sort((left, right) => left.tMs - right.tMs);
}

export function buildAnalysisContext(input: {
  segments: TranscriptSegment[];
  contexts: TimedElementContext[];
  frames: FrameReference[];
  maxFrames?: number;
}): AnalysisContext {
  const maxFrames = input.maxFrames ?? MAX_ANALYSIS_FRAMES;
  const draftSegments: AnalysisSegment[] = input.segments.map((segment, index) => {
    const contexts = input.contexts.filter(
      (item) => item.tMs >= segment.startMs - CONTEXT_WINDOW_MS && item.tMs <= segment.endMs + CONTEXT_WINDOW_MS,
    );
    return { ...segment, index, contexts, frame: chooseSegmentFrame(segment, contexts, input.frames) };
  });
  const frames = selectFrames(draftSegments, maxFrames);
  const selectedPaths = new Set(frames.map((frame) => frame.path));
  // 상한 때문에 빠진 프레임을 쓰던 세그먼트는 남은 프레임 중 가장 가까운 것으로 바꾼다.
  const segments = draftSegments.map((segment) => {
    if (!segment.frame || selectedPaths.has(segment.frame.path)) {
      return segment;
    }
    return { ...segment, frame: findNearestFrame(frames, segment.frame.tMs) };
  });
  return { segments, frames };
}
