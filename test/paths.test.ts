import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("경로 /admin → /app (multi-user R-6)", () => {
  // multi-user#R-6
  it("옛 /admin 주소는 같은 아래 경로의 /app으로 보낸다", async () => {
    const rules = await nextConfig.redirects!();
    expect(rules).toContainEqual({ source: "/admin", destination: "/app", permanent: true });
    expect(rules).toContainEqual({ source: "/admin/:path*", destination: "/app/:path*", permanent: true });
  });
});
