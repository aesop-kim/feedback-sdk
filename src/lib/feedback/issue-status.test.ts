import { describe, expect, it } from "vitest";
import { findIssueTransition, getStatusAfterAnswer, isRemainingIssue } from "@/lib/feedback/issue-status";

describe("getStatusAfterAnswer", () => {
  it("질문 중이거나 열린 이슈는 답변 받음이 된다", () => {
    expect(getStatusAfterAnswer("asked")).toBe("answered");
    expect(getStatusAfterAnswer("open")).toBe("answered");
  });

  it("반영 완료·재확인·이미 답변 받은 이슈는 그대로 둔다", () => {
    expect(getStatusAfterAnswer("resolved")).toBe("resolved");
    expect(getStatusAfterAnswer("reverify")).toBe("reverify");
    expect(getStatusAfterAnswer("answered")).toBe("answered");
    expect(getStatusAfterAnswer("closed")).toBe("closed");
  });
});

describe("findIssueTransition", () => {
  it("반영 완료는 아직 고치지 않은 이슈에서만 바꾼다", () => {
    expect(findIssueTransition("open", "resolved")).toBe("change");
    expect(findIssueTransition("asked", "resolved")).toBe("change");
    expect(findIssueTransition("answered", "resolved")).toBe("change");
  });

  it("재확인 중이거나 닫힌 이슈는 반영 완료로 되돌리지 않는다(고객에게 재확인 요청이 또 가지 않게)", () => {
    expect(findIssueTransition("reverify", "resolved")).toBe("rejected");
    expect(findIssueTransition("closed", "resolved")).toBe("rejected");
  });

  it("재확인 중인 이슈는 해결됨으로 닫거나 다시 열 수 있다", () => {
    expect(findIssueTransition("reverify", "closed")).toBe("change");
    expect(findIssueTransition("reverify", "open")).toBe("change");
  });

  it("해결됨으로 닫은 이슈는 다시 열 수 있다(잘못 닫았거나 문제가 다시 나왔을 때)", () => {
    expect(findIssueTransition("closed", "open")).toBe("change");
  });

  it("재확인 전 이슈는 닫거나 다시 열 수 없다", () => {
    expect(findIssueTransition("resolved", "closed")).toBe("rejected");
    expect(findIssueTransition("asked", "closed")).toBe("rejected");
    expect(findIssueTransition("answered", "open")).toBe("rejected");
    expect(findIssueTransition("resolved", "open")).toBe("rejected");
  });

  it("이미 그 상태면 바꾸지 않는다(멱등)", () => {
    expect(findIssueTransition("resolved", "resolved")).toBe("unchanged");
    expect(findIssueTransition("closed", "closed")).toBe("unchanged");
    expect(findIssueTransition("open", "open")).toBe("unchanged");
  });
});

describe("isRemainingIssue", () => {
  it("반영 완료·해결됨은 남은 문제에서 뺀다", () => {
    expect(isRemainingIssue("resolved")).toBe(false);
    expect(isRemainingIssue("closed")).toBe(false);
  });

  it("관리자가 볼 일이 남은 이슈는 센다", () => {
    for (const status of ["open", "asked", "answered", "reverify"] as const) {
      expect(isRemainingIssue(status)).toBe(true);
    }
  });
});
