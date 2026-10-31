import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { closeOverdue } from "@/lib/submit";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSurveys, relativeDay, summarize, type SurveyListItem } from "@/lib/surveys";
import { archive, restore } from "./actions";
import { IconArrowRight, IconList, IconPlus, PaperPilot } from "../icons";
import { PageHead } from "./page-head";
import { CardsSkeleton } from "./skeleton";
import { STAGES, stageOf } from "./stage-bar";

// 내 설문(결정 37, 시안 "03 정돈된 도구"): 캐릭터 인사 띠 → 제목·요약 숫자 → 촘촘한 표(이름·상태·응답·단계·만든 날).
const STATUS: Record<string, string> = { designing: "설계 중", reviewing: "문항 확인 중", published: "응답 받는 중", closed: "마감" };

function ToggleArchive({ survey }: { survey: SurveyListItem }) {
  const archived = Boolean(survey.archived_at);
  return (
    <form action={archived ? restore.bind(null, survey.id) : archive.bind(null, survey.id)} className="relative z-10">
      <button type="submit" className="min-h-11 rounded-box px-3 text-sm whitespace-nowrap text-muted hover:bg-line/60 hover:text-fg">
        {archived ? "복원" : "보관"}
      </button>
    </form>
  );
}

function MiniStages({ current }: { current: number }) {
  return (
    <span role="img" aria-label={`단계 ${STAGES[current]} (${current + 1}/${STAGES.length})`} className="flex gap-1">
      {STAGES.map((s, i) => (
        <span key={s} className={`h-1 w-5 rounded-full ${i === current ? "bg-brand" : i < current ? "bg-brand/40" : "bg-line"}`} />
      ))}
    </span>
  );
}

function SurveyTable({ items, now }: { items: SurveyListItem[]; now: Date }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">이름</th>
            <th className="px-4 py-3 font-medium">상태</th>
            <th className="px-4 py-3 font-medium">응답</th>
            <th className="px-4 py-3 font-medium">단계</th>
            <th className="px-4 py-3 font-medium">만든 날</th>
            <th className="px-2 py-3">
              <span className="sr-only">보관</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} className="relative border-b border-line last:border-b-0 hover:bg-surface">
              <td className="px-4 py-3">
                <Link href={`/app/surveys/${s.id}`} className="flex items-center gap-3 font-semibold after:absolute after:inset-0">
                  <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-bg text-brand">
                    <IconList className="size-4" />
                  </span>
                  <span className="line-clamp-1">{s.problem}</span>
                </Link>
                {s.taken_down_at && <p className="mt-1 pl-11 text-xs text-danger">운영자가 내림</p>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-2 rounded-full ${s.status === "published" ? "bg-brand" : "bg-muted/50"}`} />
                  {STATUS[s.status] ?? s.status}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                <span className="font-semibold">{s.responseCount}</span>
                <span className="text-muted">{s.target_responses ? ` / ${s.target_responses}명` : "명"}</span>
              </td>
              <td className="px-4 py-3">
                <MiniStages current={stageOf(s)} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted">{relativeDay(s.created_at, now)}</td>
              <td className="px-2 py-1 text-right">
                <ToggleArchive survey={s} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 맨 위 인사 띠 — 응답이 모였으면 축하하는 캐릭터, 아직이면 기다리는 캐릭터. 응답이 가장 많은 설문으로 바로 간다.
function Greeting({ rows }: { rows: SurveyListItem[] }) {
  const { responses } = summarize(rows);
  const top = rows.filter((r) => !r.archived_at).sort((a, b) => b.responseCount - a.responseCount)[0];
  if (!top) return null;
  const ratio = top.target_responses ? Math.round((top.responseCount / top.target_responses) * 100) : null;
  return (
    <section className="flex items-center gap-4 rounded-box border border-brand/15 bg-accent-soft p-4">
      <PaperPilot size={44} expression={responses > 0 ? "celebrate" : "default"} motion={responses > 0 ? "launch" : "float"} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{responses > 0 ? `응답 ${responses.toLocaleString("ko-KR")}개가 모였어요.` : "첫 응답을 기다리고 있어요."}</p>
        <p className="truncate text-sm text-muted">
          {responses > 0
            ? `${top.problem}${ratio !== null ? ` 설문이 목표의 ${ratio}%에 닿았어요.` : ` 설문에 ${top.responseCount}명이 답했어요.`}`
            : "설문을 게시하고 링크를 공유해 보세요."}
        </p>
      </div>
      <Link href={`/app/surveys/${top.id}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-sm font-semibold text-brand hover:underline">
        {responses > 0 ? "결과 확인" : "설문 열기"}
        <IconArrowRight className="size-4" />
      </Link>
    </section>
  );
}

async function SurveyList() {
  const { db, user } = await requireMember();
  await closeOverdue(createAdminClient()); // 마감일 지난 설문은 들어올 때 마감(R-16)
  const rows = await listSurveys(db, user.id);
  const now = new Date();
  const live = rows.filter((r) => !r.archived_at);
  const archived = rows.filter((r) => r.archived_at);
  const { active, responses } = summarize(rows);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-box border border-dashed border-line px-6 py-16 text-center">
        <PaperPilot size={64} motion="float" />
        <h1 className="text-lg font-semibold">아직 설문이 없어요</h1>
        <p className="text-muted">풀고 싶은 문제 한 줄이면 AI가 조사 설계와 문항을 먼저 짜 드려요.</p>
        <Link href="/app/new" className="btn btn-primary">
          첫 설문 만들기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Greeting rows={rows} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline">내 설문</h1>
          <p className="mt-1 text-sm text-muted">{live.length}개의 설문 · 최근 만든 순</p>
        </div>
        <dl className="flex gap-6 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="order-last text-muted">진행 중</dt>
            <dd className="text-2xl font-bold tabular-nums">{active}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="order-last text-muted">전체 응답</dt>
            <dd className="text-2xl font-bold tabular-nums">{responses.toLocaleString("ko-KR")}</dd>
          </div>
        </dl>
      </div>
      {live.length > 0 && <SurveyTable items={live} now={now} />}
      {!live.some((r) => r.status === "closed") && (
        <div className="flex items-center justify-center gap-3 rounded-box border border-dashed border-line px-6 py-8">
          <PaperPilot size={40} motion="float" />
          <div>
            <p className="text-sm font-semibold">마감한 설문이 아직 없어요</p>
            <p className="text-sm text-muted">설문을 마감하면 결과 보고서와 함께 이곳에 정리돼요.</p>
          </div>
        </div>
      )}
      {archived.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">보관함 {archived.length}</summary>
          <div className="mt-3">
            <SurveyTable items={archived} now={now} />
          </div>
        </details>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageHead crumbs={[{ label: "내 설문" }]}>
        <Link href="/app/new" className="btn btn-primary">
          <IconPlus className="size-4" />새 설문
        </Link>
      </PageHead>
      <main className="mx-auto w-full max-w-6xl px-6 py-8 md:px-8">
        <Suspense fallback={<CardsSkeleton />}>
          <SurveyList />
        </Suspense>
        <footer className="mt-16 border-t border-line pt-4">
          <Link href="/app/leave" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
            탈퇴하기
          </Link>
        </footer>
      </main>
    </>
  );
}
