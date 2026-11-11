import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/server-env";

let cachedClient: SupabaseClient | null = null;

// service role 클라이언트. 서버(Route Handler)에서만 쓴다.
export function getServerSupabase(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

export const RECORDINGS_BUCKET = "recordings";
