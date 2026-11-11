import "server-only";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경 변수 ${name}이(가) 설정되지 않았어요.`);
  }
  return value;
}

export const serverEnv = {
  get supabaseUrl() {
    return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseServiceRoleKey() {
    return getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get widgetTokenSecret() {
    return getRequiredEnv("WIDGET_TOKEN_SECRET");
  },
  get adminSessionSecret() {
    return getRequiredEnv("ADMIN_SESSION_SECRET");
  },
  get adminPassword() {
    return getRequiredEnv("ADMIN_PASSWORD");
  },
};
