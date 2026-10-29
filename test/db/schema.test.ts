import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// 실제 Supabase 프로젝트에 대고 스키마·RLS를 확인한다. 키가 없으면(CI) 건너뛴다.
// 만든 사용자·설문은 끝나면 지운다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasDb = Boolean(url && anonKey && secretKey);

const TABLES = [
  "admins",
  "surveys",
  "hypotheses",
  "questions",
  "verifications",
  "respondents",
  "responses",
  "answers",
  "reports",
  "usage_events",
  "audit_logs",
];

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const run = randomUUID().slice(0, 8);

describe.skipIf(!hasDb)("DB 스키마와 접근 권한", () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let admin: SupabaseClient;
  let stranger: SupabaseClient;
  let adminId: string;
  const userIds: string[] = [];

  async function signedIn(email: string) {
    const password = randomUUID();
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userIds.push(data.user.id);
    const client = createClient(url!, anonKey!, noSession);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    return { client, id: data.user.id };
  }

  async function publishedSurveyWithResponse() {
    const { data: survey } = await service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug: `t-${randomUUID()}` })
      .select()
      .single()
      .throwOnError();
    const { data: question } = await service
      .from("questions")
      .insert({ survey_id: survey.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "a", label: "1번" }, { id: "b", label: "2번" }] })
      .select()
      .single()
      .throwOnError();
    const { data: respondent } = await service
      .from("respondents")
      .insert({ survey_id: survey.id, email_hash: `h-${randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    await service.from("responses").insert({ survey_id: survey.id, respondent_id: respondent.id }).throwOnError();
    return { survey, question, respondent };
  }

  beforeAll(async () => {
    service = createClient(url!, secretKey!, noSession);
    anon = createClient(url!, anonKey!, noSession);
    const adminEmail = `test-admin-${run}@example.com`;
    ({ client: admin, id: adminId } = await signedIn(adminEmail));
    ({ client: stranger } = await signedIn(`test-stranger-${run}@example.com`));
    await service.from("admins").insert({ email: adminEmail }).throwOnError();
    // 테이블이 비어 있으면 "읽지 못한다"가 빈 결과로 우연히 통과하므로 행을 먼저 만든다.
    await publishedSurveyWithResponse();
  });

  afterAll(async () => {
    if (!service) return;
    await service.from("surveys").delete().in("owner_id", userIds);
    await service.from("admins").delete().like("email", `%-${run}@example.com`);
    for (const id of userIds) await service.auth.admin.deleteUser(id);
  });

  // survey-pilot#R-31
  it.each(TABLES)("anon은 %s를 읽지도 쓰지도 못한다", async (table) => {
    const read = await anon.from(table).select("*").limit(1);
    expect(read.error !== null || read.data?.length === 0).toBe(true);
    const write = await anon.from(table).insert({});
    expect(write.error).not.toBeNull();
  });

  // survey-pilot#R-31 — 관리자가 아닌 로그인 사용자도 막힌다(누구나 가입할 수 있으므로).
  it("관리자가 아니면 설문을 만들지도 남의 설문을 보지도 못한다", async () => {
    await publishedSurveyWithResponse();
    const strangerId = userIds[1];
    const insert = await stranger.from("surveys").insert({ owner_id: strangerId, problem: "관리자가 아닌 사람의 설문" });
    expect(insert.error).not.toBeNull();
    const { data } = await stranger.from("surveys").select("id");
    expect(data).toEqual([]);
  });

  // survey-pilot#R-31
  it("관리자는 자기 설문과 하위 행을 읽고, 설문을 만들 수 있지만 지우지는 못한다", async () => {
    const { survey } = await publishedSurveyWithResponse();
    const { data: own } = await admin.from("surveys").select("id").eq("id", survey.id);
    expect(own).toHaveLength(1);
    const { data: questions } = await admin.from("questions").select("id").eq("survey_id", survey.id);
    expect(questions).toHaveLength(1);

    const created = await admin.from("surveys").insert({ owner_id: adminId, problem: "관리자가 만든 새 문제 정의" }).select().single();
    expect(created.error).toBeNull();

    await admin.from("surveys").delete().eq("id", survey.id);
    const { data: still } = await service.from("surveys").select("id").eq("id", survey.id);
    expect(still).toHaveLength(1);

    const childWrite = await admin.from("questions").insert({ survey_id: survey.id, position: 9, type: "text", prompt: "관리자가 직접 쓰기" });
    expect(childWrite.error).not.toBeNull();
  });

  // survey-pilot#R-14
  it("응답이 1건 이상이면 문항·가설·설계 칸은 고칠 수 없고 소개글·마감일·목표 응답 수는 고칠 수 있다", async () => {
    const { survey, question } = await publishedSurveyWithResponse();

    const editQuestion = await service.from("questions").update({ prompt: "바꾼 문항" }).eq("id", question.id);
    expect(editQuestion.error?.message).toMatch(/응답/);
    const addQuestion = await service.from("questions").insert({ survey_id: survey.id, position: 2, type: "text", prompt: "새 문항" });
    expect(addQuestion.error?.message).toMatch(/응답/);
    const addHypothesis = await service.from("hypotheses").insert({ survey_id: survey.id, position: 1, statement: "새 가설" });
    expect(addHypothesis.error?.message).toMatch(/응답/);
    const editPurpose = await service.from("surveys").update({ purpose: "바꾼 목적" }).eq("id", survey.id);
    expect(editPurpose.error?.message).toMatch(/응답/);

    const editAllowed = await service
      .from("surveys")
      .update({ intro: "바꾼 소개글", closes_at: new Date(Date.now() + 86_400_000).toISOString(), target_responses: 50 })
      .eq("id", survey.id);
    expect(editAllowed.error).toBeNull();
  });

  // survey-pilot#R-14
  it("응답이 없으면 문항을 고칠 수 있다", async () => {
    const { data: survey } = await service.from("surveys").insert({ owner_id: adminId, problem: "응답이 아직 없는 설문" }).select().single().throwOnError();
    await service.from("questions").insert({ survey_id: survey.id, position: 1, type: "text", prompt: "처음 문항" }).throwOnError();
    const edit = await service.from("questions").update({ prompt: "고친 문항" }).eq("survey_id", survey.id);
    expect(edit.error).toBeNull();
  });

  it("상태는 앞으로만 간다", async () => {
    const { survey } = await publishedSurveyWithResponse();
    const back = await service.from("surveys").update({ status: "designing", slug: null }).eq("id", survey.id);
    expect(back.error).not.toBeNull();
  });

  // survey-pilot#R-19 — 같은 설문에 같은 이메일 해시는 한 번만
  it("같은 설문에 같은 이메일 해시로 두 번 응답자가 될 수 없다", async () => {
    const { survey, respondent } = await publishedSurveyWithResponse();
    const again = await service.from("respondents").insert({
      survey_id: survey.id,
      email_hash: respondent.email_hash,
      consented_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
    });
    expect(again.error?.code).toBe("23505");
  });
});
