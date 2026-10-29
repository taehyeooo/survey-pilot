import type { SupabaseClient } from "@supabase/supabase-js";

// 진행 현황(R-21)·문항별 집계(R-22)·CSV(R-25). AI 없이 저장된 답만으로 계산한다.
// db는 관리자 세션(RLS) 클라이언트 — 자기 설문의 응답만 읽힌다(ADR 0019).

export interface ResultQuestion {
  id: string;
  position: number;
  type: "single" | "multi" | "scale" | "text";
  prompt: string;
  options: { id: string; label: string }[];
}

export interface ResultAnswer {
  response_id: string;
  question_id: string;
  value: unknown;
}

export type QuestionStat =
  | { kind: "choice"; question: ResultQuestion; answered: number; options: { id: string; label: string; count: number; ratio: number }[] }
  | { kind: "scale"; question: ResultQuestion; answered: number; mean: number | null; distribution: number[] }
  | { kind: "text"; question: ResultQuestion; answered: number; texts: string[] };

// 비율의 분모는 그 문항에 답한 사람 수 — 여러 개 고르기는 합이 100%를 넘을 수 있다(R-22).
export function aggregate(questions: ResultQuestion[], answers: ResultAnswer[]): QuestionStat[] {
  return questions.map((question) => {
    const values = answers.filter((a) => a.question_id === question.id).map((a) => a.value);
    const answered = values.length;
    if (question.type === "scale") {
      const numbers = values.map(Number).filter((n) => n >= 1 && n <= 5);
      const distribution = [1, 2, 3, 4, 5].map((n) => numbers.filter((x) => x === n).length);
      const mean = numbers.length ? Math.round((numbers.reduce((s, n) => s + n, 0) / numbers.length) * 10) / 10 : null;
      return { kind: "scale", question, answered, mean, distribution };
    }
    if (question.type === "text") {
      return { kind: "text", question, answered, texts: values.map(String) };
    }
    const chosen = values.map((v) => (Array.isArray(v) ? v.map(String) : []));
    const options = question.options.map((o) => {
      const count = chosen.filter((ids) => ids.includes(o.id)).length;
      return { ...o, count, ratio: answered ? count / answered : 0 };
    });
    return { kind: "choice", question, answered, options };
  });
}

const KST_MS = 9 * 60 * 60 * 1000;
const kst = (iso: string) => new Date(Date.parse(iso) + KST_MS).toISOString().slice(0, 16).replace("T", " ");

// 스프레드시트가 수식으로 실행하지 않게(CSV 수식 주입) 위험한 첫 글자 앞에 '를 붙이고, 필요하면 따옴표로 감싼다.
function cell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function display(question: ResultQuestion, value: unknown) {
  if (value === undefined || value === null) return "";
  if (question.type === "single" || question.type === "multi") {
    const ids = Array.isArray(value) ? value.map(String) : [];
    return ids.map((id) => question.options.find((o) => o.id === id)?.label ?? id).join(" / ");
  }
  return String(value);
}

// 응답 1건 = 1줄, 열 = 문항. UTF-8 BOM(엑셀 한글 깨짐 방지), 이메일은 넣지 않는다(R-25, ADR 0017).
export function toCsv(questions: ResultQuestion[], responses: { id: string; submitted_at: string }[], answers: ResultAnswer[]) {
  const header = ["응답 시각(KST)", ...questions.map((q) => q.prompt)];
  const rows = [...responses]
    .sort((a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at))
    .map((r) => [
      kst(r.submitted_at),
      ...questions.map((q) => display(q, answers.find((a) => a.response_id === r.id && a.question_id === q.id)?.value)),
    ]);
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export async function loadResults(db: SupabaseClient, surveyId: string) {
  const [{ data: questions }, { data: responses }, { data: answers }] = await Promise.all([
    db.from("questions").select("id, position, type, prompt, options").eq("survey_id", surveyId).order("position").throwOnError(),
    db.from("responses").select("id, submitted_at").eq("survey_id", surveyId).throwOnError(),
    db.from("answers").select("response_id, question_id, value, responses!inner(survey_id)").eq("responses.survey_id", surveyId).throwOnError(),
  ]);
  const qs = (questions ?? []) as ResultQuestion[];
  const as = (answers ?? []).map(({ response_id, question_id, value }) => ({ response_id, question_id, value })) as ResultAnswer[];
  return { questions: qs, responses: responses ?? [], answers: as, responseCount: responses?.length ?? 0, stats: aggregate(qs, as) };
}
