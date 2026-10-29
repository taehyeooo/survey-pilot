import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "../../src/lib/design";
import {
  addQuestion,
  CLOSING_PROMPT,
  deleteQuestion,
  generateQuestions,
  moveQuestion,
  regenerateQuestion,
  updateQuestion,
  type QuestionSurvey,
} from "../../src/lib/questions";
import { createFakeAi } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const single = (hypothesis: number | null, prompt: string) => ({ hypothesis, type: "single", prompt, options: ["예", "아니요"], required: true });

describe.skipIf(!hasDb)("문항 생성·점검·편집 (실제 DB, 가짜 AI)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;

  async function reviewingSurvey(targetMinutes = 3): Promise<QuestionSurvey> {
    const { data } = await service
      .from("surveys")
      .insert({ owner_id: adminId, problem: "스터디 출석률이 왜 떨어질까", status: "reviewing", purpose: "원인 찾기", audience: "회원", target_responses: 20, target_minutes: targetMinutes })
      .select("id, status, problem, purpose, audience, target_minutes")
      .single()
      .throwOnError();
    await service
      .from("hypotheses")
      .insert([
        { survey_id: data.id, position: 1, statement: "시간이 안 맞는다" },
        { survey_id: data.id, position: 2, statement: "내용이 어렵다" },
      ])
      .throwOnError();
    return data;
  }
  const questions = async (id: string) =>
    (await service.from("questions").select("id, position, prompt, type, required, review_note, hypothesis_id, options").eq("survey_id", id).order("position")).data!;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-10 survey-pilot#R-11
  it("생성 1번 + 점검 1번으로 저장하고, 가설마다 1개 이상, 마지막은 고정 주관식, 고친 이유를 남긴다", async () => {
    const survey = await reviewingSurvey();
    const generated = { questions: [single(1, "저녁 시간이 좋지 않죠?"), single(2, "교재가 어렵나요?")] };
    const reviewed = {
      questions: [
        { ...single(1, "모임 시간이 본인 일정과 맞나요?"), review_note: "유도 질문을 중립으로 바꿈" },
        { ...single(2, "교재 난이도는 어떤가요?"), review_note: null },
      ],
    };
    const ai = createFakeAi([generated, reviewed]);
    await generateQuestions(service, ai, survey);

    expect(ai.prompts).toHaveLength(2);
    const saved = await questions(survey.id);
    expect(saved.map((q) => q.prompt)).toEqual(["모임 시간이 본인 일정과 맞나요?", "교재 난이도는 어떤가요?", CLOSING_PROMPT]);
    expect(saved[0].review_note).toBe("유도 질문을 중립으로 바꿈");
    expect(saved.at(-1)).toMatchObject({ type: "text", required: false, hypothesis_id: null });
    expect(new Set(saved.filter((q) => q.hypothesis_id).map((q) => q.hypothesis_id)).size).toBe(2);
  });

  // survey-pilot#R-10
  it("설계 확인 전(designing)에는 문항을 만들지 않는다", async () => {
    const survey = await reviewingSurvey();
    await expect(generateQuestions(service, createFakeAi([]), { ...survey, status: "designing" })).rejects.toBeInstanceOf(ConflictError);
  });

  // survey-pilot#R-12
  it("저장 전에 목표 시간 안으로 줄인다", async () => {
    const survey = await reviewingSurvey(1);
    const many = { questions: [single(1, "1a"), single(1, "1b"), single(1, "1c"), single(1, "1d"), single(2, "2a"), single(null, "기타")] };
    await generateQuestions(service, createFakeAi([many, many]), survey);
    // 7*6 + 30 = 72초 > 60초 → "기타", 그다음 1d 를 뺀다
    expect((await questions(survey.id)).map((q) => q.prompt)).toEqual(["1a", "1b", "1c", "2a", CLOSING_PROMPT]);
  });

  // survey-pilot#R-13
  it("수정·순서 바꾸기·추가·삭제·한 문항 다시 만들기, 고정 문항은 지우거나 옮기지 못한다", async () => {
    const survey = await reviewingSurvey();
    const set = { questions: [single(1, "첫"), single(2, "둘")] };
    await generateQuestions(service, createFakeAi([set, set]), survey);
    let saved = await questions(survey.id);

    await updateQuestion(service, survey.id, saved[0].id, { prompt: "고친 첫", options: ["가", "나", "다"], required: false });
    saved = await questions(survey.id);
    expect(saved[0]).toMatchObject({ prompt: "고친 첫", required: false, options: [{ id: "o1", label: "가" }, { id: "o2", label: "나" }, { id: "o3", label: "다" }] });

    await moveQuestion(service, survey.id, saved[1].id, -1);
    expect((await questions(survey.id)).map((q) => q.prompt)).toEqual(["둘", "고친 첫", CLOSING_PROMPT]);

    await addQuestion(service, survey.id);
    saved = await questions(survey.id);
    expect(saved.map((q) => q.prompt)).toEqual(["둘", "고친 첫", "새 문항", CLOSING_PROMPT]);

    await deleteQuestion(service, survey.id, saved[2].id);
    const closingId = saved[3].id;
    await expect(deleteQuestion(service, survey.id, closingId)).rejects.toBeInstanceOf(ConflictError);
    await expect(moveQuestion(service, survey.id, closingId, -1)).rejects.toBeInstanceOf(ConflictError);

    saved = await questions(survey.id);
    await regenerateQuestion(service, createFakeAi([{ questions: [single(2, "다시 만든 둘")] }]), survey, saved[0].id);
    expect((await questions(survey.id)).map((q) => q.prompt)).toEqual(["다시 만든 둘", "고친 첫", CLOSING_PROMPT]);
  });
});
