import { createConversationToken } from "@/lib/auth/request-auth";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { getServerSupabase } from "@/lib/supabase/server-client";
import { startConversationSchema } from "@/lib/validation/api-schemas";

// 위젯이 열릴 때 호출. 사용자를 찾거나 만들고, 가장 최근 대화를 이어가며 대화 토큰을 발급한다.
export async function POST(request: Request) {
  const parsed = startConversationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  const { projectKey, hostOrigin, user } = parsed.data;
  const supabase = getServerSupabase();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, allowed_origins")
    .eq("project_key", projectKey)
    .maybeSingle();
  if (!project) {
    return respondError(404, "등록되지 않은 프로젝트예요.");
  }
  if (!(project.allowed_origins as string[]).includes(new URL(hostOrigin).origin)) {
    return respondError(403, "이 사이트에서는 위젯을 쓸 수 없어요.");
  }

  const { data: endUser, error: endUserError } = await supabase
    .from("end_users")
    .upsert(
      { project_id: project.id, external_id: user.id, name: user.name, email: user.email ?? null },
      { onConflict: "project_id,external_id" },
    )
    .select("id, name")
    .single();
  if (endUserError || !endUser) {
    return respondError(500, "사용자 정보를 저장하지 못했어요.");
  }

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("end_user_id", endUser.id)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existingConversation?.id as string | undefined;
  if (!conversationId) {
    const { data: createdConversation, error } = await supabase
      .from("conversations")
      .insert({ project_id: project.id, end_user_id: endUser.id })
      .select("id")
      .single();
    if (error || !createdConversation) {
      return respondError(500, "대화를 시작하지 못했어요.");
    }
    conversationId = createdConversation.id as string;
  }

  return respondJson({
    conversationId,
    conversationToken: createConversationToken(conversationId),
    projectName: project.name as string,
    endUserName: endUser.name as string,
  });
}
