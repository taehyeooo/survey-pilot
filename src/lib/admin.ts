// 관리자는 ADMIN_EMAIL 한 명(R-1). DB도 admins 테이블로 한 번 더 막는다(ADR 0019).
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isAdminEmail(email: string | null | undefined, adminEmail: string | null | undefined) {
  if (!email || !adminEmail) return false;
  return normalizeEmail(email) === normalizeEmail(adminEmail);
}
