import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { groupByTab, listSurveys, TABS, type SurveyListItem, type Tab } from "@/lib/surveys";
import { archive, logout, restore } from "./actions";

const STATUS: Record<string, string> = { designing: "설계 중", reviewing: "검토 중", published: "진행 중", closed: "마감" };
const EMPTY: Record<Tab, string> = {
  designing: "첫 문제를 입력해 보세요.",
  active: "진행 중인 설문이 없어요.",
  closed: "마감된 설문이 없어요.",
  archived: "보관한 설문이 없어요.",
};
const dateFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" });

function SurveyCard({ survey, tab }: { survey: SurveyListItem; tab: Tab }) {
  const toggle = tab === "archived" ? restore.bind(null, survey.id) : archive.bind(null, survey.id);
  return (
    <li className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="min-w-0">
        <Link href={`/admin/surveys/${survey.id}`} className="line-clamp-2 font-medium break-keep hover:underline">
          {survey.problem}
        </Link>
        <p className="mt-1 text-sm text-zinc-500">
          {STATUS[survey.status]} · 응답 {survey.responseCount}
          {survey.target_responses ? ` / ${survey.target_responses}` : ""} · {dateFormat.format(new Date(survey.created_at))}
        </p>
      </div>
      <form action={toggle}>
        <button
          type="submit"
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          {tab === "archived" ? "복원" : "보관"}
        </button>
      </form>
    </li>
  );
}

async function SurveyList({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { db } = await requireAdmin();
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.find((t) => t.key === raw)?.key ?? "active";
  const groups = groupByTab(await listSurveys(db));

  return (
    <>
      <nav aria-label="설문 상태" className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            aria-current={t.key === tab ? "page" : undefined}
            className="shrink-0 border-b-2 border-transparent px-3 py-2 text-sm text-zinc-500 aria-[current=page]:border-zinc-900 aria-[current=page]:font-medium aria-[current=page]:text-zinc-900 dark:aria-[current=page]:border-zinc-100 dark:aria-[current=page]:text-zinc-100"
          >
            {t.label} {groups[t.key].length}
          </Link>
        ))}
      </nav>
      {groups[tab].length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-zinc-500">{EMPTY[tab]}</p>
          {tab === "designing" && (
            <Link href="/admin/new" className="rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              새 설문
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3 py-4">
          {groups[tab].map((s) => (
            <SurveyCard key={s.id} survey={s} tab={tab} />
          ))}
        </ul>
      )}
    </>
  );
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">내 설문</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/new" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            새 설문
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              로그아웃
            </button>
          </form>
        </div>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-zinc-500">불러오는 중…</p>}>
        <SurveyList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
