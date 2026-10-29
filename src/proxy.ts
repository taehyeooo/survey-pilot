import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { originOf } from "@/lib/origin";

// 요청마다 Supabase 세션 쿠키를 갱신한다. 권한 확인은 여기서 하지 않고 requireAdmin에서 한다.
export async function proxy(request: NextRequest) {
  // Redirect URL 허용 목록에 없으면 Supabase가 Site URL(/)로 code를 보낸다 — 콜백으로 넘긴다.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const callback = new URL("/auth/callback", originOf(request));
    callback.search = request.nextUrl.search;
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/", "/login", "/auth/:path*", "/admin/:path*"],
};
