import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 운영 페이지의 모든 화면·액션·라우트가 운영자 확인을 먼저 부르는지 전수 검사(multi-user R-10, ADR 0012).
// 레이아웃 확인만으로는 페이지·액션이 따로 실행될 때 막지 못한다.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("운영 페이지 전수 확인", () => {
  const entries = files("src/app/ops").filter((f) => /(page|route)\.tsx?$|actions\.ts$/.test(f));

  // multi-user#R-10
  it("운영 페이지에 화면이 있다", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  // multi-user#R-10
  it.each(entries)("%s — 내보내는 함수마다 requireOperator를 부른다", (file) => {
    const source = readFileSync(file, "utf8");
    const exported = source.split(/\nexport (?:default )?(?:async )?function /).slice(1);
    expect(exported.length).toBeGreaterThan(0);
    for (const body of exported) {
      const name = body.slice(0, body.indexOf("("));
      const fn = body.split(/\n}\n/)[0];
      // 화면은 Suspense 안 데이터 컴포넌트가 부를 수 있다 — 같은 파일 어딘가에서 부르면 된다
      const guarded = /actions\.ts$|route\.tsx?$/.test(file) ? /await requireOperator\(\)/.test(fn) : /await requireOperator\(\)/.test(source);
      expect(guarded, `${file} ${name}`).toBe(true);
    }
  });
});
