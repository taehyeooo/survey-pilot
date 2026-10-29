import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { findPublicSurvey } from "@/lib/publish";
import { createAdminClient } from "@/lib/supabase/admin";

// 공개 응답 링크. 게시 전이면 404(R-13). 응답 화면(동의·인증번호·문항)은 plan 9단계.
async function PublicSurvey({ params }: PageProps<"/s/[slug]">) {
  await connection();
  const { slug } = await params;
  const survey = await findPublicSurvey(createAdminClient(), slug);
  if (!survey) notFound();
  return (
    <>
      <p className="leading-7">{survey.intro}</p>
      <p className="mt-6 rounded-box bg-surface p-4 text-sm text-muted">
        {survey.status === "closed" ? "마감된 설문이에요." : "응답 화면을 준비하고 있어요. 곧 열려요."}
      </p>
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
