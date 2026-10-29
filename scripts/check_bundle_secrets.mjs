#!/usr/bin/env node
// 클라이언트 번들(.next/static)에 비밀값이 들어갔는지 검사한다(spec R-31, ADR 0019).
// 비밀값 이름은 .env.example에서 NEXT_PUBLIC_이 아닌 것. 값은 실행 환경에서 읽는다(로컬은 .env.local).
// 사용: npm run build && npm run check:bundle

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// 값을 모르는 환경(CI)에서도 잡을 수 있는 비밀값 모양.
const SECRET_SHAPES = [{ name: "Supabase 비밀 키", re: /sb_secret_[A-Za-z0-9_-]+/ }];

export function secretNames(envExample) {
  return envExample
    .split(/\r?\n/)
    .map((line) => line.split("=")[0].trim())
    .filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name) && !name.startsWith("NEXT_PUBLIC_"));
}

// files: [{ path, text }], secrets: [{ name, value }] → 찾은 위치 목록
export function findLeaks(files, secrets) {
  const leaks = [];
  for (const { path, text } of files) {
    for (const { name, value } of secrets) {
      // 너무 짧은 값(예: 한도 숫자 "20")은 우연히 겹치므로 보지 않는다.
      if (value && value.length >= 8 && text.includes(value)) leaks.push(`${path}: ${name} 값`);
    }
    for (const { name, re } of SECRET_SHAPES) {
      if (re.test(text)) leaks.push(`${path}: ${name} 모양`);
    }
  }
  return leaks;
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = join(".next", "static");
  let paths;
  try {
    paths = listFiles(dir);
  } catch {
    console.error(`${dir}가 없다. 먼저 npm run build`);
    process.exit(1);
  }
  const files = paths.map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const secrets = secretNames(readFileSync(".env.example", "utf8")).map((name) => ({ name, value: process.env[name] }));
  const leaks = findLeaks(files, secrets);
  if (leaks.length) {
    console.error(`클라이언트 번들에 비밀값 ${leaks.length}건 (ADR 0019):\n${leaks.join("\n")}`);
    process.exit(1);
  }
  const known = secrets.filter((s) => s.value).length;
  console.log(`클라이언트 번들 비밀값 검사 통과 — 파일 ${files.length}개, 값을 아는 비밀값 ${known}/${secrets.length}개`);
}
