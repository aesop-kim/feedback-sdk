import { describe, expect, it } from "vitest";
import { getStatusAfterAnswer } from "@/lib/feedback/issue-status";

describe("getStatusAfterAnswer", () => {
  it("질문 중이거나 열린 이슈는 답변 받음이 된다", () => {
    expect(getStatusAfterAnswer("asked")).toBe("answered");
    expect(getStatusAfterAnswer("open")).toBe("answered");
  });

  it("반영 완료·재확인·이미 답변 받은 이슈는 그대로 둔다", () => {
    expect(getStatusAfterAnswer("resolved")).toBe("resolved");
    expect(getStatusAfterAnswer("reverify")).toBe("reverify");
    expect(getStatusAfterAnswer("answered")).toBe("answered");
  });
});
