import type { IssueStatus } from "@/types/feedback";

// 고객 답변으로 'answered'가 될 수 있는 상태. 반영 완료(resolved)·재확인(reverify)처럼
// 관리자가 이미 다음 단계로 넘긴 이슈는 늦게 온 답변으로 되돌리지 않는다.
const STATUSES_ANSWERABLE_BY_USER: IssueStatus[] = ["open", "asked"];

export function getStatusAfterAnswer(current: IssueStatus): IssueStatus {
  if (STATUSES_ANSWERABLE_BY_USER.includes(current)) {
    return "answered";
  }
  return current;
}

export type AdminIssueStatus = "resolved" | "closed" | "open";

// 관리자가 이 상태로 바꿀 수 있는 출발 상태.
// - resolved(반영 완료): 아직 고치지 않은 이슈만. 고객에게 재확인을 부탁하는 메시지가 함께 간다.
// - closed(해결됨): 고객이 재확인 녹화를 보낸 이슈만.
// - open(다시 열기): 재확인 녹화를 봤는데 아직 안 고쳐진 이슈, 또는 잘못 닫았거나 문제가 다시 나온 해결됨 이슈.
//   반영 완료(resolved)에서 열면 "반영 완료 취소"다. 이때는 반영 완료 전 상태로 돌린다(getStatusBeforeResolve).
const ADMIN_TRANSITION_SOURCES: Record<AdminIssueStatus, IssueStatus[]> = {
  resolved: ["open", "asked", "answered"],
  closed: ["reverify"],
  open: ["reverify", "closed", "resolved"],
};

type ClarificationProgress = { approved_at: string | null; answered_at: string | null };

// 반영 완료를 취소할 때 돌아갈 상태. 질문 카드가 어디까지 갔는지로 반영 완료 전 상태를 되살린다.
export function getStatusBeforeResolve(card: ClarificationProgress | null): IssueStatus {
  if (card?.answered_at) {
    return "answered";
  }
  if (card?.approved_at) {
    return "asked";
  }
  return "open";
}

export type IssueTransition = "change" | "unchanged" | "rejected";

// 같은 요청을 두 번 보내도(더블 클릭, 재시도) 두 번째는 unchanged라서 메시지가 두 번 가지 않는다.
export function findIssueTransition(current: IssueStatus, target: AdminIssueStatus): IssueTransition {
  if (current === target) {
    return "unchanged";
  }
  return ADMIN_TRANSITION_SOURCES[target].includes(current) ? "change" : "rejected";
}

export function getAdminTransitionSources(target: AdminIssueStatus): IssueStatus[] {
  return ADMIN_TRANSITION_SOURCES[target];
}

// "남은 문제"에 세는 이슈. 반영 완료(고객 확인 대기)와 해결됨(닫힘)은 관리자가 할 일이 없어서 뺀다.
export function isRemainingIssue(status: IssueStatus): boolean {
  return status !== "resolved" && status !== "closed";
}

// 대화 목록의 "남은 문제" 수. 재확인 녹화에서 나온 이슈는 원래 이슈를 닫을지 다시 열지 고르는 근거라서 세지 않는다.
// 원래 이슈가 다시 열리면 그 이슈가 남은 문제로 돌아온다(V4-06).
export function countRemainingIssues(
  issues: { status: IssueStatus; recordingId: string }[],
  reverifyRecordingIds: ReadonlySet<string>,
): number {
  return issues.filter((issue) => isRemainingIssue(issue.status) && !reverifyRecordingIds.has(issue.recordingId)).length;
}
