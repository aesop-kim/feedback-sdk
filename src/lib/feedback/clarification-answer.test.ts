import { describe, expect, it } from "vitest";
import { findCardAnswerText, getAnswerText } from "@/lib/feedback/clarification-answer";

const OPTIONS = [
  { id: "option-1", label: "등록 버튼" },
  { id: "option-2", label: "저장 버튼" },
];

describe("getAnswerText", () => {
  it("선택지와 직접 쓴 말을 ' · '로 잇고, 빈 쪽은 뺀다", () => {
    expect(getAnswerText("등록 버튼", "눌러도 그대로예요")).toBe("등록 버튼 · 눌러도 그대로예요");
    expect(getAnswerText("등록 버튼", null)).toBe("등록 버튼");
    expect(getAnswerText(undefined, "직접 쓴 말")).toBe("직접 쓴 말");
    expect(getAnswerText(undefined, "")).toBe("");
  });
});

describe("findCardAnswerText", () => {
  it("고른 선택지의 이름과 직접 쓴 말을 보여 준다", () => {
    expect(findCardAnswerText({ options: OPTIONS, answer: { optionId: "option-2", text: "두 번째요" } })).toBe("저장 버튼 · 두 번째요");
  });

  it("답이 없거나 비어 있으면 null", () => {
    expect(findCardAnswerText({ options: OPTIONS, answer: null })).toBeNull();
    expect(findCardAnswerText({ options: OPTIONS, answer: { optionId: "unknown", text: null } })).toBeNull();
  });
});
