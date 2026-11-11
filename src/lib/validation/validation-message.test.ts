import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getValidationMessage } from "@/lib/validation/validation-message";
import { sendMessageSchema } from "@/lib/validation/api-schemas";

function getFirstIssue(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    throw new Error("검증이 통과하면 안 돼요");
  }
  return parsed.error.issues[0];
}

describe("getValidationMessage", () => {
  it("2000자를 넘는 답장은 한국어 길이 안내", () => {
    expect(getValidationMessage(getFirstIssue(sendMessageSchema, { body: "가".repeat(2_050) }))).toBe(
      "2000자까지 보낼 수 있어요.",
    );
  });

  it("스키마에 적은 한국어 문구는 그대로 쓴다", () => {
    expect(getValidationMessage(getFirstIssue(sendMessageSchema, { body: "   " }))).toBe("내용을 입력해 주세요");
  });

  it("빈 문자열·배열 초과도 한국어로", () => {
    expect(getValidationMessage(getFirstIssue(z.object({ name: z.string().min(1) }), { name: "" }))).toBe("내용을 입력해 주세요.");
    expect(getValidationMessage(getFirstIssue(z.array(z.number()).max(2), [1, 2, 3]))).toBe("2개까지 보낼 수 있어요.");
  });

  it("그 밖의 영어 오류와 빈 값은 일반 안내", () => {
    expect(getValidationMessage(getFirstIssue(z.object({ id: z.string().uuid() }), { id: "x" }))).toBe(
      "요청 형식이 올바르지 않아요.",
    );
    expect(getValidationMessage(undefined)).toBe("요청 형식이 올바르지 않아요.");
  });
});
