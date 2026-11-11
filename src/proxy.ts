import { NextResponse, type NextRequest } from "next/server";

const ADMIN_SESSION_COOKIE = "lattice_admin_session";
const ALLOWED_ORIGINS_CACHE_MS = 60_000;
const allowedOriginsCache = new Map<string, { origins: string[]; expiresAt: number }>();

async function findAllowedOrigins(projectKey: string): Promise<string[]> {
  const cached = allowedOriginsCache.get(projectKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.origins;
  }
  const url = new URL("/rest/v1/projects", process.env.NEXT_PUBLIC_SUPABASE_URL);
  url.searchParams.set("select", "allowed_origins");
  url.searchParams.set("project_key", `eq.${projectKey}`);
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const response = await fetch(url, { headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` } });
  const rows = response.ok ? ((await response.json()) as { allowed_origins: string[] }[]) : [];
  const origins = rows[0]?.allowed_origins ?? [];
  allowedOriginsCache.set(projectKey, { origins, expiresAt: Date.now() + ALLOWED_ORIGINS_CACHE_MS });
  return origins;
}

// /widget: 등록된 고객사 사이트에서만 iframe으로 열리게 frame-ancestors를 건다.
// /admin: 세션 쿠키가 없으면 로그인 화면으로 보낸다(실제 검증은 API가 서명까지 확인).
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/widget")) {
    const projectKey = searchParams.get("projectKey") ?? "";
    const origins = projectKey ? await findAllowedOrigins(projectKey) : [];
    const frameAncestors = origins.length > 0 ? origins.join(" ") : "'none'";
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", `frame-ancestors ${frameAncestors}`);
    return response;
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!request.cookies.get(ADMIN_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/widget/:path*", "/admin/:path*"],
};
