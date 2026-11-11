import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeResult } from "@/lib/testing/fake-supabase";

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  insertMessage: vi.fn<() => Promise<string>>(),
  sendConversationSignal: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/request-auth", () => ({
  findAuthorizedConversation: async () => ({ conversationId: "conversation-1", projectId: "project-1" }),
}));
vi.mock("@/lib/supabase/server-client", () => ({ getServerSupabase: () => mocks.client }));
vi.mock("@/lib/feedback/feedback-repository", () => ({ insertMessage: mocks.insertMessage }));
vi.mock("@/lib/realtime/send-signal", () => ({ sendConversationSignal: mocks.sendConversationSignal }));

const { POST } = await import("@/app/api/clarifications/[cardId]/answer/route");

const APPROVED_CARD: FakeResult = {
  data: {
    id: "card-1",
    issue_id: "issue-1",
    options: [{ id: "option-1", label: "등록 버튼" }],
    approved_at: "2026-11-12T00:00:00.000Z",
    answered_at: null,
    issues: { conversation_id: "conversation-1", status: "asked" },
  },
};

function answer(issueUpdate: FakeResult = {}) {
  mocks.client = createFakeSupabase({
    clarification_cards: [APPROVED_CARD, { data: [{ id: "card-1" }] }],
    clarification_answers: [{}],
    issues: [issueUpdate],
  });
  const request = new Request("http://localhost/api/clarifications/card-1/answer", {
    method: "POST",
    body: JSON.stringify({ optionId: "option-1" }),
  });
  return POST(request, { params: Promise.resolve({ cardId: "card-1" }) });
}

describe("POST /api/clarifications/[cardId]/answer", () => {
  beforeEach(() => {
    mocks.insertMessage.mockReset();
    mocks.sendConversationSignal.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("답변을 저장하면 메시지와 두 신호를 보내고 200", async () => {
    mocks.insertMessage.mockResolvedValue("message-1");
    const response = await answer();
    expect(response.status).toBe(200);
    expect(mocks.sendConversationSignal).toHaveBeenCalledTimes(2);
  });

  it("답변을 저장한 뒤 메시지를 못 남겨도 200이고, 답했다는 신호는 보낸다", async () => {
    mocks.insertMessage.mockRejectedValue(new Error("메시지 저장 실패: timeout"));
    const response = await answer();
    expect(response.status).toBe(200);
    expect(((await response.json()) as { cardId: string }).cardId).toBe("card-1");
    expect(mocks.sendConversationSignal).toHaveBeenCalledTimes(1);
    expect(mocks.sendConversationSignal).toHaveBeenCalledWith("conversation-1", "project-1", { type: "clarification.answered", id: "card-1" });
    expect(console.error).toHaveBeenCalled();
  });

  it("이슈 상태를 못 바꿔도 답변은 성공으로 돌려준다", async () => {
    mocks.insertMessage.mockResolvedValue("message-1");
    const response = await answer({ error: { message: "timeout" } });
    expect(response.status).toBe(200);
    expect(console.error).toHaveBeenCalled();
  });
});
