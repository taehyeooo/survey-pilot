import { describe, expect, it } from "vitest";
import { createGuardedAi, generateValid } from "../src/lib/ai";
import { createGuardedMailer } from "../src/lib/mail";
import { LimitExceededError, readLimits } from "../src/lib/usage";
import { createFakeAi, createFakeMailer, createMemoryUsageStore } from "./fakes";

const MINUTE = 60_000;

describe("readLimits", () => {
  it("비어 있으면 보수적인 기본값(5·20·100)", () => {
    expect(readLimits({})).toEqual({ geminiRpm: 5, geminiRpd: 20, mailDaily: 100 });
  });

  it("환경변수 값을 쓴다", () => {
    expect(readLimits({ GEMINI_RPM: "10", GEMINI_RPD: "200", MAIL_DAILY_LIMIT: "400" })).toEqual({
      geminiRpm: 10,
      geminiRpd: 200,
      mailDaily: 400,
    });
  });

  it("숫자가 아니면 시작할 때 실패한다", () => {
    expect(() => readLimits({ GEMINI_RPD: "많이" })).toThrow(/GEMINI_RPD/);
  });
});

describe("AI 호출 한도", () => {
  // survey-pilot#R-27
  it("하루 한도 2면 3번째 호출은 Gemini를 부르지 않고 blocked로 남는다", async () => {
    const store = createMemoryUsageStore();
    const inner = createFakeAi([{ a: 1 }, { a: 2 }, { a: 3 }]);
    const ai = createGuardedAi(inner, store, { rpm: 100, rpd: 2 }, "test");

    await ai.generateJson("1");
    await ai.generateJson("2");
    await expect(ai.generateJson("3")).rejects.toBeInstanceOf(LimitExceededError);

    expect(inner.prompts).toEqual(["1", "2"]);
    expect(store.events.map((e) => e.status)).toEqual(["ok", "ok", "blocked"]);
  });

  // survey-pilot#R-27
  it("분당 한도는 1분이 지나면 풀리고, 남은 시간을 알려 준다", async () => {
    let now = 0;
    const store = createMemoryUsageStore(() => now);
    const ai = createGuardedAi(createFakeAi([1, 2, 3]), store, { rpm: 2, rpd: 100 }, "test", () => now);

    await ai.generateJson("a");
    now = 10_000;
    await ai.generateJson("b");
    now = 20_000;
    const err = await ai.generateJson("c").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LimitExceededError);
    expect((err as LimitExceededError).retryAfterSeconds).toBe(40); // 첫 호출(0초)이 창에서 빠지는 60초까지

    now = MINUTE + 1;
    await expect(ai.generateJson("c")).resolves.toBe(3);
  });

  // survey-pilot#R-27
  it("blocked는 한도에 세지 않는다", async () => {
    let now = 0;
    const store = createMemoryUsageStore(() => now);
    const ai = createGuardedAi(createFakeAi([1, 2]), store, { rpm: 1, rpd: 100 }, "test", () => now);
    await ai.generateJson("a");
    now = 30_000;
    await expect(ai.generateJson("b")).rejects.toBeInstanceOf(LimitExceededError);
    now = MINUTE + 1; // "a"는 창 밖, 30초의 blocked는 창 안 — 세면 또 막힌다
    await expect(ai.generateJson("b")).resolves.toBe(2);
  });

  // survey-pilot#R-27 — 끝난 뒤 기록하면, 호출 중 프로세스가 죽을 때(메모리 부족·함수 시간 초과) 제공자만 센다
  it("부르기 전에 기록한다 — 호출 중에는 error로 이미 한 건, 성공하면 ok로 바뀐다", async () => {
    const store = createMemoryUsageStore();
    let during: string[] = [];
    const inner = {
      async generateJson() {
        during = store.events.map((e) => e.status);
        return { a: 1 };
      },
    };
    await createGuardedAi(inner, store, { rpm: 5, rpd: 20 }, "test").generateJson("x");
    expect(during).toEqual(["error"]);
    expect(store.events.map((e) => e.status)).toEqual(["ok"]);
  });

  // survey-pilot#R-27
  it("하루 한도 1이면 첫 호출이 끝나기 전 두 번째 호출은 막힌다", async () => {
    const store = createMemoryUsageStore();
    let release!: () => void;
    const inner = {
      generateJson: () => new Promise<unknown>((resolve) => (release = () => resolve({ a: 1 }))),
    };
    const ai = createGuardedAi(inner, store, { rpm: 5, rpd: 1 }, "test");
    const first = ai.generateJson("1");
    await new Promise((r) => setTimeout(r, 0)); // 첫 호출이 기록까지 가게
    await expect(ai.generateJson("2")).rejects.toBeInstanceOf(LimitExceededError);
    release();
    await expect(first).resolves.toEqual({ a: 1 });
  });

  // survey-pilot#R-28
  it("Gemini 오류는 error로 남기고 그대로 던진다", async () => {
    const store = createMemoryUsageStore();
    const ai = createGuardedAi(createFakeAi([new Error("503")]), store, { rpm: 5, rpd: 20 }, "test");
    await expect(ai.generateJson("x")).rejects.toThrow("503");
    expect(store.events.map((e) => e.status)).toEqual(["error"]);
  });
});

