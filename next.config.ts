import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 로컬 테스트 관리자는 127.0.0.1로 연다 — localhost 쿠키(실제 관리자 세션)와 섞이지 않게
  // (knowledge-base/concepts/local-admin-login.md). 개발 서버에서만 쓰이는 설정이다.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
