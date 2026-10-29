import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// .env.local을 테스트에도 읽힌다. 값이 없는 환경(CI)에서는 DB 테스트가 건너뛴다(test/db).
export default defineConfig({
  test: {
    env: loadEnv("test", process.cwd(), ""),
  },
});
