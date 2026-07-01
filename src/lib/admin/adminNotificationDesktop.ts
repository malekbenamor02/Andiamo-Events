/**
 * Desktop notification helper — icon omitted (no stable favicon asset in repo).
 */

export function showAdminDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, { body });
  } catch {
    // non-blocking
  }
}
