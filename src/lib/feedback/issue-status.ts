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
