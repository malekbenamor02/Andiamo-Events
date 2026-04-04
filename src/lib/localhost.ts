/**
 * Matches `useEvents` / gallery: treat local dev (localhost, loopback, common LAN) as “local”
 * so test events and other dev-only behavior apply consistently.
 */
export function isLocalhostClient(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.startsWith("192.168.") ||
    h.startsWith("10.0.") ||
    h.startsWith("172.")
  );
}
