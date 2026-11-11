import { describe, expect, it } from "vitest";
import { getFailureGuidance } from "@/lib/feedback/recording-failure";
import {
  getAdminRecordingStateLabel,
  getWidgetRecordingStatusText,
  getWidgetRecordingTitle,
  needsRerecord,
} from "@/lib/feedback/recording-status-label";

describe("getWidgetRecordingStatusText", () => {
  const base = { issueCount: 0, uploadProgress: 0, failureKind: null };

  it("업로드가 끝나지 않은 녹화는 받았다고 말하지 않는다 (V3-01)", () => {
    const text = getWidgetRecordingStatusText({ ...base, status: "failed", failureKind: "upload_incomplete" });
    expect(text).toBe("녹화가 끝까지 올라가지 않았어요");
    expect(text).not.toContain("받았어요");
  });

  it("영상을 받은 분석 실패는 담당자가 직접 본다고 말한다", () => {
    expect(getWidgetRecordingStatusText({ ...base, status: "failed", failureKind: "analysis" })).toBe("받았어요. 담당자가 직접 볼게요");
    expect(getWidgetRecordingStatusText({ ...base, status: "failed", failureKind: "silent_audio" })).toBe(
      "받았어요. 담당자가 직접 볼게요",
    );
  });

  it("진행 상태와 결과", () => {
    expect(getWidgetRecordingStatusText({ ...base, status: "uploading", uploadProgress: 0.42 })).toBe("보내는 중 42%");
    expect(getWidgetRecordingStatusText({ ...base, status: "analyzing" })).toBe("정리하고 있어요");
    expect(getWidgetRecordingStatusText({ ...base, status: "analyzed", issueCount: 3 })).toBe("문제 3건을 정리했어요");
    expect(getWidgetRecordingStatusText({ ...base, status: "analyzed" })).toBe("정리를 마쳤어요");
    expect(getWidgetRecordingStatusText({ ...base, status: "upload_failed" })).toBe("보내지 못했어요");
  });
});

describe("재확인 녹화 카드 (V4-02)", () => {
  const base = { issueCount: 0, uploadProgress: 0, failureKind: null };

  it("제목에 원래 이슈를 붙인다", () => {
    expect(getWidgetRecordingTitle("버튼 무반응")).toBe("‘버튼 무반응’ 다시 확인 녹화");
    expect(getWidgetRecordingTitle(null)).toBe("화면 녹화");
  });

  it("정리가 끝나도 문제 건수를 말하지 않는다", () => {
    for (const issueCount of [0, 2]) {
      const text = getWidgetRecordingStatusText({ ...base, status: "analyzed", issueCount, isReverify: true });
      expect(text).toBe("받았어요. 확인하고 알려 드릴게요");
    }
  });

  it("업로드 미완료는 재확인 녹화여도 그대로 알린다", () => {
    expect(getWidgetRecordingStatusText({ ...base, status: "failed", failureKind: "upload_incomplete", isReverify: true })).toBe(
      "녹화가 끝까지 올라가지 않았어요",
    );
  });
});

describe("needsRerecord", () => {
  it("업로드 미완료만 다시 녹화를 권한다", () => {
    expect(needsRerecord({ failureKind: "upload_incomplete" })).toBe(true);
    expect(needsRerecord({ failureKind: "analysis" })).toBe(false);
    expect(needsRerecord({ failureKind: "silent_audio" })).toBe(false);
    expect(needsRerecord({ failureKind: null })).toBe(false);
  });
});

describe("getAdminRecordingStateLabel", () => {
  it("실패 칩은 분석 패널 제목과 같다 (V3-05)", () => {
    for (const failureKind of ["upload_incomplete", "silent_audio", "analysis"] as const) {
      expect(getAdminRecordingStateLabel({ status: "failed", issueCount: 0, failureKind })).toBe(
        getFailureGuidance(failureKind, true).title,
      );
    }
    expect(getAdminRecordingStateLabel({ status: "failed", issueCount: 0, failureKind: "upload_incomplete" })).toBe(
      "녹화를 끝까지 받지 못했어요",
    );
  });

  it("진행 상태와 결과", () => {
    expect(getAdminRecordingStateLabel({ status: "uploading", issueCount: 0, failureKind: null })).toBe("올리는 중");
    expect(getAdminRecordingStateLabel({ status: "analyzing", issueCount: 0, failureKind: null })).toBe("정리하는 중");
    expect(getAdminRecordingStateLabel({ status: "analyzed", issueCount: 2, failureKind: null })).toBe("문제 2건");
    expect(getAdminRecordingStateLabel({ status: "analyzed", issueCount: 0, failureKind: null })).toBe("찾은 문제 없음");
  });
});
