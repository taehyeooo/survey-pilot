import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// .env.local을 테스트에도 읽힌다. 값이 없는 환경(CI)에서는 DB 테스트가 건너뛴다(test/db).
// tsconfig의 "@/*" 별칭은 Vite가 읽지 않으므로 여기에도 적는다.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    env: loadEnv("test", process.cwd(), ""),
  },
});
