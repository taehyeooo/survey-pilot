import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { findPublicSurvey } from "@/lib/publish";
import { isClosed, PAUSED } from "@/lib/respond";
import { closeOverdue } from "@/lib/submit";
import { createAdminClient } from "@/lib/supabase/admin";
import { RespondFlow, type PublicQuestion } from "./respond-flow";

// 공개 응답 화면(R-17). 게시 전이면 404 화면(R-13), 마감·보관이면 안내(R-20).
async function PublicSurvey({ params }: PageProps<"/s/[slug]">) {
  await connection();
  const { slug } = await params;
  const db = createAdminClient();
  await closeOverdue(db); // 마감일 지난 설문은 들어올 때 마감(R-16)
  const survey = await findPublicSurvey(db, slug);
  if (!survey) notFound();
  return (
    <>
      <h1 className="text-xl font-semibold">설문에 참여해 주세요</h1>
      <p className="mt-3 mb-8 leading-7">{survey.intro}</p>
      {isClosed(survey) ? (
        <p role="status" className="rounded-box bg-surface p-4">
          마감된 설문이에요. 참여해 주셔서 고마워요.
        </p>
      ) : survey.paused ? (
        <p role="status" className="rounded-box bg-surface p-4">
          {PAUSED}
        </p>
      ) : (
        <RespondFlow slug={slug} questions={(survey.questions ?? []) as PublicQuestion[]} contact={process.env.CONTACT_EMAIL || null} requireEmail={survey.require_email} />
      )}
    </>
  );
}

export default function PublicSurveyPage(props: PageProps<"/s/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <PublicSurvey {...props} />
      </Suspense>
    </main>
  );
}
