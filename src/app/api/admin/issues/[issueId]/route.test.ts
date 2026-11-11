import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";

const supabaseHolder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/auth/require-admin", () => ({ findAdminRejection: async () => null }));
vi.mock("@/lib/supabase/server-client", () => ({ getServerSupabase: () => supabaseHolder.client }));
vi.mock("@/lib/feedback/feedback-repository", () => ({ insertMessage: vi.fn(async () => "message-1") }));
vi.mock("@/lib/realtime/send-signal", () => ({ sendConversationSignal: vi.fn(async () => undefined) }));

const { PATCH } = await import("@/app/api/admin/issues/[issueId]/route");

const ISSUE_ROW = { id: "issue-1", title: "버튼이 안 눌려요", conversation_id: "conversation-1", status: "open", conversations: { project_id: "project-1" } };

function patchIssue(status: string) {
  const request = new Request("http://localhost/api/admin/issues/issue-1", { method: "PATCH", body: JSON.stringify({ status }) });
  return PATCH(request, { params: Promise.resolve({ issueId: "issue-1" }) });
}

describe("PATCH /api/admin/issues/[issueId]", () => {
  beforeEach(() => {
    supabaseHolder.client = null;
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
});
