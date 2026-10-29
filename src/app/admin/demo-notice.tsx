export function DemoNotice() {
  return (
    <p role="note" className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      데모 AI로 동작 중이에요. 정해 둔 답을 돌려줘요. 실제 AI를 쓰려면 .env.local에 GEMINI_API_KEY를 넣어 주세요.
    </p>
  );
}
