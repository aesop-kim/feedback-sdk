import "server-only";
import { hasAdminSession } from "@/lib/auth/request-auth";
import { respondError } from "@/lib/http/api-response";

// 관리자 API 공통 가드. 세션이 없으면 401 응답을, 있으면 null을 돌려준다.
export async function findAdminRejection() {
  if (await hasAdminSession()) {
    return null;
  }
  return respondError(401, "관리자 로그인이 필요해요.");
}
