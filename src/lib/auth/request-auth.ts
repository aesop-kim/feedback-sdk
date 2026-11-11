import "server-only";
import { cookies } from "next/headers";
import { createSignedToken, verifySignedToken } from "@/lib/auth/signed-token";
import { serverEnv } from "@/lib/server-env";
import { getServerSupabase } from "@/lib/supabase/server-client";

const CONVERSATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const ADMIN_SESSION_COOKIE = "lattice_admin_session";

export type AuthorizedConversation = { conversationId: string; projectId: string; endUserId: string };

export function createConversationToken(conversationId: string): string {
  return createSignedToken(conversationId, CONVERSATION_TOKEN_TTL_MS, serverEnv.widgetTokenSecret);
}

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length).trim();
}

// 위젯 API 인증: Bearer 대화 토큰이 없거나 위조·만료면 null → 호출부가 401.
export async function findAuthorizedConversation(request: Request): Promise<AuthorizedConversation | null> {
  const conversationId = verifySignedToken(readBearerToken(request), serverEnv.widgetTokenSecret);
  if (!conversationId) {
    return null;
  }
  const { data } = await getServerSupabase()
    .from("conversations")
    .select("id, project_id, end_user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return { conversationId: data.id, projectId: data.project_id, endUserId: data.end_user_id };
}

export function createAdminSessionToken(): string {
  return createSignedToken("admin", ADMIN_SESSION_TTL_MS, serverEnv.adminSessionSecret);
}

export function getAdminSessionMaxAgeSeconds(): number {
  return ADMIN_SESSION_TTL_MS / 1000;
}

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return verifySignedToken(token, serverEnv.adminSessionSecret) === "admin";
}
