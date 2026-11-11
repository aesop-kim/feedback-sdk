import { describe, expect, it } from "vitest";
import { findReverifyPrompt } from "@/lib/widget/reverify-prompt";

const system = (id: string, title: string) => ({
  id,
  sender: "system" as const,
  type: "system" as const,
  body: `‘${title}’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요.`,
});
const userRecording = (id: string) => ({ id, sender: "user" as const, type: "recording" as const, body: null });
const userText = (id: string) => ({ id, sender: "user" as const, type: "text" as const, body: "안녕하세요" });

const request = { issueId: "issue-2", title: "저장 버튼", resolvedAt: "2026-11-12T01:00:00+00:00" };

describe("findReverifyPrompt", () => {
  it("열린 재확인 요청과 제목이 같은 마지막 안내에 버튼을 붙이고 이슈를 연결한다", () => {
    const messages = [system("m1", "로그인"), system("m2", "저장 버튼"), userText("m3")];
    expect(findReverifyPrompt(messages, request)).toEqual({ messageId: "m2", issueId: "issue-2", title: "저장 버튼" });
  });

  it("제목이 맞는 안내가 없으면 마지막 안내에 붙인다", () => {
    expect(findReverifyPrompt([system("m1", "다른 이름")], request)?.messageId).toBe("m1");
  });

  it("서버가 요청이 없다고 하면(null) 버튼이 없다", () => {
    expect(findReverifyPrompt([system("m1", "저장 버튼")], null)).toBeNull();
  });

  it("안내 메시지가 없으면 버튼이 없다", () => {
    expect(findReverifyPrompt([userText("m1")], request)).toBeNull();
  });

  it("reverifyRequest를 모르는 서버면 이슈 연결 없이 붙이고, 그 뒤 녹화를 보냈으면 거둔다", () => {
    expect(findReverifyPrompt([system("m1", "저장 버튼")], undefined)).toEqual({ messageId: "m1", issueId: null, title: "저장 버튼" });
    expect(findReverifyPrompt([system("m1", "저장 버튼"), userRecording("m2")], undefined)).toBeNull();
  });
});
