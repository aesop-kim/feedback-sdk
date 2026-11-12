import { describe, expect, it } from "vitest";
import { buildAnalysisPrompt } from "@/lib/analysis/build-analysis-prompt";

const BASE = {
  context: { segments: [], frames: [] },
  framesDirectory: "/tmp/frames",
  pageUrl: "https://example.com/",
  pageTitle: "예시",
  viewport: { width: 1440, height: 900 },
};

describe("buildAnalysisPrompt", () => {
  it("재확인 녹화면 원래 이슈와 되묻지 말라는 규칙을 넣는다 (V4-06)", () => {
    const prompt = buildAnalysisPrompt({ ...BASE, reverifyIssue: { title: "계약서 등록 버튼 무반응", summary: "버튼을 눌러도 반응이 없어요." } });
    expect(prompt).toContain("## 다시 확인 녹화");
    expect(prompt).toContain("- 원래 이슈: 계약서 등록 버튼 무반응");
    expect(prompt).toContain("- 원래 내용: 버튼을 눌러도 반응이 없어요.");
    expect(prompt).toContain('confidence는 모두 "clear"');
  });

  it("일반 녹화에는 재확인 안내가 없다", () => {
    expect(buildAnalysisPrompt(BASE)).not.toContain("다시 확인 녹화");
    expect(buildAnalysisPrompt({ ...BASE, reverifyIssue: null })).not.toContain("다시 확인 녹화");
  });

  it("받아쓰기가 오타를 고쳐 적을 수 있으니 화면 글자 원문(text)을 믿으라고 안내한다", () => {
    const prompt = buildAnalysisPrompt(BASE);
    expect(prompt).toContain("## 받아쓰기와 화면 글자를 맞춰 보기");
    expect(prompt).toContain("장면 이미지보다 text를 믿으세요");
    expect(prompt).toContain("띄어쓰기 문제로 짐작하지 마세요");
  });

  it("요소 text를 80자에서 자르지 않고 200자까지 넘긴다", () => {
    const longText = `문서 ID 계약서명 고객 ${"가".repeat(70)} 계약 긍액 체결 여부`;
    const prompt = buildAnalysisPrompt({
      ...BASE,
      context: {
        frames: [],
        segments: [
          {
            index: 0,
            startMs: 0,
            endMs: 1000,
            text: "계약금액 말고 계약금액으로 바꿔주세요",
            frame: null,
            contexts: [
              {
                tMs: 500,
                kind: "hover",
                context: { selector: "div.grid", text: longText, tagName: "div", rect: { x: 0, y: 0, width: 10, height: 10 }, viewport: { width: 100, height: 100 } },
              },
            ],
          },
        ],
      },
    });
    expect(prompt).toContain("계약 긍액 체결 여부");
  });
});
