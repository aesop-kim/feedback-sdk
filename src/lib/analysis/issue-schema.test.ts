import { describe, expect, it } from "vitest";
import { analysisResultSchema, getAnalysisJsonSchema } from "@/lib/analysis/issue-schema";

const CLEAR_ISSUE = {
  tMs: 1200,
  quote: "등록 버튼을 눌러도 아무 반응이 없어요",
  title: "계약서 등록 버튼 무반응",
  summary: "등록 버튼을 눌러도 아무 일도 일어나지 않아요.",
  suggestion: "#register-button 클릭 핸들러를 연결하세요.",
  frameRef: "1200-click.jpg",
  selector: "#register-button",
  confidence: "clear",
  clarification: null,
};

describe("analysisResultSchema", () => {
  it("clear 이슈를 통과시킨다", () => {
    expect(analysisResultSchema.parse({ issues: [CLEAR_ISSUE] }).issues).toHaveLength(1);
  });

  it("ambiguous인데 clarification이 없으면 실패", () => {
    const result = analysisResultSchema.safeParse({ issues: [{ ...CLEAR_ISSUE, confidence: "ambiguous" }] });
    expect(result.success).toBe(false);
  });

  it("선택지는 2~4개", () => {
    const issue = {
      ...CLEAR_ISSUE,
      confidence: "ambiguous",
      clarification: { question: "어떤 점이 불편하셨어요?", options: ["글자가 너무 작아요"] },
    };
    expect(analysisResultSchema.safeParse({ issues: [issue] }).success).toBe(false);
    issue.clarification.options.push("문구가 틀렸어요");
    expect(analysisResultSchema.safeParse({ issues: [issue] }).success).toBe(true);
  });

  it("JSON Schema로 바꿀 수 있고 필수 필드가 들어 있다", () => {
    expect(getAnalysisJsonSchema()).not.toHaveProperty("$schema");
    const schema = getAnalysisJsonSchema() as { properties: { issues: { items: { required: string[] } } } };
    expect(schema.properties.issues.items.required).toEqual(
      expect.arrayContaining(["tMs", "quote", "title", "summary", "suggestion", "frameRef", "selector", "confidence", "clarification"]),
    );
  });
});
