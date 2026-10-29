import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

// 로그인 세션(쿠키)을 쓰는 클라이언트 — RLS가 적용된다. 관리자 화면·액션에서 쓴다.
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // 서버 컴포넌트 렌더링 중에는 쿠키를 쓸 수 없다 — 세션 갱신은 proxy.ts가 한다.
        }
      },
    },
  });
}
