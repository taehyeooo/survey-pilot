import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { archiveSurvey, groupByTab, listSurveys, restoreSurvey } from "../../src/lib/surveys";
import { hasDb, testUsers, type Db } from "./helpers";

describe.skipIf(!hasDb)("설문 목록·보관 (실제 DB, 관리자 세션)", () => {
  let users: ReturnType<typeof testUsers>;
  let admin: Db;
  let stranger: Db;
  let adminId: string;
  let strangerId: string;

  async function survey(fields: Record<string, unknown>) {
    const { data } = await users.service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", ...fields })
      .select()
      .single()
      .throwOnError();
    return data;
  }
  const published = () => survey({ status: "published", slug: `t-${crypto.randomUUID()}` });

  beforeAll(async () => {
    users = testUsers();
    ({ client: admin, id: adminId } = await users.signIn("admin", { admin: true }));
    ({ client: stranger, id: strangerId } = await users.signIn("stranger"));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-2
  it("탭별 개수가 DB와 같고, 응답 수를 함께 읽는다", async () => {
    await survey({});
    await survey({ status: "reviewing" });
    const live = await published();
    await survey({ archived_at: new Date().toISOString() });
    const { data: respondent } = await users.service
      .from("respondents")
      .insert({ survey_id: live.id, email_hash: `h-${crypto.randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select()
      .single()
      .throwOnError();
    await users.service.from("responses").insert({ survey_id: live.id, respondent_id: respondent.id }).throwOnError();

    const rows = await listSurveys(admin, adminId);
    const { data: direct } = await users.service.from("surveys").select("status, archived_at").eq("owner_id", adminId);
    const count = (g: Record<string, unknown[]>) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length]));
    expect(count(groupByTab(rows))).toEqual(count(groupByTab(direct!)));
    expect(rows.find((r) => r.id === live.id)?.responseCount).toBe(1);
  });

  // survey-pilot#R-5
  it("진행 중 설문을 보관하면 마감(archive)되고, 복원해도 마감 상태다", async () => {
    const s = await published();
    await archiveSurvey(users.service, adminId, s.id);
    let { data } = await users.service.from("surveys").select("*").eq("id", s.id).single();
    expect(data).toMatchObject({ status: "closed", close_reason: "archive" });
    expect(data.archived_at).not.toBeNull();
    expect(data.closed_at).not.toBeNull();

    await restoreSurvey(users.service, adminId, s.id);
    ({ data } = await users.service.from("surveys").select("*").eq("id", s.id).single());
    expect(data).toMatchObject({ status: "closed", archived_at: null });
  });

  // survey-pilot#R-5
  it("설계 중 설문은 보관해도 상태가 그대로이고, 복원하면 설계 중으로 돌아온다", async () => {
    const s = await survey({});
    await archiveSurvey(users.service, adminId, s.id);
    let { data } = await users.service.from("surveys").select("*").eq("id", s.id).single();
    expect(data).toMatchObject({ status: "designing", closed_at: null });
    expect(data.archived_at).not.toBeNull();
    await restoreSurvey(users.service, adminId, s.id);
    ({ data } = await users.service.from("surveys").select("*").eq("id", s.id).single());
    expect(data).toMatchObject({ status: "designing", archived_at: null });
  });

  // survey-pilot#R-1, multi-user#R-3
  it("다른 사용자의 세션은 남의 설문이 목록에 없고 보관할 수 없다", async () => {
    const s = await published();
    expect(await listSurveys(stranger, strangerId)).toEqual([]);
    expect(await listSurveys(users.service, strangerId)).toEqual([]); // RLS를 건너뛰는 클라이언트여도 주인 조건으로 막힌다
    await expect(archiveSurvey(users.service, strangerId, s.id)).rejects.toThrow(/찾을 수 없/);
    await expect(restoreSurvey(users.service, strangerId, s.id)).rejects.toThrow(/찾을 수 없/);
    const { data } = await users.service.from("surveys").select("archived_at").eq("id", s.id).single();
    expect(data!.archived_at).toBeNull();
  });
});
