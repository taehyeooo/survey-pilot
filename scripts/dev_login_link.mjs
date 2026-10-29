#!/usr/bin/env node
// 로컬에서 관리자 화면을 확인할 때 쓰는 테스트 관리자 로그인 링크를 만든다(실제 메일을 쓰지 않는다).
// 1) 테스트 계정(@example.com만)을 만들고 admins에 넣는다 2) /auth/confirm 링크를 출력한다.
// 사용:
//   node --env-file=.env.local scripts/dev_login_link.mjs test-e2e-admin@example.com 3001
//   ADMIN_EMAIL=test-e2e-admin@example.com npm run dev -- --port 3001   (그 포트 서버만 테스트 계정을 관리자로 본다)
// 끝나면: node --env-file=.env.local scripts/dev_login_link.mjs --cleanup test-e2e-admin@example.com
// 근거: knowledge-base/concepts/local-admin-login.md

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const cleanup = args[0] === "--cleanup";
const email = (cleanup ? args[1] : args[0])?.trim().toLowerCase();
const port = args[1] ?? "3001";

if (!email?.endsWith("@example.com")) {
  console.error("테스트 계정(@example.com)만 쓴다 — 실제 계정용 로그인 링크는 만들지 않는다.");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const existing = list.users.find((u) => u.email === email);

if (cleanup) {
  if (existing) {
    await db.from("surveys").delete().eq("owner_id", existing.id);
    await db.auth.admin.deleteUser(existing.id);
  }
  await db.from("admins").delete().eq("email", email);
  console.log(`정리함: ${email}`);
  process.exit(0);
}

if (!existing) {
  const { error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
}
await db.from("admins").upsert({ email }).throwOnError();
const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
if (error) throw error;
console.log(`http://localhost:${port}/auth/confirm?type=magiclink&token_hash=${data.properties.hashed_token}`);
