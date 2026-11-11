import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken, getAdminSessionMaxAgeSeconds } from "@/lib/auth/request-auth";
import { isSamePassword } from "@/lib/auth/signed-token";
import { respondError, respondJson, respondValidationError } from "@/lib/http/api-response";
import { serverEnv } from "@/lib/server-env";
import { adminLoginSchema } from "@/lib/validation/api-schemas";

export async function POST(request: Request) {
  const parsed = adminLoginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return respondValidationError(parsed.error);
  }
  if (!isSamePassword(parsed.data.password, serverEnv.adminPassword)) {
    return respondError(401, "비밀번호가 맞지 않아요.");
  }
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
