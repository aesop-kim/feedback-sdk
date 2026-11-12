import type { AdminIssueStatus } from "@/lib/feedback/issue-status";

export type IssueStatusMessage = { body: string; preview: string };

// 관리자가 이슈 상태를 바꿀 때 고객 위젯에 보내는 시스템 메시지. 상태가 실제로 바뀐 때만 보낸다.
// - resolved(반영 완료): 같은 화면에서 다시 확인해 달라고 부탁한다.
// - closed(해결됨): 재확인 녹화를 보내 준 고객에게 끝났다고 알린다.
// - open(다시 열기): 아직 남아 있다는 걸 알고 다시 고친다고 알린다.
export function getIssueStatusMessage(target: AdminIssueStatus, issueTitle: string): IssueStatusMessage {
  switch (target) {
    case "resolved":
      return { body: `‘${issueTitle}’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요.`, preview: "수정을 반영했어요" };
    case "closed":
      return { body: `‘${issueTitle}’ 확인해 주셔서 고마워요. 해결로 정리했어요.`, preview: "해결로 정리했어요" };
    case "open":
      return { body: `‘${issueTitle}’ 아직 남아 있는 걸 확인했어요. 다시 고칠게요.`, preview: "다시 고칠게요" };
  }
}

// 반영 완료를 잘못 눌렀을 때. 앞서 보낸 "다시 확인해 주세요"를 거둬들인다.
export function getResolveCancelMessage(issueTitle: string): IssueStatusMessage {
  return {
    body: `‘${issueTitle}’ 반영 안내를 취소했어요. 아직 고치는 중이라 다시 확인하지 않으셔도 돼요.`,
    preview: "반영 안내를 취소했어요",
  };
}
