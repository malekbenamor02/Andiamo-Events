/**
 * Admin Reports Excel export — thin client.
 * Workbook generation runs server-side via /api/admin/reports/export.
 */

import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import type { DateRange } from '@/hooks/useAnalytics';

const ADMIN_EXPORT_ROLES = new Set(['admin', 'super_admin']);

/** Only `admin` and `super_admin` may request the export (UI guard; server enforces reports:view). */
export function canDownloadReportsExcel(adminRole: string | null | undefined): boolean {
  return adminRole != null && ADMIN_EXPORT_ROLES.has(adminRole);
}

function parseFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return 'Andiamo_Report.xlsx';
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match?.[1] || 'Andiamo_Report.xlsx';
}

export async function downloadReportsExcel(params: {
  eventId: string | null;
  eventName: string | null;
  dateRange: DateRange;
  language?: 'en' | 'fr';
  adminRole: string | null | undefined;
}) {
  const lang = params.language ?? 'en';
  if (!canDownloadReportsExcel(params.adminRole)) {
    throw new Error(
      lang === 'fr'
        ? 'Seuls les administrateurs peuvent télécharger ce rapport.'
        : 'Only administrators can download this report.'
    );
  }

  const qs = new URLSearchParams();
  qs.set('date_range', params.dateRange);
  qs.set('language', lang);
  if (params.eventId) qs.set('event_id', params.eventId);
  if (params.eventName) qs.set('event_name', params.eventName);

  const route = `${API_ROUTES.ADMIN_REPORTS_EXPORT}?${qs.toString()}`;
  const url = buildFullApiUrl(route);
  if (!url) {
    throw new Error(lang === 'fr' ? 'URL d’export non configurée.' : 'Export URL is not configured.');
  }

  const response = await fetch(url, { method: 'GET', credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ||
        (lang === 'fr' ? 'Échec de l’export du rapport.' : 'Report export failed.')
    );
  }

  const blob = await response.blob();
  const filename = parseFilename(response.headers.get('Content-Disposition'));
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
