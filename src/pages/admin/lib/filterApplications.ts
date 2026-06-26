/**
 * Filter ambassador applications (shared by All Applications and Draft Selection views).
 */

import type { AmbassadorApplication } from '../types';

export interface ApplicationFilterParams {
  searchTerm: string;
  instagramFilter: string;
  statusFilter: string;
  cityFilter: string;
  villeFilter: string;
  dateFrom?: Date;
  dateTo?: Date;
  ambassadorMap: Map<string, { ville?: string }>;
}

/** Normalize Instagram username or URL for comparison. */
export function normalizeInstagramForFilter(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) return '';
  value = value.replace(/^@/, '');
  value = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  value = value.replace(/^instagram\.com\//i, '');
  value = value.replace(/\/$/, '');
  value = value.split('?')[0];
  value = value.split('/')[0];
  return value;
}

function matchesInstagramFilter(
  socialLink: string | null | undefined,
  query: string,
): boolean {
  const normalizedQuery = normalizeInstagramForFilter(query);
  if (!normalizedQuery) return true;
  if (!socialLink?.trim()) return false;

  const linkLower = socialLink.trim().toLowerCase();
  const normalizedLink = normalizeInstagramForFilter(socialLink);

  return (
    normalizedLink.includes(normalizedQuery) || linkLower.includes(normalizedQuery)
  );
}

export function filterAmbassadorApplications(
  applications: AmbassadorApplication[],
  params: ApplicationFilterParams,
): AmbassadorApplication[] {
  if (!applications.length) return [];

  const searchLower = params.searchTerm.toLowerCase().trim();
  const hasSearch = searchLower.length > 0;

  let fromDate: Date | null = null;
  let toDate: Date | null = null;

  if (params.dateFrom) {
    fromDate = new Date(params.dateFrom);
    fromDate.setHours(0, 0, 0, 0);
  }

  if (params.dateTo) {
    toDate = new Date(params.dateTo);
    toDate.setHours(23, 59, 59, 999);
  }

  return applications.filter((application) => {
    if (params.statusFilter !== 'all') {
      const appStatus = (application.status || '').toLowerCase().trim();
      const filterStatus = params.statusFilter.toLowerCase().trim();
      if (appStatus !== filterStatus) return false;
    }

    if (params.cityFilter !== 'all' && application.city !== params.cityFilter) {
      return false;
    }

    if (params.villeFilter !== 'all') {
      let applicationVille = application.ville;

      if (!applicationVille && (application.city === 'Sousse' || application.city === 'Tunis')) {
        const phoneKey = `phone:${application.phone_number}`;
        const emailKey = application.email ? `email:${application.email}` : null;
        const phoneMatch = params.ambassadorMap.get(phoneKey);
        const emailMatch = emailKey ? params.ambassadorMap.get(emailKey) : null;
        applicationVille = phoneMatch?.ville || emailMatch?.ville;
      }

      if (applicationVille !== params.villeFilter) return false;
    }

    if (fromDate || toDate) {
      const applicationDate = new Date(application.created_at);
      applicationDate.setHours(0, 0, 0, 0);
      if (fromDate && applicationDate < fromDate) return false;
      if (toDate && applicationDate > toDate) return false;
    }

    if (hasSearch) {
      const matchesSearch =
        application.full_name.toLowerCase().includes(searchLower) ||
        (application.email && application.email.toLowerCase().includes(searchLower)) ||
        application.phone_number.includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (!matchesInstagramFilter(application.social_link, params.instagramFilter)) {
      return false;
    }

    return true;
  });
}
