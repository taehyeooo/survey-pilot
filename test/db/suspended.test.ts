import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findPublicSurvey } from "../../src/lib/publish";
import { makeToken, requestCode, verifyCode } from "../../src/lib/respond";
import { submitResponse } from "../../src/lib/submit";
import { createFakeMailer } from "../fakes";
import { hasDb, testUsers, type Db } from "./helpers";

const secret = "test-secret";

// 정지된 사용자의 설문은 응답을 받지 않고, 해제되면 다시 받는다(multi-user R-8).
describe.skipIf(!hasDb)("정지된 사용자의 응답 링크 (실제 DB)", () => {
  let users: ReturnType<typeof testUsers>;
  let service: Db;
  let ownerId: string;

  const suspend = (on: boolean) =>
    service
      .from("profiles")
      .update(on ? { suspended_at: new Date().toISOString(), suspend_reason: "테스트" } : { suspended_at: null, suspend_reason: null })
      .eq("id", ownerId)
      .throwOnError();

  beforeAll(async () => {
    users = testUsers();
    service = users.service;
    ({ id: ownerId } = await users.signIn("suspended-owner"));
  });
  afterAll(async () => users?.cleanup());

  // multi-user#R-8
  it("정지 중엔 인증번호·제출을 거부하고, 해제 뒤 제출이 된다", async () => {
    const slug = `t${crypto.randomUUID().replace(/-/g, "").slice(0, 11)}`;
    const { data: s } = await service
      .from("surveys")
      .insert({ owner_id: ownerId, problem: "스터디 출석률이 왜 떨어질까", status: "published", slug, target_responses: 10, closes_at: new Date(Date.now() + 864e5).toISOString() })
      .select("id")
      .single()
      .throwOnError();
    const { data: q } = await service
      .from("questions")
      .insert({ survey_id: s.id, position: 1, type: "single", prompt: "몇 번 왔나요?", options: [{ id: "o1", label: "1번" }, { id: "o2", label: "2번" }], required: true })
      .select("id")
      .single()
      .throwOnError();
    const { data: r } = await service
      .from("respondents")
      .insert({ survey_id: s.id, email_hash: `h-${crypto.randomUUID()}`, consented_at: new Date().toISOString(), verified_at: new Date().toISOString() })
      .select("id")
      .single()
      .throwOnError();
    const token = makeToken(secret, r.id);
    const raw = { [q.id]: ["o1"] };

    expect((await findPublicSurvey(service, slug))!.paused).toBe(false);
    await suspend(true);
    const paused = (await findPublicSurvey(service, slug))!;
    expect(paused.paused).toBe(true);
    const mailer = createFakeMailer();
    await expect(
      requestCode(service, mailer, secret, { survey: paused, email: "someone@example.com", consent: true, honeypot: "", ip: "10.9.0.1" }),
    ).rejects.toMatchObject({ code: "closed", message: "지금은 응답을 받지 않아요." });
    expect(mailer.sent).toEqual([]);
    await expect(verifyCode(service, secret, { survey: paused, email: "someone@example.com", code: "000000" })).rejects.toMatchObject({ code: "closed" });
    await expect(submitResponse(service, secret, { survey: paused, token, raw, ip: "10.9.0.2" })).rejects.toMatchObject({ code: "closed" });

    await suspend(false);
    const reopened = (await findPublicSurvey(service, slug))!;
    expect(reopened.paused).toBe(false);
    await expect(submitResponse(service, secret, { survey: reopened, token, raw, ip: "10.9.0.3" })).resolves.toBe("ok");
  });
});
