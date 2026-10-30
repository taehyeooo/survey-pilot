import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOperator } from "@/lib/auth";
import { previewTakedown } from "@/lib/moderation";
import { createAdminClient } from "@/lib/supabase/admin";
import { restoreTakenDown, takeDownSurvey } from "../../actions";
import { ConfirmForm, Result } from "../../confirm-form";
import { OpsNav } from "../../nav";

// 설문 내리기·되돌리기(multi-user R-14): 미리보기 → 사유·확인 → 실행. 되돌리기는 운영자만.
async function Detail({ params, searchParams }: PageProps<"/ops/surveys/[id]">) {
  await requireOperator();
  const { id } = await params;
  const { done, error } = await searchParams;
  const survey = await previewTakedown(createAdminClient(), id);
  if (!survey) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Result done={done} error={error} />
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{survey.problem}</h2>
        <p className="text-muted break-all">
          {survey.ownerEmail} · 응답 {survey.responses}
          {survey.takenDown && <span className="ml-2 text-danger">내림</span>}
        </p>
      </section>
      {survey.takenDown ? (
        <>
          <p className="leading-7 break-keep">되돌리면 응답 링크가 다시 응답을 받아요. 마감·보관된 설문은 그대로예요.</p>
          <ConfirmForm action={restoreTakenDown.bind(null, id)} label="되돌리기" />
        </>
      ) : (
        <>
          <p className="leading-7 break-keep">
            내리면 응답 링크가 응답을 받지 않고, 주인 화면에 &ldquo;운영자가 내린 설문이에요&rdquo;가 보여요. 주인은 되돌릴 수 없어요. 받은 응답은 지우지 않아요.
          </p>
          <ConfirmForm action={takeDownSurvey.bind(null, id)} label="내리기" danger />
        </>
      )}
    </div>
  );
}

export default function OpsSurveyPage(props: PageProps<"/ops/surveys/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <OpsNav current="surveys" />
      <Link href="/ops/surveys" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted hover:underline">
        ← 설문
      </Link>
      <Suspense fallback={<p className="py-16 text-center text-muted">불러오는 중…</p>}>
        <Detail {...props} />
      </Suspense>
    </main>
  );
}
