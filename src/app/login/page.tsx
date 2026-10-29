import { Suspense } from "react";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  link: "링크가 만료됐어요. 다시 받아 주세요.",
  forbidden: "관리자만 들어갈 수 있어요.",
};

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  return <LoginForm notice={typeof error === "string" ? NOTICES[error] : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">로그인</h1>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
