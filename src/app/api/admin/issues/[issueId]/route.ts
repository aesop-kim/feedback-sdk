import { findAdminRejection } from "@/lib/auth/require-admin";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { findIssueTransition, getAdminTransitionSources, getStatusBeforeResolve, type AdminIssueStatus } from "@/lib/feedback/issue-status";
import { getIssueStatusMessage, getResolveCancelMessage } from "@/lib/feedback/issue-status-message";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { findFirstRelation, getFirstRelation } from "@/lib/supabase/first-relation";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { updateIssueSchema } from "@/lib/validation/api-schemas";
import type { IssueStatus } from "@/types/feedback";

type ClarificationProgress = { approved_at: string | null; answered_at: string | null };

// resolved_at은 "재확인을 부탁한 때"다. 닫을 때는 그대로 두고, 다시 열면 지운다.
// 반영 완료를 취소하면 질문 카드 진행에 맞춰 반영 완료 전 상태(열림·질문 보냄·답변 받음)로 돌린다.
function getIssueUpdate(
  target: AdminIssueStatus,
  isCancellingResolve: boolean,
  card: ClarificationProgress | null,
): { status: IssueStatus; resolved_at?: string | null } {
  if (isCancellingResolve) {
    return { status: getStatusBeforeResolve(card), resolved_at: null };
  }
  if (target === "resolved") {
    return { status: target, resolved_at: new Date().toISOString() };
  }
  if (target === "open") {
    return { status: target, resolved_at: null };
  }
  return { status: target };
}

const REJECTED_MESSAGES: Record<AdminIssueStatus, string> = {
  resolved: "고객이 이미 다시 확인했거나 닫힌 이슈예요. 새로고침해 주세요.",
  closed: "고객이 다시 확인한 이슈만 해결됨으로 닫을 수 있어요.",
  open: "반영 완료했거나, 고객이 다시 확인했거나, 해결됨으로 닫은 이슈만 다시 열 수 있어요.",
};

const REVERIFY_FINDING_REJECTION = "다시 확인 녹화에서 찾은 내용은 반영 완료로 바꾸지 않아요. 원래 이슈에서 닫거나 다시 열어 주세요.";

// 이슈 상태 바꾸기. 같은 요청을 두 번 보내도 두 번째는 changed:false라서 메시지가 두 번 가지 않는다.
// - resolved(반영 완료): 고객에게 다시 확인해 달라는 메시지를 보낸다. 위젯은 GET /api/messages의
//   reverifyRequest로 이 이슈를 알고, 재확인 녹화에 reverifyIssueId를 붙여 보낸다.
//   재확인 녹화에서 찾은 이슈는 원래 이슈를 정하는 근거라서 반영 완료를 받지 않는다(V5-01).
// - closed(해결됨) / open(다시 열기): 재확인 녹화를 본 관리자가 고르는 마무리. 재확인 녹화를 보낸 고객이
//   결과를 알 수 있게 짧은 메시지를 보낸다(V4-02). 닫은 이슈를 다시 열 때도 같은 메시지가 간다.
export async function PATCH(request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const parsed = updateIssueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const target = parsed.data.status;
  const { issueId } = await params;
  const supabase = getServerSupabase();
  const { data: issue, error: issueError } = await supabase
    .from("issues")
    .select(
      "id, title, conversation_id, status, conversations!inner(project_id), recordings!issues_recording_id_fkey(reverify_issue_id), clarification_cards(approved_at, answered_at)",
    )
    .eq("id", issueId)
    .maybeSingle();
  if (issueError) {
    return respondError(500, "이슈를 불러오지 못했어요.");
  }
  if (!issue) {
    return respondError(404, "이슈를 찾을 수 없어요.");
  }
  const transition = findIssueTransition(issue.status as IssueStatus, target);
  if (transition === "unchanged") {
    return respondJson({ issueId, changed: false });
  }
  if (transition === "rejected") {
    return respondError(409, REJECTED_MESSAGES[target]);
  }
  const recordingRelation = findFirstRelation<{ reverify_issue_id: string | null }>(issue.recordings);
  if (target === "resolved" && recordingRelation?.reverify_issue_id) {
    return respondError(409, REVERIFY_FINDING_REJECTION);
  }

  // 반영 완료 취소는 그 상태에서 출발할 때만 조건으로 건다. 사이에 고객이 재확인 녹화를 보냈으면 바뀌지 않는다.
  const isCancellingResolve = target === "open" && issue.status === "resolved";
  const card = findFirstRelation<ClarificationProgress>(issue.clarification_cards) ?? null;
  const sourceStatuses = isCancellingResolve ? ["resolved"] : getAdminTransitionSources(target);

  // 출발 상태를 조건으로 걸어, 동시에 온 요청 중 하나만 바꾸고 메시지도 한 번만 보낸다.
  const { data: updated, error: updateError } = await supabase
    .from("issues")
    .update(getIssueUpdate(target, isCancellingResolve, card))
    .eq("id", issueId)
    .in("status", sourceStatuses)
    .select("id");
  // DB 오류를 changed:false로 돌려주면 관리자는 이미 바뀐 줄 안다. 실패는 실패로 알린다.
  if (updateError) {
    return respondError(500, "이슈 상태를 바꾸지 못했어요. 잠시 뒤 다시 해 주세요.");
  }
  if (!updated || updated.length === 0) {
    return respondJson({ issueId, changed: false });
  }

  const projectRelation = getFirstRelation<{ project_id: string }>(issue.conversations);
  const message = isCancellingResolve ? getResolveCancelMessage(issue.title) : getIssueStatusMessage(target, issue.title);
  const messageId = await insertMessage({
    conversationId: issue.conversation_id,
    sender: "system",
    type: "system",
    body: message.body,
    preview: message.preview,
  });
  await sendConversationSignal(issue.conversation_id, projectRelation.project_id, { type: "message.created", id: messageId });
  return respondJson({ issueId, changed: true });
}
