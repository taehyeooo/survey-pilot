import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSignedIn } from "@/lib/auth";
import { loadMember, needsAgreement } from "@/lib/members";
import { IconChart, IconTarget, IconUsers, Mascot } from "../../icons";
import { SubmitButton } from "../submit-button";
import { agree } from "./actions";

// 처음 로그인한 사용자에게 한 번(multi-user R-2). 약속 셋을 아이콘 카드로, 캐릭터가 맞이한다(결정 36).
const RULES = [
  { text: "AI와 메일의 무료 한도를 모든 사용자가 함께 써요. 한도를 다 쓰면 그날은 모두 쉬어요.", Icon: IconChart, tint: "bg-tint-4" },
  { text: "응답자의 개인정보는 설문을 만든 사람이 책임져요.", Icon: IconUsers, tint: "bg-tint-2" },
  { text: "운영자는 가입 이메일과 설문 목록·응답 수만 봐요. 설문 내용과 응답은 보지 않아요.", Icon: IconTarget, tint: "bg-tint-1" },
];
async function Welcome() {
  const { db, user } = await requireSignedIn();
  if (!needsAgreement(await loadMember(db, user.id))) redirect("/app");
  return (
    <form action={agree} className="flex flex-col gap-6">
      <ul className="flex flex-col gap-3 break-keep">
        {RULES.map(({ text, Icon, tint }) => (
          <li key={text} className="flex items-start gap-3 card p-4">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-brand ${tint}`}>
              <Icon className="size-5" />
            </span>
            <span className="pt-2">{text}</span>
          </li>
        ))}
      </ul>
      <SubmitButton pendingSteps={["시작하는 중…"]}>동의하고 시작하기</SubmitButton>
    </form>
  );
}

export default function WelcomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Mascot mood="wink" className="size-16 rounded-box shadow-lg shadow-brand/20" />
      <h1 className="text-headline">시작하기 전에</h1>
      <Suspense fallback={<p className="text-muted">불러오는 중…</p>}>
        <Welcome />
      </Suspense>
    </main>
  );
}
