import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 실제 Supabase에 대고 도는 테스트용 — 키가 없으면(CI) hasDb가 false.
// 클라이언트는 beforeAll 안에서 만든다(skipIf여도 describe 본문은 실행된다).
export const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const hasDb = Boolean(url && anonKey && secretKey);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

// 테스트 사용자 만들기·로그인·정리. run은 이 테스트 파일의 행만 지우려는 표시.
export function testUsers() {
  const run = randomUUID().slice(0, 8);
  const service = createClient(url!, secretKey!, noSession);
  const ids: string[] = [];

  async function signIn(name: string, { admin = false } = {}) {
    const email = `test-${name}-${run}@example.com`;
    const password = randomUUID();
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    ids.push(data.user.id);
    if (admin) await service.from("admins").insert({ email }).throwOnError();
    const client = createClient(url!, anonKey!, noSession);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return { client, id: data.user.id, email };
  }

  async function cleanup() {
    await service.from("surveys").delete().in("owner_id", ids);
    await service.from("admins").delete().like("email", `%-${run}@example.com`);
    for (const id of ids) await service.auth.admin.deleteUser(id);
  }

  return { service, signIn, cleanup };
}

export type Db = SupabaseClient;
