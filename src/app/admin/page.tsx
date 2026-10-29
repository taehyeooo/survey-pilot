import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { groupByTab, listSurveys, TABS, type SurveyListItem, type Tab } from "@/lib/surveys";
import { archive, logout, restore } from "./actions";
import { ProblemForm } from "./new/problem-form";
import { uxOf, withUx, type Ux } from "./ux";

const STATUS: Record<string, string> = { designing: "설계 중", reviewing: "검토 중", published: "진행 중", closed: "마감" };
const EMPTY: Record<Tab, string> = {
  designing: "첫 문제를 입력해 보세요.",
  active: "진행 중인 설문이 없어요.",
  closed: "마감된 설문이 없어요.",
  archived: "보관한 설문이 없어요.",
};
const dateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" });
const created = (s: SurveyListItem) => dateFormat.format(new Date(s.created_at));
const responses = (s: SurveyListItem) => `응답 ${s.responseCount}${s.target_responses ? ` / ${s.target_responses}` : ""}`;
type Groups = Record<Tab, SurveyListItem[]>;

function ToggleArchive({ survey, archived }: { survey: SurveyListItem; archived: boolean }) {
  return (
    <form action={archived ? restore.bind(null, survey.id) : archive.bind(null, survey.id)}>
      <button
        type="submit"
        className="min-h-11 shrink-0 rounded-lg px-3 text-sm whitespace-nowrap text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
      >
        {archived ? "복원" : "보관"}
      </button>
    </form>
  );
}

