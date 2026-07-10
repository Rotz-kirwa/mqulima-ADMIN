export function getCsrfTokenFromCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp('(^| )mq_csrf_admin=([^;]+)'));
  if (match) return match[2];
  return "";
}
