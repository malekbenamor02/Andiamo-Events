/**
 * Matches `useEvents` / gallery / pass purchase: treat Vite dev, localhost, loopback, and
 * common LAN hostnames as “local” so test events (`is_test`) and dev bypasses apply consistently
 * on your machine — production traffic still excludes test events.
 */
export function isLocalhostClient(): boolean {
  if (import.meta.env.DEV) return true;
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
