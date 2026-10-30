import Link from "next/link";
import { Suspense } from "react";
import { requireMember, requireSignedIn } from "@/lib/auth";
import { isOperator } from "@/lib/operator";
import { closeOverdue } from "@/lib/submit";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupByTab, listSurveys, type SurveyListItem, type Tab } from "@/lib/surveys";
import { archive, logout, restore } from "./actions";
import { ProblemForm } from "./new/problem-form";
import { StageBar, stageOf } from "./stage-bar";

// 관리자 목록(디자인 결정 27 C 단계형): 맨 위에서 바로 문제 입력, 설문마다 단계 진행.
const SECTIONS: { key: Tab; label: string }[] = [
  { key: "active", label: "진행 중" },
  { key: "designing", label: "만드는 중" },
  { key: "closed", label: "마감" },
];
const responses = (s: SurveyListItem) => `응답 ${s.responseCount}${s.target_responses ? ` / ${s.target_responses}` : ""}`;

function ToggleArchive({ survey }: { survey: SurveyListItem }) {
  const archived = Boolean(survey.archived_at);
  return (
    <form action={archived ? restore.bind(null, survey.id) : archive.bind(null, survey.id)}>
      <button type="submit" className="min-h-11 shrink-0 rounded-box px-3 text-sm whitespace-nowrap text-muted hover:bg-surface">
        {archived ? "복원" : "보관"}
      </button>
    </form>
  );
}

function CardGrid({ items }: { items: SurveyListItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map((s) => (
        <li key={s.id} className="flex flex-col rounded-box bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/app/surveys/${s.id}`} className="line-clamp-2 py-2 font-medium hover:underline">
              {s.problem}
            </Link>
            <ToggleArchive survey={s} />
          </div>
          <p className="text-sm text-muted">
            {responses(s)}
            {s.taken_down_at && <span className="ml-2 text-danger">운영자가 내림</span>}
          </p>
          <StageBar current={stageOf(s)} className="mt-3" />
        </li>
      ))}
    </ul>
  );
}

async function SurveyList() {
  const { db, user } = await requireMember();
  await closeOverdue(createAdminClient()); // 마감일 지난 설문은 들어올 때 마감(R-16)
  const groups = groupByTab(await listSurveys(db, user.id));
  const empty = SECTIONS.every(({ key }) => groups[key].length === 0);

  return (
    <div className="flex flex-col gap-10">
      <section aria-label="새 설문 시작" className="rounded-box bg-surface p-5">
        <ProblemForm />
      </section>
      {empty && <p className="text-center text-muted">아직 설문이 없어요. 위에 첫 문제를 적어 보세요.</p>}
      {SECTIONS.map(({ key, label }) =>
        groups[key].length === 0 ? null : (
          <section key={key} aria-labelledby={`sec-${key}`}>
            <h2 id={`sec-${key}`} className="mb-3 text-sm font-medium text-muted">
              {label} {groups[key].length}
            </h2>
            <CardGrid items={groups[key]} />
          </section>
        ),
      )}
      {groups.archived.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">보관함 {groups.archived.length}</summary>
          <div className="mt-3">
            <CardGrid items={groups.archived} />
          </div>
        </details>
      )}
    </div>
  );
}

// 운영자에게만 운영 페이지로 가는 길(multi-user R-6·R-10). 운영 페이지 자체는 /ops에서 다시 확인한다.
async function OpsLink() {
  const { user } = await requireSignedIn();
  if (!(await isOperator(createAdminClient(), user.email, process.env.ADMIN_EMAIL))) return null;
  return (
    <Link href="/ops" className="inline-flex min-h-11 items-center rounded-box px-3 text-sm text-muted hover:bg-surface">
      운영
    </Link>
  );
}

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="chrome-bar -mx-4 mb-6 flex items-center justify-between px-4 py-2">
        <h1 className="text-xl font-semibold">내 설문</h1>
        <div className="flex items-center gap-1">
          <Suspense>
            <OpsLink />
          </Suspense>
          <form action={logout}>
            <button type="submit" className="min-h-11 rounded-box px-3 text-sm text-muted hover:bg-surface">
              로그아웃
            </button>
          </form>
        </div>
      </header>
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <SurveyList />
      </Suspense>
      <footer className="mt-16 border-t border-line pt-4">
        <Link href="/app/leave" className="inline-flex min-h-11 items-center text-sm text-muted hover:underline">
          탈퇴하기
        </Link>
      </footer>
    </main>
  );
}
