import { findAdminRejection } from "@/lib/auth/require-admin";
import { getConversationSummaries } from "@/lib/feedback/feedback-repository";
import { respondJson } from "@/lib/http/api-response";
import { getServerSupabase } from "@/lib/supabase/server-client";

export async function GET() {
  const rejection = await findAdminRejection();
  if (rejection) {
    return rejection;
  }
  const { data: project } = await getServerSupabase().from("projects").select("id, name, project_key").limit(1).maybeSingle();
  const conversations = await getConversationSummaries();
  return respondJson({
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    projectKey: project?.project_key ?? null,
    conversations,
  });
}
