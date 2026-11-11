import type { RecordingDetail } from "@/types/feedback";

export type ReverifyOrigin = { issueId: string; recordingId: string; title: string };

// 재확인 녹화가 다시 확인하는 원래 이슈와 그 이슈가 나온 녹화. 일반 녹화거나 이슈를 못 찾으면 null.
export function findReverifyOrigin(recordings: RecordingDetail[], recording: RecordingDetail): ReverifyOrigin | null {
  if (!recording.reverifyIssueId) {
    return null;
  }
  for (const candidate of recordings) {
    const issue = candidate.issues.find((item) => item.id === recording.reverifyIssueId);
    if (issue) {
      return { issueId: issue.id, recordingId: candidate.id, title: issue.title };
    }
  }
  return null;
}

// 이 이슈를 다시 확인하려고 고객이 보낸 녹화 중 가장 최근 것의 id(없으면 null). recordings는 최신순이다.
export function findLatestReverifyRecordingId(recordings: RecordingDetail[], issueId: string): string | null {
  return recordings.find((recording) => recording.reverifyIssueId === issueId)?.id ?? null;
}

export function getReverifyRecordingLabel(origin: ReverifyOrigin | null): string {
  return origin ? `‘${origin.title}’ 다시 확인 녹화` : "다시 확인 녹화";
}
