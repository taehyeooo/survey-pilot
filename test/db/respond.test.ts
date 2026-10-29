import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createGuardedMailer } from "../../src/lib/mail";
import { readToken, requestCode, RespondError, verifyCode, type OpenSurvey } from "../../src/lib/respond";
import { createFakeMailer, createMemoryUsageStore } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const secret = "test-secret";
const MIN = 60_000;

describe.skipIf(!hasDb)("응답자 동의·인증번호 (실제 DB, 가짜 메일)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let adminId: string;
  let ipSeq = 0;

  async function openSurvey(fields: Record<string, unknown> = {}): Promise<OpenSurvey> {
    const { data } = await service
      .from("surveys")
      .insert({
        owner_id: adminId,
        problem: "스터디 출석률이 왜 떨어질까",
        status: "published",
        slug: `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`,
        closes_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        ...fields,
      })
      .select("id, status, archived_at, closes_at")
      .single()
      .throwOnError();
    return data;
  }
  const ip = () => `10.0.0.${++ipSeq}`;
  const base = (survey: OpenSurvey, email = `r${crypto.randomUUID().slice(0, 6)}@example.com`) => ({ survey, email, consent: true, honeypot: "", ip: ip() });
  const codeIn = (mailer: ReturnType<typeof createFakeMailer>) => mailer.sent.at(-1)!.text.match(/\d{6}/)![0];
  const count = async (table: string, surveyId: string) =>
    (await service.from(table).select("id", { count: "exact", head: true }).eq("survey_id", surveyId)).count;

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: adminId } = await users.signIn("admin", { admin: true }));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-3
  it("동의하지 않으면 인증번호를 보내지 않는다", async () => {
    const survey = await openSurvey();
    const mailer = createFakeMailer();
    await expect(requestCode(service, mailer, secret, { ...base(survey), consent: false })).rejects.toMatchObject({ code: "consent" });
    expect(mailer.sent).toHaveLength(0);
    expect(await count("verifications", survey.id)).toBe(0);
  });

  // survey-pilot#R-4
  it("숨은 칸에 값이 있으면 저장·발송 없이 성공처럼 돌려준다", async () => {
    const survey = await openSurvey();
    const mailer = createFakeMailer();
    await expect(requestCode(service, mailer, secret, { ...base(survey), honeypot: "bot" })).resolves.toBe("ignored");
    expect(mailer.sent).toHaveLength(0);
    expect(await count("verifications", survey.id)).toBe(0);
  });

  // survey-pilot#R-4
  it("같은 IP에서 1시간에 인증번호 요청 5회까지", async () => {
    const survey = await openSurvey();
    const mailer = createFakeMailer();
    const sameIp = ip();
    for (let i = 0; i < 5; i++) await requestCode(service, mailer, secret, { ...base(survey), ip: sameIp });
    await expect(requestCode(service, mailer, secret, { ...base(survey), ip: sameIp })).rejects.toMatchObject({ code: "ip" });
    expect(mailer.sent).toHaveLength(5);
  });

  // survey-pilot#R-20
  it("마감됐거나 보관된 설문은 인증번호를 보내지 않는다", async () => {
    const mailer = createFakeMailer();
    const closed = await openSurvey({ status: "closed", closed_at: new Date().toISOString(), close_reason: "manual" });
    await expect(requestCode(service, mailer, secret, base(closed))).rejects.toMatchObject({ code: "closed" });
    const past = await openSurvey({ closes_at: new Date(Date.now() - MIN).toISOString() });
    await expect(requestCode(service, mailer, secret, base(past))).rejects.toMatchObject({ code: "closed" });
    expect(mailer.sent).toHaveLength(0);
  });

  // survey-pilot#R-18
  it("60초 안에는 다시 보내지 않고, 맞는 번호를 넣으면 응답자가 생기고 30분 토큰을 준다", async () => {
    const survey = await openSurvey();
    const mailer = createFakeMailer();
    const input = base(survey);
    const t0 = Date.now();
    await requestCode(service, mailer, secret, input, t0);
    await expect(requestCode(service, mailer, secret, input, t0 + 59_000)).rejects.toMatchObject({ code: "wait" });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe(input.email);

    const token = await verifyCode(service, secret, { survey, email: input.email.toUpperCase(), code: codeIn(mailer) }, t0 + MIN);
    const respondentId = readToken(secret, token, t0 + MIN);
    const { data } = await service.from("respondents").select("id, email, survey_id").eq("id", respondentId!).single();
    expect(data).toMatchObject({ survey_id: survey.id, email: input.email });
  });

  // survey-pilot#R-18
  it("10분이 지나면 만료, 5번 틀리면 맞는 번호도 거부", async () => {
    const survey = await openSurvey();
    const mailer = createFakeMailer();
    const input = base(survey);
    const t0 = Date.now();
    await requestCode(service, mailer, secret, input, t0);
    const code = codeIn(mailer);
    await expect(verifyCode(service, secret, { survey, email: input.email, code }, t0 + 11 * MIN)).rejects.toMatchObject({ code: "expired" });

    const other = base(survey);
    await requestCode(service, mailer, secret, other, t0);
    const right = codeIn(mailer);
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      await expect(verifyCode(service, secret, { survey, email: other.email, code: wrong }, t0 + MIN)).rejects.toBeInstanceOf(RespondError);
    }
    await expect(verifyCode(service, secret, { survey, email: other.email, code: right }, t0 + MIN)).rejects.toMatchObject({ code: "locked" });
  });

  // survey-pilot#R-18
  it("이미 응답한 이메일이면 메일을 보내지 않는다", async () => {
    const survey = await openSurvey();
    const mailer = createFakeMailer();
    const input = base(survey);
    await requestCode(service, mailer, secret, input);
    const token = await verifyCode(service, secret, { survey, email: input.email, code: codeIn(mailer) });
    await service.from("responses").insert({ survey_id: survey.id, respondent_id: readToken(secret, token, Date.now()) }).throwOnError();
    await expect(requestCode(service, mailer, secret, { ...input, ip: ip() }, Date.now() + 2 * MIN)).rejects.toMatchObject({ code: "done" });
    expect(mailer.sent).toHaveLength(1);
  });

  // survey-pilot#R-29
  it("메일 하루 한도에 닿으면 인증번호를 보내지 않는다", async () => {
    const survey = await openSurvey();
    const inner = createFakeMailer();
    const mailer = createGuardedMailer(inner, createMemoryUsageStore(), 1);
    await requestCode(service, mailer, secret, base(survey));
    await expect(requestCode(service, mailer, secret, base(survey))).rejects.toMatchObject({ name: "LimitExceededError" });
    expect(inner.sent).toHaveLength(1);
  });
});
