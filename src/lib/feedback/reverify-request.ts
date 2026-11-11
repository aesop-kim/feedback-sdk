import type { IssueStatus, ReverifyRequest } from "@/types/feedback";

type IssueForReverify = { id: string; title: string; status: IssueStatus; resolved_at: string | null };

// 관리자가 반영 완료로 바꿨고 고객이 아직 재확인 녹화를 보내지 않은 이슈 중 가장 최근 것.
// 재확인 녹화 업로드가 끝나면 이슈는 'reverify'가 되어 여기서 빠진다.
export function findOpenReverifyRequest(issues: IssueForReverify[]): ReverifyRequest | null {
  let latest: IssueForReverify | null = null;
  for (const issue of issues) {
    if (issue.status !== "resolved") {
      continue;
    }
    if (!latest || (issue.resolved_at ?? "") > (latest.resolved_at ?? "")) {
      latest = issue;
    }
  }
  if (!latest) {
    return null;
  }
  return { issueId: latest.id, title: latest.title, resolvedAt: latest.resolved_at };
}
