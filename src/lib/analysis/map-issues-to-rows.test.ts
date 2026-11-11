import { describe, expect, it } from "vitest";
import type { TimedElementContext } from "@/lib/analysis/align-timeline";
import type { AnalysisIssue } from "@/lib/analysis/issue-schema";
import { findNormalizedHighlight, mapIssuesToRows } from "@/lib/analysis/map-issues-to-rows";

const RECORDING_ID = "rec-1";
const VIEWPORT = { width: 1000, height: 500 };

function context(tMs: number, selector: string): TimedElementContext {
  return {
    tMs,
    kind: "click",
    context: { selector, text: selector, tagName: "BUTTON", rect: { x: 100, y: 50, width: 200, height: 100 }, viewport: VIEWPORT },
  };
}

const FRAMES = [
  { tMs: 1000, reason: "click" as const, path: "frames/1000-click.jpg" },
  { tMs: 8000, reason: "interval" as const, path: "frames/8000-interval.jpg" },
];

function issue(overrides: Partial<AnalysisIssue>): AnalysisIssue {
  return {
    tMs: 1000,
    quote: "버튼이 안 돼요",
    title: "버튼 무반응",
    summary: "버튼이 반응하지 않아요.",
    suggestion: "핸들러를 연결하세요.",
    frameRef: null,
    selector: null,
    confidence: "clear",
    clarification: null,
    ...overrides,
  };
}

describe("mapIssuesToRows", () => {
  it("frameRef와 selector로 프레임·요소를 찾는다", () => {
    const [row] = mapIssuesToRows({
      recordingId: RECORDING_ID,
      issues: [issue({ frameRef: "8000-interval.jpg", selector: "#title", tMs: 1100.4 })],
      contexts: [context(1000, "#button"), context(7000, "#title")],
      frames: FRAMES,
    });
    expect(row.t_ms).toBe(1100);
    expect(row.frame_path).toBe("rec-1/frames/8000-interval.jpg");
    expect(row.element?.selector).toBe("#title");
    expect(row.clarification).toBeNull();
  });

  it("모르는 frameRef·selector면 시간상 가장 가까운 것을 쓴다", () => {
    const [row] = mapIssuesToRows({
      recordingId: RECORDING_ID,
      issues: [issue({ frameRef: "없는파일.jpg", selector: "#nope", tMs: 7500 })],
      contexts: [context(1000, "#button"), context(7000, "#title")],
      frames: FRAMES,
    });
    expect(row.frame_path).toBe("rec-1/frames/8000-interval.jpg");
    expect(row.element?.selector).toBe("#title");
  });

  it("컨텍스트·프레임이 없으면 null", () => {
    const [row] = mapIssuesToRows({ recordingId: RECORDING_ID, issues: [issue({})], contexts: [], frames: [] });
    expect(row.frame_path).toBeNull();
    expect(row.element).toBeNull();
  });

  it("ambiguous는 선택지에 id를 붙이고 하이라이트를 0~1로 정규화한다", () => {
    const [row] = mapIssuesToRows({
      recordingId: RECORDING_ID,
      issues: [
        issue({
          confidence: "ambiguous",
          selector: "#button",
          clarification: { question: "어떤 점이 불편하셨어요?", options: ["글자가 너무 작아요", "문구가 틀렸어요"] },
        }),
      ],
      contexts: [context(1000, "#button")],
      frames: FRAMES,
    });
    expect(row.clarification).toEqual({
      question: "어떤 점이 불편하셨어요?",
      options: [
        { id: "o1", label: "글자가 너무 작아요" },
        { id: "o2", label: "문구가 틀렸어요" },
      ],
      highlight: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    });
  });

  it("재확인 녹화의 이슈는 질문 초안을 만들지 않고 clear로 둔다 (V4-06)", () => {
    const [row] = mapIssuesToRows({
      recordingId: RECORDING_ID,
      issues: [issue({ confidence: "ambiguous", clarification: { question: "q", options: ["a", "b"] } })],
      contexts: [],
      frames: [],
      isReverify: true,
    });
    expect(row.confidence).toBe("clear");
    expect(row.clarification).toBeNull();
  });

  it("ambiguous인데 요소가 없으면 하이라이트는 null", () => {
    const [row] = mapIssuesToRows({
      recordingId: RECORDING_ID,
      issues: [issue({ confidence: "ambiguous", clarification: { question: "q", options: ["a", "b"] } })],
      contexts: [],
      frames: [],
    });
    expect(row.clarification?.highlight).toBeNull();
  });
});

describe("findNormalizedHighlight", () => {
  it("화면 밖으로 나간 부분은 잘라낸다", () => {
    const highlight = findNormalizedHighlight({
      selector: "#a",
      text: "",
      tagName: "DIV",
      rect: { x: 900, y: -50, width: 200, height: 100 },
      viewport: VIEWPORT,
    });
    expect(highlight).toEqual({ x: 0.9, y: 0, width: 0.1, height: 0.1 });
  });

  it("viewport가 0이면 null", () => {
    expect(
      findNormalizedHighlight({ selector: "#a", text: "", tagName: "DIV", rect: { x: 0, y: 0, width: 1, height: 1 }, viewport: { width: 0, height: 0 } }),
    ).toBeNull();
  });
});
