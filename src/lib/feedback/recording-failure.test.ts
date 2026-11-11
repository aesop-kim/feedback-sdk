import { describe, expect, it } from "vitest";
import { SILENT_AUDIO_ERROR, findRecordingFailureKind } from "@/lib/feedback/recording-failure";

describe("findRecordingFailureKind", () => {
  it("실패가 아니면 null", () => {
    expect(findRecordingFailureKind({ status: "analyzed", error: null, analysisAttempt: 1 })).toBeNull();
  });

  it("분석을 한 번도 시작하지 않은 실패는 업로드 미완료", () => {
    expect(findRecordingFailureKind({ status: "failed", error: "업로드 주소 발급 실패", analysisAttempt: 0 })).toBe(
      "upload_incomplete",
    );
  });

  it("무음 문구가 들어 있으면 무음", () => {
    const error = `음성을 받아쓰지 못했어요: ${SILENT_AUDIO_ERROR}`;
    expect(findRecordingFailureKind({ status: "failed", error, analysisAttempt: 1 })).toBe("silent_audio");
    expect(findRecordingFailureKind({ status: "failed", error: SILENT_AUDIO_ERROR, analysisAttempt: 0 })).toBe("silent_audio");
  });

  it("그 밖의 분석 실패", () => {
    expect(findRecordingFailureKind({ status: "failed", error: "이슈를 분석하지 못했어요: 시간 초과", analysisAttempt: 2 })).toBe(
      "analysis",
    );
    expect(findRecordingFailureKind({ status: "failed", error: null, analysisAttempt: 1 })).toBe("analysis");
  });
});