function NewButton({ ux, className = "" }: { ux: Ux; className?: string }) {
  return (
    <Link
      href={withUx("/admin/new", ux)}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900 ${className}`}
    >
      새 설문
    </Link>
  );
}

// ── A 문서형: 가운데 한 줄, 탭 + 카드 목록 ──────────────────────────
function ListA({ groups, tab, ux }: { groups: Groups; tab: Tab; ux: Ux }) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-end">
        <NewButton ux={ux} />
      </div>
      <nav aria-label="설문 상태" className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={withUx(`/admin?tab=${t.key}`, ux)}
            aria-current={t.key === tab ? "page" : undefined}
            className="flex min-h-11 shrink-0 items-center border-b-2 border-transparent px-3 text-sm text-zinc-500 aria-[current=page]:border-zinc-900 aria-[current=page]:font-medium aria-[current=page]:text-zinc-900 dark:aria-[current=page]:border-zinc-100 dark:aria-[current=page]:text-zinc-100"
          >
            {t.label} {groups[t.key].length}
          </Link>
        ))}
      </nav>
      {groups[tab].length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-zinc-500">{EMPTY[tab]}</p>
          {tab === "designing" && <NewButton ux={ux} />}
        </div>
      ) : (
        <ul className="flex flex-col gap-3 py-4">
          {groups[tab].map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="min-w-0">
                <Link href={withUx(`/admin/surveys/${s.id}`, ux)} className="line-clamp-2 font-medium break-keep hover:underline">
                  {s.problem}
                </Link>
                <p className="mt-1 text-sm text-zinc-500">
                  {STATUS[s.status]} · {responses(s)} · {created(s)}
                </p>
              </div>
              <ToggleArchive survey={s} archived={tab === "archived"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── B 작업대형: 왼쪽 상태 필터 + 촘촘한 행 목록 ──────────────────────
function ListB({ groups, tab, ux }: { groups: Groups; tab: Tab; ux: Ux }) {
  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside className="flex flex-col gap-3">
        <NewButton ux={ux} className="w-full" />
        <nav aria-label="설문 상태" className="flex gap-1 overflow-x-auto md:flex-col">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={withUx(`/admin?tab=${t.key}`, ux)}
              aria-current={t.key === tab ? "page" : undefined}
              className="flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-lg px-3 text-sm text-zinc-600 hover:bg-zinc-100 aria-[current=page]:bg-zinc-100 aria-[current=page]:font-medium aria-[current=page]:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:aria-[current=page]:bg-zinc-900 dark:aria-[current=page]:text-zinc-100"
            >
              <span>{t.label}</span>
              <span className="tabular-nums text-zinc-400">{groups[t.key].length}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <section aria-label={TABS.find((t) => t.key === tab)?.label}>
        {groups[tab].length === 0 ? (
          <p className="py-16 text-center text-zinc-500">{EMPTY[tab]}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {groups[tab].map((s) => (
              <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-1 md:grid-cols-[1fr_6rem_7rem_auto]">
                <Link href={withUx(`/admin/surveys/${s.id}`, ux)} className="truncate py-2 font-medium hover:underline">
                  {s.problem}
                </Link>
                <span className="hidden text-sm text-zinc-500 md:block">{STATUS[s.status]}</span>
                <span className="hidden text-sm tabular-nums text-zinc-500 md:block">{responses(s)}</span>
                <ToggleArchive survey={s} archived={tab === "archived"} />
                <span className="col-span-2 -mt-2 pb-1 text-sm text-zinc-500 md:hidden">
                  {STATUS[s.status]} · {responses(s)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── C 단계형: 맨 위에서 바로 문제 입력, 카드마다 4단계 진행 ─────────────
const STAGES = ["설계", "문항", "응답", "리포트"];
const stageOf = (status: string) => ({ designing: 0, reviewing: 1, published: 2, closed: 3 })[status] ?? 0;

function StageBar({ status }: { status: string }) {
  const current = stageOf(status);
  return (
    <ol aria-label={`지금 단계: ${STAGES[current]}`} className="mt-3 grid grid-cols-4 gap-1">
      {STAGES.map((label, i) => (
        <li key={label} className="flex flex-col gap-1">
          <span aria-hidden className={`h-1 rounded-full ${i <= current ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"}`} />
          <span className={`text-xs ${i === current ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function CardGrid({ items, ux }: { items: SurveyListItem[]; ux: Ux }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((s) => (
        <li key={s.id} className="flex flex-col rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-start justify-between gap-2">
            <Link href={withUx(`/admin/surveys/${s.id}`, ux)} className="line-clamp-2 font-medium break-keep hover:underline">
              {s.problem}
            </Link>
            <ToggleArchive survey={s} archived={Boolean(s.archived_at)} />
          </div>
          <p className="text-sm text-zinc-500">{responses(s)}</p>
          <StageBar status={s.status} />
        </li>
      ))}
    </ul>
  );
}

function ListC({ groups, ux }: { groups: Groups; ux: Ux }) {
  const sections: { key: Tab; label: string }[] = [
    { key: "active", label: "진행 중" },
    { key: "designing", label: "만드는 중" },
    { key: "closed", label: "마감" },
  ];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <section aria-label="새 설문 시작" className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
        <ProblemForm ux={ux} />
      </section>
      {sections.map(({ key, label }) =>
        groups[key].length === 0 ? null : (
          <section key={key} aria-labelledby={`sec-${key}`}>
            <h2 id={`sec-${key}`} className="mb-3 text-sm font-medium text-zinc-500">
              {label} {groups[key].length}
            </h2>
            <CardGrid items={groups[key]} ux={ux} />
          </section>
        ),
      )}
      {groups.archived.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer text-sm text-zinc-500">보관함 {groups.archived.length}</summary>
          <div className="mt-3">
            <CardGrid items={groups.archived} ux={ux} />
          </div>
        </details>
      )}
    </div>
  );
}

async function SurveyList({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { db } = await requireAdmin();
  const { tab: rawTab, ux: rawUx } = await searchParams;
  const ux = uxOf(rawUx);
  const tab: Tab = TABS.find((t) => t.key === rawTab)?.key ?? "active";
  const groups = groupByTab(await listSurveys(db));

  if (process.env.NODE_ENV !== "production" && ux === "b") return <ListB groups={groups} tab={tab} ux={ux} />;
  if (process.env.NODE_ENV !== "production" && ux === "c") return <ListC groups={groups} ux={ux} />;
  return <ListA groups={groups} tab={tab} ux={ux} />;
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">내 설문</h1>
        <form action={logout}>
          <button
            type="submit"
            className="min-h-11 rounded-lg px-3 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            로그아웃
          </button>
        </form>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-zinc-500">불러오는 중…</p>}>
        <SurveyList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
