import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

// 브라우저에서는 Realtime Broadcast 구독에만 anon key를 쓴다. 데이터 조회는 항상 인증된 API로.
export function getBrowserSupabase(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}
