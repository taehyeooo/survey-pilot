import "server-only";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name}이(가) 비어 있다. .env.local을 확인한다(.env.example 참고).`);
  return value;
}
