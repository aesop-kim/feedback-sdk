import { findAdminRejection } from "@/lib/auth/require-admin";
import { insertMessage } from "@/lib/feedback/feedback-repository";
import { findIssueTransition, getAdminTransitionSources, type AdminIssueStatus } from "@/lib/feedback/issue-status";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { sendConversationSignal } from "@/lib/realtime/send-signal";
import { getFirstRelation } from "@/lib/supabase/first-relation";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { updateIssueSchema } from "@/lib/validation/api-schemas";
import type { IssueStatus } from "@/types/feedback";

// resolved_at은 "재확인을 부탁한 때"다. 닫을 때는 그대로 두고, 다시 열면 지운다.
function getIssueUpdate(target: AdminIssueStatus): { status: AdminIssueStatus; resolved_at?: string | null } {
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
  open: "고객이 다시 확인한 이슈만 다시 열 수 있어요.",
};

// 이슈 상태 바꾸기. 같은 요청을 두 번 보내도 두 번째는 changed:false라서 메시지가 두 번 가지 않는다.
// - resolved(반영 완료): 고객에게 다시 확인해 달라는 메시지를 보낸다. 위젯은 GET /api/messages의
//   reverifyRequest로 이 이슈를 알고, 재확인 녹화에 reverifyIssueId를 붙여 보낸다.
// - closed(해결됨) / open(다시 열기): 재확인 녹화를 본 관리자가 고르는 마무리. 고객에게는 알리지 않는다.
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
  const { data: issue } = await supabase
    .from("issues")
    .select("id, title, conversation_id, status, conversations!inner(project_id)")
    .eq("id", issueId)
    .maybeSingle();
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

  // 출발 상태를 조건으로 걸어, 동시에 온 요청 중 하나만 바꾸고 메시지도 한 번만 보낸다.
  const { data: updated } = await supabase
    .from("issues")
    .update(getIssueUpdate(target))
    .eq("id", issueId)
    .in("status", getAdminTransitionSources(target))
    .select("id");
  if (!updated || updated.length === 0) {
    return respondJson({ issueId, changed: false });
  }

  const projectRelation = getFirstRelation<{ project_id: string }>(issue.conversations);
  if (target === "resolved") {
    const messageId = await insertMessage({
      conversationId: issue.conversation_id,
      sender: "system",
      type: "system",
      body: `‘${issue.title}’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요.`,
      preview: "수정을 반영했어요",
    });
    await sendConversationSignal(issue.conversation_id, projectRelation.project_id, { type: "message.created", id: messageId });
  }
  return respondJson({ issueId, changed: true });
}
