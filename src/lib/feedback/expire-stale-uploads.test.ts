import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { EXPIRED_UPLOAD_MESSAGE, expireStaleUploads } from "@/lib/feedback/expire-stale-uploads";
import { createFakeSupabase, type FakeResult } from "@/lib/testing/fake-supabase";

function createClient(rpcResult: FakeResult, tables: Record<string, FakeResult[]> = {}) {
  const fake = createFakeSupabase(tables);
  const from = vi.fn(fake.from);
  const rpc = vi.fn(async () => ({ data: rpcResult.data ?? null, error: rpcResult.error ?? null }));
  return { client: { ...fake, from, rpc } as unknown as SupabaseClient, from, rpc };
}

const EXPIRED_ROW = { id: "recording-1", conversation_id: "conversation-1", project_id: "project-1" };

describe("expireStaleUploads", () => {
  it("만료된 녹화마다 고객에게 다시 녹화를 부탁하는 메시지를 한 번 보낸다", async () => {
    const { client, rpc, from } = createClient(
      { data: [EXPIRED_ROW] },
      {
        messages: [{ data: { id: "message-1" } }],
        conversations: [{ data: { user_unread_count: 2 } }, { data: null }],
      },
    );
    const expired = await expireStaleUploads(client, 30);
    expect(rpc).toHaveBeenCalledWith("expire_stale_uploads", { p_stale_minutes: 30 });
    expect(expired).toEqual([{ ...EXPIRED_ROW, message_id: "message-1" }]);
    expect(from.mock.calls.map(([table]) => table)).toEqual(["messages", "conversations", "conversations"]);
    expect(EXPIRED_UPLOAD_MESSAGE.body).toContain("한 번 더 녹화해 주세요");
  });

  it("바뀐 녹화가 없으면 메시지를 보내지 않는다", async () => {
    const { client, from } = createClient({ data: [] });
    expect(await expireStaleUploads(client, 30)).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("메시지 저장이 실패해도 만료 결과는 돌려준다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = createClient({ data: [EXPIRED_ROW] }, { messages: [{ error: { message: "insert failed" } }] });
    expect(await expireStaleUploads(client, 30)).toEqual([{ ...EXPIRED_ROW, message_id: null }]);
    consoleError.mockRestore();
  });

  it("RPC가 실패하면 던진다", async () => {
    const { client } = createClient({ error: { message: "boom" } });
    await expect(expireStaleUploads(client, 30)).rejects.toThrow("expire_stale_uploads 실패: boom");
  });
});
