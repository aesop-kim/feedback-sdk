import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";

const supabaseHolder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/auth/require-admin", () => ({ findAdminRejection: async () => null }));
vi.mock("@/lib/supabase/server-client", () => ({ getServerSupabase: () => supabaseHolder.client }));
vi.mock("@/lib/feedback/feedback-repository", () => ({ insertMessage: vi.fn(async () => "message-1") }));
vi.mock("@/lib/realtime/send-signal", () => ({ sendConversationSignal: vi.fn(async () => undefined) }));

const { PATCH } = await import("@/app/api/admin/issues/[issueId]/route");
const { insertMessage } = await import("@/lib/feedback/feedback-repository");

const ISSUE_ROW = { id: "issue-1", title: "버튼이 안 눌려요", conversation_id: "conversation-1", status: "open", conversations: { project_id: "project-1" } };

function patchIssue(status: string) {
  const request = new Request("http://localhost/api/admin/issues/issue-1", { method: "PATCH", body: JSON.stringify({ status }) });
  return PATCH(request, { params: Promise.resolve({ issueId: "issue-1" }) });
}

describe("PATCH /api/admin/issues/[issueId]", () => {
  beforeEach(() => {
    supabaseHolder.client = null;
    vi.mocked(insertMessage).mockClear();
  });

  it("이슈를 읽다가 DB 오류가 나면 500", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ error: { message: "connection reset" } }] });
    const response = await patchIssue("resolved");
    expect(response.status).toBe(500);
  });

  it("상태를 바꾸다가 DB 오류가 나면 changed:false가 아니라 500", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: ISSUE_ROW }, { error: { message: "connection reset" } }] });
    const response = await patchIssue("resolved");
    expect(response.status).toBe(500);
  });

  it("다른 요청이 먼저 바꿔 바뀐 행이 없으면 200 changed:false", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: ISSUE_ROW }, { data: [] }] });
    const response = await patchIssue("resolved");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ issueId: "issue-1", changed: false });
  });

  it("바꾸면 200 changed:true", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: ISSUE_ROW }, { data: [{ id: "issue-1" }] }] });
    const response = await patchIssue("resolved");
    expect(await response.json()).toEqual({ issueId: "issue-1", changed: true });
  });

  it("재확인 이슈를 해결됨으로 닫으면 고객에게 끝났다고 한 번 알린다 (V4-02)", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: { ...ISSUE_ROW, status: "reverify" } }, { data: [{ id: "issue-1" }] }] });
    const response = await patchIssue("closed");
    expect(await response.json()).toEqual({ issueId: "issue-1", changed: true });
    expect(insertMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(insertMessage).mock.calls[0][0]).toMatchObject({
      sender: "system",
      body: "‘버튼이 안 눌려요’ 확인해 주셔서 고마워요. 해결로 정리했어요.",
    });
  });

  it("닫은 이슈를 다시 열면 고객에게 다시 고친다고 알린다", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: { ...ISSUE_ROW, status: "closed" } }, { data: [{ id: "issue-1" }] }] });
    const response = await patchIssue("open");
    expect(await response.json()).toEqual({ issueId: "issue-1", changed: true });
    expect(vi.mocked(insertMessage).mock.calls[0][0]).toMatchObject({ body: "‘버튼이 안 눌려요’ 아직 남아 있는 걸 확인했어요. 다시 고칠게요." });
  });

  it("재확인 녹화에서 찾은 이슈는 반영 완료로 바꾸지 않고 고객에게 메시지도 보내지 않는다 (V5-01)", async () => {
    const reverifyFinding = { ...ISSUE_ROW, recordings: { reverify_issue_id: "issue-original" } };
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: reverifyFinding }] });
    const response = await patchIssue("resolved");
    expect(response.status).toBe(409);
    expect(insertMessage).not.toHaveBeenCalled();
  });

  it("일반 녹화에서 찾은 이슈는 그대로 반영 완료로 바꾼다", async () => {
    const ordinaryIssue = { ...ISSUE_ROW, recordings: { reverify_issue_id: null } };
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: ordinaryIssue }, { data: [{ id: "issue-1" }] }] });
    expect(await (await patchIssue("resolved")).json()).toEqual({ issueId: "issue-1", changed: true });
    expect(insertMessage).toHaveBeenCalledTimes(1);
  });

  it("이미 닫힌 이슈를 또 닫거나, 다른 요청이 먼저 바꿨으면 메시지를 보내지 않는다", async () => {
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: { ...ISSUE_ROW, status: "closed" } }] });
    expect(await (await patchIssue("closed")).json()).toEqual({ issueId: "issue-1", changed: false });
    supabaseHolder.client = createFakeSupabase({ issues: [{ data: { ...ISSUE_ROW, status: "reverify" } }, { data: [] }] });
    expect(await (await patchIssue("closed")).json()).toEqual({ issueId: "issue-1", changed: false });
    expect(insertMessage).not.toHaveBeenCalled();
  });
});
