import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

// RLS를 무시하는 비밀 키 클라이언트 — 서버 라우트에서만 쓴다(ADR 0019).
// "server-only" 때문에 클라이언트 컴포넌트에서 가져오면 빌드가 실패한다.
export function createAdminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
