import type { ZodError } from "zod";

type ValidationIssue = ZodError["issues"][number];

const FALLBACK_MESSAGE = "요청 형식이 올바르지 않아요.";
const HANGUL_PATTERN = /[가-힣]/;

// zod 오류를 사용자에게 보여 줄 한국어 문장으로 바꾼다. 스키마에 직접 적은 한국어 문구는 그대로 쓴다.
export function getValidationMessage(issue: ValidationIssue | undefined): string {
  if (!issue) {
    return FALLBACK_MESSAGE;
  }
  if (HANGUL_PATTERN.test(issue.message)) {
    return issue.message;
  }
  if (issue.code === "too_big" && issue.origin === "string") {
    return `${issue.maximum}자까지 보낼 수 있어요.`;
  }
  if (issue.code === "too_small" && issue.origin === "string") {
    return "내용을 입력해 주세요.";
  }
  if (issue.code === "too_big" && issue.origin === "array") {
    return `${issue.maximum}개까지 보낼 수 있어요.`;
  }
  return FALLBACK_MESSAGE;
}
