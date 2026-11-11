import { describe, expect, it } from "vitest";
import { extractElementContexts, shiftTranscript, toRelativeMs } from "@/lib/analysis/align-timeline";

const T0 = 1_700_000_000_000;
const RECT = { x: 10, y: 20, width: 100, height: 40 };
const VIEWPORT = { width: 1280, height: 720 };

function contextEvent(epochMs: number, payload: Record<string, unknown>, tag = "element-context") {
  return { type: 5, timestamp: epochMs, data: { tag, payload } };
}

describe("shiftTranscript", () => {
  it("양수 오프셋을 모든 단어·세그먼트에 더한다", () => {
    const shifted = shiftTranscript(
      { segments: [{ startMs: 0, endMs: 1000, text: "a" }], words: [{ startMs: 100, endMs: 500, text: "a" }] },
      250,
    );
    expect(shifted.segments[0]).toMatchObject({ startMs: 250, endMs: 1250 });
    expect(shifted.words[0]).toMatchObject({ startMs: 350, endMs: 750 });
  });

  it("음수 오프셋은 빼되 0 아래로 내려가지 않는다", () => {
    const shifted = shiftTranscript(
      { segments: [{ startMs: 200, endMs: 2000, text: "a" }], words: [{ startMs: 200, endMs: 600, text: "a" }] },
      -500,
    );
    expect(shifted.segments[0]).toMatchObject({ startMs: 0, endMs: 1500 });
    expect(shifted.words[0]).toMatchObject({ startMs: 0, endMs: 100 });
  });
});

describe("toRelativeMs", () => {
  it("epoch에서 t0를 뺀다", () => {
    expect(toRelativeMs(T0 + 1234, T0)).toBe(1234);
    expect(toRelativeMs(T0 - 10, T0)).toBe(-10);
  });
});

describe("extractElementContexts", () => {
  it("element-context 이벤트만 뽑아 시간순으로 돌려준다", () => {
    const contexts = extractElementContexts(
      [
        { type: 3, timestamp: T0 + 10, data: { source: 2 } },
        contextEvent(T0 + 3000, { selector: "#b", text: "B", tagName: "TD", rect: RECT, viewport: VIEWPORT }),
        contextEvent(T0 + 1000, { selector: "#a", text: "등록", tagName: "BUTTON", rect: RECT, viewport: VIEWPORT, kind: "click" }),
        contextEvent(T0 + 2000, { selector: "#c", rect: RECT, viewport: VIEWPORT }, "element-click"),
        contextEvent(T0 + 4000, { text: "selector 없음", rect: RECT, viewport: VIEWPORT }),
        { type: 5, timestamp: T0 + 5000, data: { tag: "other", payload: {} } },
      ],
      T0,
    );
    expect(contexts.map((item) => [item.tMs, item.kind, item.context.selector])).toEqual([
      [1000, "click", "#a"],
      [2000, "click", "#c"],
      [3000, "hover", "#b"],
    ]);
    expect(contexts[1].context).toEqual({ selector: "#c", text: "", tagName: "", rect: RECT, viewport: VIEWPORT });
  });

  it("{ events: [...] } 모양도 받는다", () => {
    const contexts = extractElementContexts(
      { events: [contextEvent(T0 + 500, { selector: "#a", rect: RECT, viewport: VIEWPORT, reason: "click" })] },
      T0,
    );
    expect(contexts).toHaveLength(1);
    expect(contexts[0].kind).toBe("click");
  });

  it("rrweb 클릭 직후의 컨텍스트는 click으로 본다", () => {
    const contexts = extractElementContexts(
      [
        { type: 3, timestamp: T0 + 1000, data: { source: 2, type: 2, id: 42, x: 1, y: 1 } },
        contextEvent(T0 + 1500, { selector: "#register", rect: RECT, viewport: VIEWPORT }),
        contextEvent(T0 + 4000, { selector: "#later", rect: RECT, viewport: VIEWPORT }),
      ],
      T0,
    );
    expect(contexts.map((item) => [item.context.selector, item.kind])).toEqual([
      ["#register", "click"],
      ["#later", "hover"],
    ]);
  });

  it("위젯이 올린 { t0, rrwebEvents, contexts } 형태에서도 읽는다", () => {
    const uploaded = {
      t0: T0,
      rrwebEvents: [
        {
          type: 5,
          timestamp: T0 + 4_000,
          data: {
            tag: "element-click",
            payload: {
              selector: "main > button",
              text: "계약서 등록",
              tagName: "button",
              rect: { x: 1240, y: 18, width: 64, height: 20 },
              viewport: { width: 1440, height: 900 },
            },
          },
        },
      ],
      contexts: [],
    };
    const contexts = extractElementContexts(uploaded, T0);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]).toMatchObject({ tMs: 4_000, kind: "click", context: { text: "계약서 등록" } });
  });

  it("이상한 입력이면 빈 배열", () => {
    expect(extractElementContexts(null, T0)).toEqual([]);
    expect(extractElementContexts("nope", T0)).toEqual([]);
  });
});
