import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold">서베이 파일럿</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">풀고 싶은 문제 하나로 설문부터 리포트까지.</p>
      <Link
        href="/admin"
        className="mt-6 self-start rounded-lg bg-zinc-900 px-4 py-2.5 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        관리자 화면
      </Link>
    </main>
  );
}
