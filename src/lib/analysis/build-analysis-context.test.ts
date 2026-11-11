import { describe, expect, it } from "vitest";
import type { TimedElementContext } from "@/lib/analysis/align-timeline";
import { MAX_ANALYSIS_FRAMES, buildAnalysisContext, type FrameReference } from "@/lib/analysis/build-analysis-context";

function context(tMs: number, selector: string, kind: TimedElementContext["kind"] = "hover"): TimedElementContext {
  return {
    tMs,
    kind,
    context: { selector, text: selector, tagName: "DIV", rect: { x: 0, y: 0, width: 10, height: 10 }, viewport: { width: 100, height: 100 } },
  };
}

function frame(tMs: number, reason: FrameReference["reason"]): FrameReference {
  return { tMs, reason, path: `frames/${tMs}-${reason}.jpg` };
}

const SEGMENTS = [
  { startMs: 1000, endMs: 3000, text: "버튼이 안 눌려요." },
  { startMs: 5000, endMs: 7000, text: "표 이름이 이상해요." },
];

describe("buildAnalysisContext", () => {
  it("세그먼트 ±1초 창의 컨텍스트를 모으고 창 안 click 프레임을 고른다", () => {
    const result = buildAnalysisContext({
      segments: SEGMENTS,
      contexts: [context(500, "#register", "click"), context(4500, "#table"), context(9000, "#far")],
      frames: [frame(0, "interval"), frame(600, "click"), frame(4000, "interval"), frame(6000, "interval")],
    });
    expect(result.segments[0].contexts.map((item) => item.context.selector)).toEqual(["#register"]);
    expect(result.segments[0].frame?.path).toBe("frames/600-click.jpg");
    expect(result.segments[1].contexts.map((item) => item.context.selector)).toEqual(["#table"]);
    expect(result.segments[1].frame?.path).toBe("frames/6000-interval.jpg");
    expect(result.frames.map((item) => item.tMs)).toEqual([600, 6000]);
  });

  it("컨텍스트가 없어도 가장 가까운 interval 프레임을 고른다", () => {
    const result = buildAnalysisContext({
      segments: SEGMENTS,
      contexts: [],
      frames: [frame(2000, "interval"), frame(5500, "interval")],
    });
    expect(result.segments.map((segment) => segment.contexts)).toEqual([[], []]);
    expect(result.segments.map((segment) => segment.frame?.tMs)).toEqual([2000, 5500]);
  });

  it("프레임이 없으면 frame은 null", () => {
    const result = buildAnalysisContext({ segments: SEGMENTS, contexts: [context(1500, "#a")], frames: [] });
    expect(result.frames).toEqual([]);
    expect(result.segments.every((segment) => segment.frame === null)).toBe(true);
  });

  it("후보가 12장을 넘으면 컨텍스트가 바뀌는 세그먼트를 우선해 12장만 남긴다", () => {
    const segments = Array.from({ length: 20 }, (_, index) => ({
      startMs: index * 5000,
      endMs: index * 5000 + 2000,
      text: `세그먼트 ${index}`,
    }));
    const frames = segments.map((segment) => frame(segment.startMs + 1000, "interval"));
    // 홀수 세그먼트에서만 요소가 바뀐다(10개). 나머지는 컨텍스트가 없다.
    const contexts = segments
      .map((segment, index) => (index % 2 === 1 ? context(segment.startMs + 500, `#element-${index}`) : null))
      .filter((item): item is TimedElementContext => item !== null);
    const result = buildAnalysisContext({ segments, contexts, frames });
    expect(result.frames).toHaveLength(MAX_ANALYSIS_FRAMES);
    const selectedTimes = new Set(result.frames.map((item) => item.tMs));
    for (let index = 1; index < 20; index += 2) {
      expect(selectedTimes.has(index * 5000 + 1000)).toBe(true);
    }
    const selectedPaths = new Set(result.frames.map((item) => item.path));
    for (const segment of result.segments) {
      expect(segment.frame === null || selectedPaths.has(segment.frame.path)).toBe(true);
    }
    expect([...result.frames].sort((left, right) => left.tMs - right.tMs)).toEqual(result.frames);
  });

  it("세그먼트가 없으면 빈 결과", () => {
    expect(buildAnalysisContext({ segments: [], contexts: [], frames: [frame(0, "interval")] })).toEqual({ segments: [], frames: [] });
  });
});
