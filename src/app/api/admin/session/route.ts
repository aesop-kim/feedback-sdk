import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSessionMaxAgeSeconds } from "@/lib/auth/request-auth";
import { createLoginRateLimiter, getClientIp } from "@/lib/auth/login-rate-limit";
import { isSamePassword } from "@/lib/auth/signed-token";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { serverEnv } from "@/lib/server-env";
import { adminLoginSchema } from "@/lib/validation/api-schemas";

const LOGIN_WINDOW_MS = 5 * 60 * 1000;

// IP별로 5분에 5번까지 틀릴 수 있다. 메모리 기반이라 인스턴스마다 따로 센다(login-rate-limit.ts 주석 참고).
const loginRateLimiter = createLoginRateLimiter({ maxFailures: 5, windowMs: LOGIN_WINDOW_MS });

function respondTooManyAttempts(blockedMs: number) {
  const retryAfterSeconds = Math.ceil(blockedMs / 1000);
  const response = respondError(429, `로그인 시도가 너무 많아요. ${Math.ceil(retryAfterSeconds / 60)}분 뒤에 다시 해 주세요.`);
  response.headers.set("retry-after", String(retryAfterSeconds));
  return response;
}

export async function POST(request: Request) {
  const clientIp = getClientIp(request.headers);
  const blockedMs = loginRateLimiter.getBlockedMs(clientIp, Date.now());
  if (blockedMs > 0) {
    return respondTooManyAttempts(blockedMs);
  }
  const parsed = adminLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  if (!isSamePassword(parsed.data.password, serverEnv.adminPassword)) {
    loginRateLimiter.recordFailure(clientIp, Date.now());
    return respondError(401, "비밀번호가 맞지 않아요.");
  }
  loginRateLimiter.reset(clientIp);
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getAdminSessionMaxAgeSeconds(),
  });
  return respondJson({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  return respondJson({ ok: true });
}
