import { describe, expect, it } from "vitest";
import {
  MISSING_RECORDING_FILE_ERROR,
  SILENT_AUDIO_ERROR,
  findReanalyzeRejection,
  findRecordingFailureKind,
  getFailureGuidance,
  hasProgressedIssue,
} from "@/lib/feedback/recording-failure";

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

describe("녹화 파일이 없는 실패", () => {
  it("워커가 파일을 못 찾았다고 남기면 분석을 시도했어도 업로드 미완료", () => {
    const error = `녹화 파일을 내려받지 못했어요: ${MISSING_RECORDING_FILE_ERROR}`;
    expect(findRecordingFailureKind({ status: "failed", error, analysisAttempt: 1 })).toBe("upload_incomplete");
  });
});

describe("findReanalyzeRejection", () => {
  it("업로드 미완료는 거절", () => {
    expect(findReanalyzeRejection({ failureKind: "upload_incomplete", hasAudio: true })).toMatch(/다시 녹화/);
  });

  it("녹음 파일이 없으면 거절", () => {
    expect(findReanalyzeRejection({ failureKind: "analysis", hasAudio: false })).toMatch(/다시 녹화/);
    expect(findReanalyzeRejection({ failureKind: null, hasAudio: false })).not.toBeNull();
  });

  it("파일이 있는 분석 실패·무음·완료 녹화는 허용", () => {
    expect(findReanalyzeRejection({ failureKind: "analysis", hasAudio: true })).toBeNull();
    expect(findReanalyzeRejection({ failureKind: "silent_audio", hasAudio: true })).toBeNull();
    expect(findReanalyzeRejection({ failureKind: null, hasAudio: true })).toBeNull();
  });
});

describe("getFailureGuidance", () => {
  it("업로드 미완료는 영상을 받았다고 말하지 않고 다시 정리하기도 없다", () => {
    const guidance = getFailureGuidance("upload_incomplete", false);
    expect(guidance.reanalyzeAction).toBe("none");
    expect(guidance.guide).not.toMatch(/안전하게 받아|다시 정리하면/);
    expect(guidance.guide).toMatch(/다시 녹화/);
  });

  it("무음은 다시 녹화를 먼저 안내하고 다시 정리하기는 보조로 둔다", () => {
    const guidance = getFailureGuidance("silent_audio", true);
    expect(guidance.reanalyzeAction).toBe("secondary");
    expect(guidance.guide).toMatch(/다시 녹화/);
  });

  it("분석 실패는 다시 정리하기가 주 행동", () => {
    expect(getFailureGuidance("analysis", true).reanalyzeAction).toBe("primary");
    expect(getFailureGuidance("analysis", false).guide).toMatch(/다시 정리하면/);
  });
});

describe("hasProgressedIssue", () => {
  it("반영 완료·재확인·해결됨 이슈가 하나라도 있으면 true", () => {
    expect(hasProgressedIssue(["open", "resolved"])).toBe(true);
    expect(hasProgressedIssue(["reverify"])).toBe(true);
    expect(hasProgressedIssue(["closed"])).toBe(true);
  });

  it("아직 처리하지 않은 이슈뿐이거나 이슈가 없으면 false", () => {
    expect(hasProgressedIssue(["open", "asked", "answered"])).toBe(false);
    expect(hasProgressedIssue([])).toBe(false);
  });
});
