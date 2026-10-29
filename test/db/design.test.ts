import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  answerClarifications,
  ConflictError,
  confirmDesign,
  createSurvey,
  runClarify,
  runDesign,
  type SurveyRow,
} from "../../src/lib/design";
import { createFakeAi } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const design = {
  purpose: "출석률이 떨어진 이유를 찾는다",
  hypotheses: ["시간이 안 맞는다", "내용이 어렵다", "동기가 약해졌다"],
  audience: "스터디 회원",
  target_responses: 20,
  target_minutes: 3,
  intro: "스터디를 더 좋게 만들려고 해요.",
  share_message: "3분짜리 설문이에요.",
};

describe.skipIf(!hasDb)("문제 입력 → 되묻기 → 설계 → 확인 (실제 DB, 가짜 AI)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;

  async function load(id: string): Promise<SurveyRow> {
    const { data } = await service.from("surveys").select("*").eq("id", id).single().throwOnError();
    return data;
  }
  const hypotheses = async (id: string) =>
    (await service.from("hypotheses").select("position, statement").eq("survey_id", id).order("position")).data!;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-6
  it("문제를 한 번 입력하면 설계 중 설문 1건이 생긴다", async () => {
    const id = await createSurvey(service, adminId, "  스터디 출석률이 왜 떨어질까  ");
    const { count } = await service.from("surveys").select("id", { count: "exact", head: true }).eq("owner_id", adminId).eq("id", id);
    expect(count).toBe(1);
    expect(await load(id)).toMatchObject({ status: "designing", problem: "스터디 출석률이 왜 떨어질까", purpose: null });
  });

  // survey-pilot#R-7
  it("되묻기가 있으면 질문만 저장하고, 답하면 답이 저장된다", async () => {
    const id = await createSurvey(service, adminId, "출석률이 떨어지는 이유가 궁금해요");
    const ai = createFakeAi([{ questions: [{ question: "누구의 출석률인가요?", options: ["스터디 회원", "수업 학생"] }] }]);
    const asked = await runClarify(service, ai, await load(id));
    expect(asked).toHaveLength(1);
    expect((await load(id)).clarifications).toEqual([{ question: "누구의 출석률인가요?", options: ["스터디 회원", "수업 학생"], answer: null }]);

    await answerClarifications(service, await load(id), ["스터디 회원"]);
    expect((await load(id)).clarifications[0].answer).toBe("스터디 회원");
  });

  // survey-pilot#R-7
  it("빠진 게 없으면 묻지 않는다", async () => {
    const id = await createSurvey(service, adminId, "주 2회 저녁 스터디 회원들의 출석률이 3개월째 떨어지는 이유");
    expect(await runClarify(service, createFakeAi([{ questions: [] }]), await load(id))).toEqual([]);
    expect((await load(id)).clarifications).toEqual([]);
  });

  // survey-pilot#R-8
  it("설계 제안을 저장하고, 다시 제안받으면 가설을 바꿔 끼운다(중복 없음)", async () => {
    const id = await createSurvey(service, adminId, "스터디 출석률이 왜 떨어질까");
    const ai = createFakeAi([design, { ...design, hypotheses: ["새 가설 1", "새 가설 2"] }]);
    await runDesign(service, ai, await load(id));
    const saved = await load(id);
    expect(saved).toMatchObject({ purpose: design.purpose, audience: design.audience, target_responses: 20, target_minutes: 3, status: "designing" });
    expect(saved.closes_at).not.toBeNull();
    expect((await hypotheses(id)).map((h) => h.statement)).toEqual(design.hypotheses);

    await runDesign(service, ai, await load(id));
    expect(await hypotheses(id)).toEqual([
      { position: 1, statement: "새 가설 1" },
      { position: 2, statement: "새 가설 2" },
    ]);
  });

  // survey-pilot#R-9
  it("설계가 있어야 확인되고, 확인하면 검토(reviewing)로 넘어간다", async () => {
    const id = await createSurvey(service, adminId, "스터디 출석률이 왜 떨어질까");
    await expect(confirmDesign(service, await load(id))).rejects.toBeInstanceOf(ConflictError);
    await runDesign(service, createFakeAi([design]), await load(id));
    await confirmDesign(service, await load(id));
    expect((await load(id)).status).toBe("reviewing");
  });

  // survey-pilot#R-28
  it("AI 오류·잘못된 출력이면 설문 상태와 입력이 그대로다", async () => {
    const id = await createSurvey(service, adminId, "스터디 출석률이 왜 떨어질까");
    await expect(runDesign(service, createFakeAi([new Error("Gemini 503")]), await load(id))).rejects.toThrow("503");

    const bad = createFakeAi([{ purpose: "가설 없음" }, "JSON 아님"]);
    await expect(runDesign(service, bad, await load(id))).rejects.toThrow();
    expect(bad.prompts).toHaveLength(2); // 스키마 실패는 1번만 다시

    expect(await load(id)).toMatchObject({ status: "designing", problem: "스터디 출석률이 왜 떨어질까", purpose: null });
    expect(await hypotheses(id)).toEqual([]);
  });
});
