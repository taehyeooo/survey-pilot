import type { SupabaseClient } from "@supabase/supabase-js";

// 사용자 상태(multi-user R-2). profiles 행은 가입 때 트리거가 만든다.
export type Member = { agreed_at: string | null };

export async function loadMember(db: SupabaseClient, userId: string): Promise<Member | null> {
  const { data } = await db.from("profiles").select("agreed_at").eq("id", userId).maybeSingle().throwOnError();
  return data;
}

// 이용 안내에 동의하기 전에는 만들기·AI·게시를 받지 않는다. 행이 없어도 동의 전으로 본다.
export function needsAgreement(member: Member | null) {
  return !member?.agreed_at;
}

// 처음 동의한 시각을 남긴다 — 다시 눌러도 바꾸지 않는다.
export async function agreeToTerms(db: SupabaseClient, userId: string, now = new Date()) {
  await db.from("profiles").update({ agreed_at: now.toISOString() }).eq("id", userId).is("agreed_at", null).throwOnError();
}

// 내 설문만(multi-user R-3). 쓰기는 서버 클라이언트(RLS 우회)로 하므로 주인 확인을 쿼리에 건다.
// 남의 설문이면 null — 화면은 404로 보인다.
export async function ownedSurvey<T>(db: SupabaseClient, ownerId: string, id: string, columns: string): Promise<T | null> {
  const { data } = await db.from("surveys").select(columns).eq("id", id).eq("owner_id", ownerId).maybeSingle().throwOnError();
  return data as T | null;
}
