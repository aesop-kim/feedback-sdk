import { describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeResult } from "@/lib/testing/fake-supabase";

const supabaseHolder = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/auth/require-admin", () => ({ findAdminRejection: async () => null }));
vi.mock("@/lib/supabase/server-client", () => ({ RECORDINGS_BUCKET: "recordings", getServerSupabase: () => supabaseHolder.client }));

const { POST } = await import("@/app/api/admin/recordings/[recordingId]/reanalyze/route");

const FAILED_RECORDING: FakeResult = { data: { status: "failed", error: "이슈를 분석하지 못했어요: 시간 초과", analysis_attempt: 1 } };

function reanalyze(resultsByTable: Record<string, FakeResult[]>) {
  supabaseHolder.client = createFakeSupabase(resultsByTable, ["audio.webm"]);
  const request = new Request("http://localhost/api/admin/recordings/recording-1/reanalyze", { method: "POST" });
  return POST(request, { params: Promise.resolve({ recordingId: "recording-1" }) });
}

describe("POST /api/admin/recordings/[recordingId]/reanalyze", () => {
  it("녹화를 읽다가 DB 오류가 나면 500", async () => {
    const response = await reanalyze({ recordings: [{ error: { message: "connection reset" } }] });
    expect(response.status).toBe(500);
  });

  it("질문 카드를 확인하다가 DB 오류가 나면 500", async () => {
    const response = await reanalyze({ recordings: [FAILED_RECORDING], clarification_cards: [{ error: { message: "timeout" } }] });
    expect(response.status).toBe(500);
  });

  it("처리한 이슈가 있으면 409", async () => {
    const response = await reanalyze({ recordings: [FAILED_RECORDING], clarification_cards: [{ count: 0 }], issues: [{ count: 1 }] });
    expect(response.status).toBe(409);
  });

  it("대기열로 돌리다가 DB 오류가 나면 queued:false가 아니라 500", async () => {
    const response = await reanalyze({
      recordings: [FAILED_RECORDING, { error: { message: "timeout" } }],
      clarification_cards: [{ count: 0 }],
      issues: [{ count: 0 }],
    });
    expect(response.status).toBe(500);
  });

  it("대기열로 돌리면 queued:true", async () => {
    const response = await reanalyze({
      recordings: [FAILED_RECORDING, { data: [{ id: "recording-1" }] }],
      clarification_cards: [{ count: 0 }],
      issues: [{ count: 0 }],
    });
    expect(await response.json()).toEqual({ recordingId: "recording-1", queued: true });
  });
});
