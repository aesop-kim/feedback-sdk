import { describe, expect, it } from "vitest";
import { getFramePath, getRecordingUploadPaths, isUploadRetryable } from "@/lib/feedback/recording-upload";

describe("getFramePath", () => {
  it("시각과 이유로 장면 경로를 만든다", () => {
    expect(getFramePath({ tMs: 1200, reason: "click" })).toBe("frames/1200-click.jpg");
  });
});

describe("getRecordingUploadPaths", () => {
  it("영상·음성·이벤트 다음에 장면 경로를 붙인다", () => {
    expect(getRecordingUploadPaths(["frames/0-interval.jpg"])).toEqual([
      "video.webm",
      "audio.webm",
      "events.json",
      "frames/0-interval.jpg",
    ]);
  });
});

describe("isUploadRetryable", () => {
  it("업로드 중이면 다시 보낼 수 있다", () => {
    expect(isUploadRetryable({ status: "uploading", analysisAttempt: 0 })).toBe(true);
  });

  it("분석 전에 실패한 녹화는 다시 보낼 수 있다", () => {
    expect(isUploadRetryable({ status: "failed", analysisAttempt: 0 })).toBe(true);
  });

  it("분석하다 실패했거나 이미 올라간 녹화는 다시 보낼 수 없다", () => {
    expect(isUploadRetryable({ status: "failed", analysisAttempt: 1 })).toBe(false);
    expect(isUploadRetryable({ status: "uploaded", analysisAttempt: 0 })).toBe(false);
    expect(isUploadRetryable({ status: "analyzed", analysisAttempt: 1 })).toBe(false);
  });
});
