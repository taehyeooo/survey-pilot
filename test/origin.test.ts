import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { originOf } from "../src/lib/origin";

describe("originOf", () => {
  // survey-pilot#R-1 — 로그인 뒤 돌아갈 주소가 사용자가 연 호스트여야 쿠키가 맞는다
  it("Host 헤더를 쓴다(request.url의 호스트가 달라도)", () => {
    const req = new NextRequest("http://localhost:3001/auth/confirm", { headers: { host: "127.0.0.1:3001" } });
    expect(originOf(req)).toBe("http://127.0.0.1:3001");
  });

  it("프록시 뒤면 x-forwarded-host·proto를 쓴다", () => {
    const req = new NextRequest("http://internal:3000/auth/callback", {
      headers: { host: "internal:3000", "x-forwarded-host": "survey.example.com", "x-forwarded-proto": "https" },
    });
    expect(originOf(req)).toBe("https://survey.example.com");
  });
});
