/**
 * Admin site content writes — backend API only (RLS blocks browser writes).
 */
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from '@/lib/api-routes';

export async function upsertSiteContentViaApi(key: string, content: Record<string, unknown>): Promise<void> {
  const apiBase = getApiBaseUrl();
  const url = buildFullApiUrl(API_ROUTES.ADMIN_SITE_CONTENT(key), apiBase);
  if (!url) {
    throw new Error('API URL not configured');
  }
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.details || 'Failed to update site content');
  }
}
