import { describe, expect, it } from "vitest";
import { findOpenReverifyRequest } from "@/lib/feedback/reverify-request";

describe("findOpenReverifyRequest", () => {
  it("반영 완료 이슈가 없으면 null", () => {
    expect(findOpenReverifyRequest([])).toBeNull();
    expect(
      findOpenReverifyRequest([
        { id: "a", title: "버튼", status: "reverify", resolved_at: "2026-11-12T00:00:00Z" },
        { id: "b", title: "입력", status: "asked", resolved_at: null },
      ]),
    ).toBeNull();
  });

  it("가장 최근에 반영 완료한 이슈를 고른다", () => {
    expect(
      findOpenReverifyRequest([
        { id: "a", title: "버튼", status: "resolved", resolved_at: "2026-11-12T00:00:00Z" },
        { id: "b", title: "입력", status: "resolved", resolved_at: "2026-11-12T01:00:00Z" },
        { id: "c", title: "목록", status: "resolved", resolved_at: null },
      ]),
    ).toEqual({ issueId: "b", title: "입력", resolvedAt: "2026-11-12T01:00:00Z" });
  });
});
