import type { RecordingStatus } from "@/types/feedback";

type FrameInput = { tMs: number; reason: "interval" | "click" };

export function getFramePath(frame: FrameInput): string {
  return `frames/${frame.tMs}-${frame.reason}.jpg`;
}

// 녹화 한 건이 올려야 하는 파일 경로(녹화 폴더 기준). 순서: 영상, 음성, 이벤트, 장면들.
export function getRecordingUploadPaths(framePaths: string[]): string[] {
  return ["video.webm", "audio.webm", "events.json", ...framePaths];
}

// "다시 보내기"로 업로드 주소를 다시 받을 수 있는 녹화인지.
// 업로드 중이거나, 분석을 한 번도 시작하지 않은 채 실패한 녹화(업로드 주소 발급 실패·업로드 시간 초과)만 된다.
export function isUploadRetryable(recording: { status: RecordingStatus; analysisAttempt: number }): boolean {
  if (recording.status === "uploading") {
    return true;
  }
  return recording.status === "failed" && recording.analysisAttempt === 0;
}
