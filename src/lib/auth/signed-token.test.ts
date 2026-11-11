import { describe, expect, it } from "vitest";
import { createSignedToken, isSamePassword, verifySignedToken } from "@/lib/auth/signed-token";

const SECRET = "test-secret";
const DAY_MS = 24 * 60 * 60 * 1000;

describe("signed-token", () => {
  it("서명한 subject를 그대로 돌려준다", () => {
    const token = createSignedToken("conversation-1", DAY_MS, SECRET, 1_000);
    expect(verifySignedToken(token, SECRET, 2_000)).toBe("conversation-1");
  });

  it("토큰이 없으면 null", () => {
    expect(verifySignedToken(null, SECRET)).toBeNull();
    expect(verifySignedToken("", SECRET)).toBeNull();
  });

  it("서명을 바꾸면 null", () => {
    const token = createSignedToken("conversation-1", DAY_MS, SECRET, 1_000);
    const [payload] = token.split(".");
    expect(verifySignedToken(`${payload}.forged`, SECRET, 2_000)).toBeNull();
  });

  it("payload를 바꿔치기하면 null", () => {
    const original = createSignedToken("conversation-1", DAY_MS, SECRET, 1_000);
    const other = createSignedToken("conversation-2", DAY_MS, SECRET, 1_000);
    const forged = `${other.split(".")[0]}.${original.split(".")[1]}`;
    expect(verifySignedToken(forged, SECRET, 2_000)).toBeNull();
  });

  it("다른 secret으로 만든 토큰은 null", () => {
    const token = createSignedToken("conversation-1", DAY_MS, "other-secret", 1_000);
    expect(verifySignedToken(token, SECRET, 2_000)).toBeNull();
  });

  it("만료되면 null", () => {
    const token = createSignedToken("conversation-1", 1_000, SECRET, 1_000);
    expect(verifySignedToken(token, SECRET, 2_001)).toBeNull();
  });

  it("비밀번호 비교는 길이가 달라도 안전하게 false", () => {
    expect(isSamePassword("abc", "abcd")).toBe(false);
    expect(isSamePassword("abcd", "abcd")).toBe(true);
  });
});
