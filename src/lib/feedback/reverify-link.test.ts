import { describe, expect, it } from "vitest";
import {
  findLatestReverifyRecordingId,
  findReverifyOrigin,
  getReverifyRecordingLabel,
} from "@/lib/feedback/reverify-link";
import type { Issue, RecordingDetail } from "@/types/feedback";

function createRecording(id: string, options: { reverifyIssueId?: string; issues?: Pick<Issue, "id" | "title">[] } = {}) {
  return {
    id,
    reverifyIssueId: options.reverifyIssueId ?? null,
    issues: (options.issues ?? []) as Issue[],
  } as RecordingDetail;
}

// API 순서와 같이 최신 녹화가 먼저 온다.
const original = createRecording("recording-1", { issues: [{ id: "issue-a", title: "등록 버튼 무반응" }] });
const firstCheck = createRecording("recording-2", { reverifyIssueId: "issue-a" });
const secondCheck = createRecording("recording-3", { reverifyIssueId: "issue-a" });
const recordings = [secondCheck, firstCheck, original];

describe("findReverifyOrigin", () => {
  it("재확인 녹화는 원래 이슈와 그 녹화를 찾는다", () => {
    expect(findReverifyOrigin(recordings, firstCheck)).toEqual({
      issueId: "issue-a",
      recordingId: "recording-1",
      title: "등록 버튼 무반응",
    });
  });

  it("일반 녹화나 이슈를 못 찾은 재확인 녹화는 null", () => {
    expect(findReverifyOrigin(recordings, original)).toBeNull();
    expect(findReverifyOrigin([firstCheck], firstCheck)).toBeNull();
  });
});

describe("findLatestReverifyRecordingId", () => {
  it("가장 최근 재확인 녹화를 고른다", () => {
    expect(findLatestReverifyRecordingId(recordings, "issue-a")).toBe("recording-3");
  });

  it("재확인 녹화가 없으면 null", () => {
    expect(findLatestReverifyRecordingId(recordings, "issue-b")).toBeNull();
  });
});

describe("getReverifyRecordingLabel", () => {
  it("이슈 제목을 따옴표로 묶는다", () => {
    expect(getReverifyRecordingLabel({ issueId: "issue-a", recordingId: "recording-1", title: "등록 버튼 무반응" })).toBe(
      "‘등록 버튼 무반응’ 다시 확인 녹화",
    );
    expect(getReverifyRecordingLabel(null)).toBe("다시 확인 녹화");
  });
});
