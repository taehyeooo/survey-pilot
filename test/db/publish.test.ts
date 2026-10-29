import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "../../src/lib/design";
import { canEditQuestions, findPublicSurvey, publishSurvey, updateSettings } from "../../src/lib/publish";
import { updateQuestion } from "../../src/lib/questions";
import { hasDb, testUsers, type Db } from "./helpers";

describe.skipIf(!hasDb)("게시·공개 링크·수정 제한 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;

  async function survey(status = "reviewing", withQuestions = true) {
    const { data } = await service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", status, purpose: "원인", audience: "회원", target_responses: 20, target_minutes: 3, intro: "소개", share_message: "3분 설문", closes_at: new Date(Date.now() + 7 * 864e5).toISOString() })
      .select("id, status")
      .single()
      .throwOnError();
    if (withQuestions) {
      await service
        .from("questions")
        .insert([
          // 여러 행을 한 번에 넣을 때 PostgREST는 모든 행의 열을 합친다 — 빠진 열은 null이 되므로 required를 함께 적는다.
          { survey_id: data.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "o1", label: "1번" }, { id: "o2", label: "2번" }], required: true },
          { survey_id: data.id, position: 2, type: "text", prompt: "더 하고 싶은 말이 있다면 자유롭게 적어 주세요.", options: [], required: false },
        ])
        .throwOnError();
    }
    return data as { id: string; status: string };
  }
  const load = async (id: string) => (await service.from("surveys").select("*").eq("id", id).single()).data;
  async function addResponse(id: string) {
    const { data: r } = await service
      .from("respondents")
      .insert({ survey_id: id, email_hash: `h-${crypto.randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select("id")
      .single()
      .throwOnError();
    await service.from("responses").insert({ survey_id: id, respondent_id: r.id }).throwOnError();
  }

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-13
  it("게시 전(reviewing)에는 공개 링크로 찾을 수 없고, 게시하면 slug가 생겨 찾을 수 있다", async () => {
    const s = await survey();
    expect(await findPublicSurvey(service, "아무거나")).toBeNull();
    const slug = await publishSurvey(service, s);
    expect(await load(s.id)).toMatchObject({ status: "published", slug });
    expect((await findPublicSurvey(service, slug))?.id).toBe(s.id);
  });

  // survey-pilot#R-13
  it("설계 확인 전이거나 문항이 없으면 게시하지 않는다", async () => {
    await expect(publishSurvey(service, await survey("designing", false))).rejects.toBeInstanceOf(ConflictError);
    await expect(publishSurvey(service, await survey("reviewing", false))).rejects.toThrow(/문항/);
  });

  // survey-pilot#R-14
  it("게시 후 응답이 0건이면 문항을 고칠 수 있고, 1건 생기면 잠긴다", async () => {
    const s = await survey();
    await publishSurvey(service, s);
    const published = await load(s.id);
    expect(await canEditQuestions(service, published)).toBe(true);
    await addResponse(s.id);
    expect(await canEditQuestions(service, published)).toBe(false);
    const { data: q } = await service.from("questions").select("id").eq("survey_id", s.id).eq("position", 1).single();
    await expect(updateQuestion(service, s.id, q!.id, { prompt: "바꾼 문항", options: ["가", "나"], required: true })).rejects.toThrow();
  });

  // survey-pilot#R-14 survey-pilot#R-15
  it("응답이 있어도 소개글·공유 메시지·마감일·목표 응답 수는 고칠 수 있고, 지난 마감일은 거부한다", async () => {
    const s = await survey();
    await publishSurvey(service, s);
    await addResponse(s.id);
    const closes = new Date(Date.now() + 3 * 864e5);
    await updateSettings(service, await load(s.id), { intro: "바꾼 소개", share_message: "바꾼 메시지", closesAt: closes, targetResponses: 40 });
    expect(await load(s.id)).toMatchObject({ intro: "바꾼 소개", share_message: "바꾼 메시지", target_responses: 40 });
    await expect(
      updateSettings(service, await load(s.id), { intro: "x", share_message: "x", closesAt: new Date(Date.now() - 1000), targetResponses: 40 }),
    ).rejects.toThrow(/마감일/);
  });
});
