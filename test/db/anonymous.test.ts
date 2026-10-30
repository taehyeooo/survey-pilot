import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findPublicSurvey, setRequireEmail } from "../../src/lib/publish";
import { requestCode, startAnonymous } from "../../src/lib/respond";
import { submitResponse } from "../../src/lib/submit";
import { createFakeMailer } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const secret = "test-secret";

// 설문마다 응답 방식(ADR 0017 v2): 기본은 이메일 없이 바로, "한 사람 한 번만"을 켜면 이메일 인증.
describe.skipIf(!hasDb)("이메일 없이 바로 응답 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let ownerId: string;
  let ipSeq = 0;
  const ip = () => `10.7.0.${++ipSeq}`;

  async function liveSurvey(fields: Record<string, unknown> = {}) {
    const slug = `t${randomUUID().replace(/-/g, "").slice(0, 11)}`;
    const { data: s } = await service
      .from("surveys")
      .insert({ owner_id: ownerId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug, target_responses: 50, closes_at: new Date(Date.now() + 864e5).toISOString(), ...fields })
      .select("id")
      .single()
      .throwOnError();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: s.id, position: 1, type: "scale", prompt: "만족하나요?", options: [], required: true })
      .select("id")
      .single()
      .throwOnError();
    return { id: s.id as string, slug, raw: { [q.id]: ["4"] } };
  }
  const open = async (slug: string) => (await findPublicSurvey(service, slug))!;
  const start = async (slug: string, clientId: string, extra: { consent?: boolean; honeypot?: string } = {}) =>
    startAnonymous(service, secret, { survey: await open(slug), clientId, consent: extra.consent ?? true, honeypot: extra.honeypot ?? "", ip: ip() });

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: ownerId } = await users.signIn("anon-owner"));
  });
  afterAll(async () => users?.cleanup());

  // survey-pilot#R-19 — 새 설문은 바로 응답, 같은 브라우저는 한 번만
  it("새 설문은 이메일 없이 동의만으로 응답하고, 같은 브라우저 표시로는 두 번 못 낸다", async () => {
    const s = await liveSurvey();
    expect((await open(s.slug)).require_email).toBe(false);
    const browser = randomUUID();
    const token = await start(s.slug, browser);
    await expect(submitResponse(service, secret, { survey: await open(s.slug), token: token!, raw: s.raw, ip: ip() })).resolves.toBe("ok");
    await expect(start(s.slug, browser)).rejects.toMatchObject({ code: "done" });
    const other = await start(s.slug, randomUUID());
    await expect(submitResponse(service, secret, { survey: await open(s.slug), token: other!, raw: s.raw, ip: ip() })).resolves.toBe("ok");
    const { data } = await service.from("respondents").select("via, email").eq("survey_id", s.id);
    expect(data).toEqual([
      { via: "browser", email: null },
      { via: "browser", email: null },
    ]);
  });

  // survey-pilot#R-3 — 동의 없이는 받지 않고, 봇에게는 성공처럼(토큰 없음)
  it("동의가 없으면 거부, 숨은 칸을 채운 봇에게는 토큰을 주지 않는다", async () => {
    const s = await liveSurvey();
    await expect(start(s.slug, randomUUID(), { consent: false })).rejects.toMatchObject({ code: "consent" });
    expect(await start(s.slug, randomUUID(), { honeypot: "spam" })).toBeNull();
    expect((await service.from("respondents").select("id").eq("survey_id", s.id)).data).toEqual([]);
  });

  // survey-pilot#R-18 — "한 사람 한 번만"을 켠 설문은 이메일 인증만
  it("한 사람 한 번만을 켜면 바로 응답은 거부하고 이메일 인증을 받는다", async () => {
    const s = await liveSurvey();
    await setRequireEmail(service, { id: s.id, status: "published" }, true);
    const survey = await open(s.slug);
    expect(survey.require_email).toBe(true);
    await expect(start(s.slug, randomUUID())).rejects.toMatchObject({ code: "email" });
    const mailer = createFakeMailer();
    await requestCode(service, mailer, secret, { survey, email: "r@example.com", consent: true, honeypot: "", ip: ip() });
    expect(mailer.sent).toHaveLength(1);
  });

  // survey-pilot#R-18 — 바로 응답 설문에는 인증번호를 보내지 않는다
  it("바로 응답 설문에 인증번호 요청은 거부(메일을 쓰지 않는다)", async () => {
    const s = await liveSurvey();
    const mailer = createFakeMailer();
    await expect(requestCode(service, mailer, secret, { survey: await open(s.slug), email: "r@example.com", consent: true, honeypot: "", ip: ip() })).rejects.toMatchObject({
      code: "email",
    });
    expect(mailer.sent).toEqual([]);
  });

  // multi-user#R-8 — 정지·내린 설문은 바로 응답도 닫힌다
  it("내린 설문은 바로 응답도 거부", async () => {
    const s = await liveSurvey({ taken_down_at: new Date().toISOString(), takedown_reason: "테스트" });
    await expect(start(s.slug, randomUUID())).rejects.toMatchObject({ code: "closed" });
  });

  // survey-pilot#R-14 — 응답 방식은 게시 전·진행 중에만 바꾼다
  it("마감된 설문은 응답 방식을 바꿀 수 없다", async () => {
    const s = await liveSurvey({ status: "closed", closed_at: new Date().toISOString(), close_reason: "manual" });
    await expect(setRequireEmail(service, { id: s.id, status: "closed" }, true)).rejects.toThrow(/마감/);
  });
});
