import Link from "next/link";
import { Suspense } from "react";
import { requireMember } from "@/lib/auth";
import { closeOverdue } from "@/lib/submit";
import { createAdminClient } from "@/lib/supabase/admin";
import { groupByTab, listSurveys, summarize, type SurveyListItem, type Tab } from "@/lib/surveys";
import { archive, restore } from "./actions";
import { IconChart, IconCheckCircle, IconPencil, IconPlus, IconUsers, Mascot } from "../icons";
import { CardsSkeleton } from "./skeleton";
import { StageBar, stageOf } from "./stage-bar";

// 내 설문 목록: 제목 옆 "새 설문 만들기"(상단 메뉴의 새 설문과 같은 곳), 묶음별 카드에 단계 진행(결정 27·30).
const SECTIONS: { key: Tab; label: string; Icon: typeof IconUsers }[] = [
  { key: "active", label: "진행 중", Icon: IconUsers },
  { key: "designing", label: "만드는 중", Icon: IconPencil },
  { key: "closed", label: "마감", Icon: IconCheckCircle },
];

// 맨 위 요약 숫자 셋(결정 36) — 파스텔 칸에 아이콘, 큰 숫자. 숫자는 글자로 읽히고 색은 꾸밈.
function Summary({ rows }: { rows: SurveyListItem[] }) {
  const { active, responses, closed } = summarize(rows);
  const tiles = [
    { label: "응답 받는 중", value: `${active}개`, Icon: IconUsers, tint: "bg-tint-4" },
    { label: "모인 응답", value: `${responses.toLocaleString("ko-KR")}명`, Icon: IconChart, tint: "bg-tint-2" },
    { label: "마감한 설문", value: `${closed}개`, Icon: IconCheckCircle, tint: "bg-tint-1" },
  ];
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {tiles.map(({ label, value, Icon, tint }) => (
        <div key={label} className={`flex items-center gap-4 rounded-box p-5 ${tint}`}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-bg text-brand">
            <Icon className="size-5" />
          </span>
          <div>
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-2xl font-bold tracking-display tabular-nums">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function ToggleArchive({ survey }: { survey: SurveyListItem }) {
  const archived = Boolean(survey.archived_at);
  return (
    <form action={archived ? restore.bind(null, survey.id) : archive.bind(null, survey.id)} className="relative z-10">
      <button type="submit" className="min-h-11 shrink-0 rounded-box px-3 text-sm whitespace-nowrap text-muted hover:bg-line/50">
        {archived ? "복원" : "보관"}
      </button>
    </form>
  );
}

// 설문마다 파스텔 포인트 하나 — 같은 설문은 늘 같은 색(id로 고른다). 색은 꾸밈일 뿐, 구별은 제목으로 한다.
const TINTS = ["bg-tint-1", "bg-tint-2", "bg-tint-3", "bg-tint-4", "bg-tint-5"];
const tintOf = (id: string) => TINTS[[...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TINTS.length];
const STATUS: Record<string, string> = { designing: "설계 중", reviewing: "문항 확인 중", published: "응답 받는 중", closed: "마감" };

function CardGrid({ items }: { items: SurveyListItem[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((s) => (
        <li key={s.id} className="card relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
          <Link href={`/app/surveys/${s.id}`} className={`flex min-h-28 flex-col gap-2 px-5 pt-5 pb-4 after:absolute after:inset-0 ${tintOf(s.id)}`}>
            <span className="text-xs font-medium text-muted">{STATUS[s.status] ?? s.status}</span>
            <span className="line-clamp-2 text-lg leading-snug font-semibold">{s.problem}</span>
          </Link>
          <div className="flex items-end justify-between gap-2 px-5 pt-4">
            <p className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-display tabular-nums">{s.responseCount}</span>
              <span className="text-sm text-muted">{s.target_responses ? `/ ${s.target_responses}명 응답` : "명 응답"}</span>
            </p>
            <ToggleArchive survey={s} />
          </div>
          {s.taken_down_at && <p className="px-5 text-sm text-danger">운영자가 내림</p>}
          <StageBar current={stageOf(s)} className="px-5 pt-3 pb-5" />
        </li>
      ))}
    </ul>
  );
}

async function SurveyList() {
  const { db, user } = await requireMember();
  await closeOverdue(createAdminClient()); // 마감일 지난 설문은 들어올 때 마감(R-16)
  const rows = await listSurveys(db, user.id);
  const groups = groupByTab(rows);
  const empty = SECTIONS.every(({ key }) => groups[key].length === 0);

  return (
    <div className="flex flex-col gap-10">
      {empty && (
        <div className="flex flex-col items-center gap-4 card px-6 py-16 text-center">
          <Mascot mood="wink" className="size-16" />
          <p className="text-lg font-semibold">아직 설문이 없어요</p>
          <p className="text-muted">풀고 싶은 문제 한 줄이면 AI가 조사 설계와 문항을 먼저 짜 드려요.</p>
          <Link href="/app/new" className="btn btn-primary">
            첫 설문 만들기
          </Link>
        </div>
      )}
      {!empty && <Summary rows={rows} />}
      {SECTIONS.map(({ key, label, Icon }) =>
        groups[key].length === 0 ? null : (
          <section key={key} aria-labelledby={`sec-${key}`}>
            <h2 id={`sec-${key}`} className="mb-4 flex items-center gap-2 text-eyebrow">
              <Icon className="size-4 text-brand" />
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

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      {/* 머리: 캐릭터가 말을 거는 인사(결정 36) — 첫 화면과 같은 캐릭터라 로그인 앞뒤가 이어진다 */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Mascot className="size-14 shrink-0 rounded-box shadow-lg shadow-brand/20" />
          <div>
            <h1 className="text-headline">내 설문</h1>
            <p className="text-muted">오늘은 어떤 문제를 풀어 볼까요?</p>
          </div>
        </div>
        <Link href="/app/new" className="btn btn-primary">
          <IconPlus className="size-4" />
          새 설문 만들기
        </Link>
      </div>
      <Suspense fallback={<CardsSkeleton />}>
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