describe("generateValid", () => {
  const parse = (data: unknown) => {
    if (typeof data !== "object" || data === null || !("ok" in data)) throw new Error("스키마 아님");
    return data as { ok: boolean };
  };

  // survey-pilot#R-28
  it("스키마가 틀리면 한 번만 다시 부른다", async () => {
    const ai = createFakeAi([{ wrong: 1 }, { ok: true }]);
    await expect(generateValid(ai, "p", parse)).resolves.toEqual({ ok: true });
    expect(ai.prompts).toHaveLength(2);
  });

  // survey-pilot#R-28
  it("두 번 다 틀리면 재시도 1회 뒤 실패한다", async () => {
    const ai = createFakeAi([{ wrong: 1 }, { wrong: 2 }, { ok: true }]);
    await expect(generateValid(ai, "p", parse)).rejects.toThrow(/스키마/);
    expect(ai.prompts).toHaveLength(2);
  });

  // survey-pilot#R-28
  it("호출 오류(503 등)는 다시 부르지 않는다 — 재시도는 스키마 실패만", async () => {
    const ai = createFakeAi([new Error("503"), { ok: true }]);
    await expect(generateValid(ai, "p", parse)).rejects.toThrow("503");
    expect(ai.prompts).toHaveLength(1);
  });

  // survey-pilot#R-28
  it("한도 초과는 다시 부르지 않는다", async () => {
    const store = createMemoryUsageStore();
    const ai = createGuardedAi(createFakeAi([{ wrong: 1 }, { ok: true }]), store, { rpm: 5, rpd: 1 }, "test");
    await expect(generateValid(ai, "p", parse)).rejects.toBeInstanceOf(LimitExceededError);
    expect(store.events.map((e) => e.status)).toEqual(["ok", "blocked"]);
  });
});

describe("메일 발송 한도", () => {
  // survey-pilot#R-29
  it("하루 한도 1이면 두 번째 발송은 보내지 않는다", async () => {
    const store = createMemoryUsageStore();
    const inner = createFakeMailer();
    const mailer = createGuardedMailer(inner, store, 1);
    const mail = { to: "a@example.com", subject: "인증번호", text: "123456" };

    await mailer.send(mail);
    await expect(mailer.send(mail)).rejects.toBeInstanceOf(LimitExceededError);
    expect(inner.sent).toHaveLength(1);
    expect(store.events.map((e) => [e.kind, e.status])).toEqual([
      ["mail", "ok"],
      ["mail", "blocked"],
    ]);
  });

  // survey-pilot#R-29
  it("AI 사용량은 메일 한도에 세지 않는다", async () => {
    const store = createMemoryUsageStore();
    const ai = createGuardedAi(createFakeAi([1]), store, { rpm: 5, rpd: 5 }, "test");
    await ai.generateJson("x");
    const mailer = createGuardedMailer(createFakeMailer(), store, 1);
    await expect(mailer.send({ to: "a@example.com", subject: "s", text: "t" })).resolves.toBeUndefined();
  });
});
