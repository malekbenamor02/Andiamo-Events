/**
 * Career API client helpers.
 * Reusable functions for public and admin career endpoints.
 */

import { apiFetch, handleApiResponse } from '@/lib/api-client';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import type {
  CareerDomain,
  CareerApplicationField,
  CareerApplication,
  CareerApplicationLog,
  CareerDomainWithCount,
  CareerSettings,
} from './types';

const base = () => getApiBaseUrl();

// —— Public ———————————————————————————————————————————————————————————————

export interface CareerWhyJoinUs {
  en?: { title: string; items: string[] };
  fr?: { title: string; items: string[] };
}

export async function fetchCareerPageContent(): Promise<{ whyJoinUs: CareerWhyJoinUs }> {
  const url = `${base()}${API_ROUTES.CAREERS_PAGE_CONTENT}`;
  const res = await fetch(url);
  const data = await handleApiResponse(res);
  return { whyJoinUs: data.whyJoinUs ?? { en: { title: 'Why join us', items: [] }, fr: { title: 'Pourquoi nous rejoindre', items: [] } } };
}

export async function fetchCareerDomains(): Promise<CareerDomain[]> {
  const url = `${base()}${API_ROUTES.CAREERS_DOMAINS}`;
  const res = await fetch(url);
  const data = await handleApiResponse(res);
  return data.domains ?? [];
}

export async function fetchCareerDomainBySlug(
  slug: string
): Promise<{ domain: CareerDomain; fields: CareerApplicationField[] } | null> {
  const route =
    typeof API_ROUTES.CAREERS_DOMAIN_BY_SLUG === 'function'
      ? API_ROUTES.CAREERS_DOMAIN_BY_SLUG(slug)
      : `${API_ROUTES.CAREERS_DOMAINS}/${slug}`;
  const url = `${base()}${route}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  const data = await handleApiResponse(res);
  return { domain: data.domain, fields: data.fields ?? [] };
}

/** Public: enabled city options for career form dropdown (shared across all jobs). */
export async function fetchCareerCityOptions(): Promise<{ options: string[] }> {
  const url = `${base()}${API_ROUTES.CAREERS_CITY_OPTIONS}`;
  const res = await fetch(url);
  const data = await handleApiResponse(res);
  return { options: data.options ?? [] };
}

/** Admin: full city options + disabled list for editing (shared across all jobs). */
export async function fetchAdminCareerCityOptions(): Promise<{
  options: string[];
  disabledOptions: string[];
}> {
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_CITY_OPTIONS}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  return {
    options: data.options ?? [],
    disabledOptions: data.disabledOptions ?? [],
  };
}

/** Admin: update global city options (applies to all jobs). */
export async function updateCareerCityOptions(body: {
  options?: string[];
  disabledOptions?: string[];
}): Promise<{ options: string[]; disabledOptions: string[] }> {
  const res = await apiFetch(API_ROUTES.CAREERS_ADMIN_CITY_OPTIONS, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleApiResponse(res);
}

/** Public: enabled gender options for career form dropdown (shared across all jobs). */
export async function fetchCareerGenderOptions(): Promise<{ options: string[] }> {
  const url = `${base()}${API_ROUTES.CAREERS_GENDER_OPTIONS}`;
  const res = await fetch(url);
  const data = await handleApiResponse(res);
  return { options: data.options ?? [] };
}

/** Admin: full gender options + disabled list for editing (shared across all jobs). */
export async function fetchAdminCareerGenderOptions(): Promise<{
  options: string[];
  disabledOptions: string[];
}> {
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_GENDER_OPTIONS}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  return {
    options: data.options ?? [],
    disabledOptions: data.disabledOptions ?? [],
  };
}

/** Admin: update global gender options (applies to all jobs). */
export async function updateCareerGenderOptions(body: {
  options?: string[];
  disabledOptions?: string[];
}): Promise<{ options: string[]; disabledOptions: string[] }> {
  const res = await apiFetch(API_ROUTES.CAREERS_ADMIN_GENDER_OPTIONS, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleApiResponse(res);
}

/** Check if email or phone is already used for this job (one per job). */
export async function checkCareerApplicationDuplicate(params: {
  domainSlug: string;
  email?: string | null;
  phone?: string | null;
}): Promise<{ emailTaken: boolean; phoneTaken: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.CAREER_APPLICATION_CHECK_DUPLICATE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      domainSlug: params.domainSlug,
      email: params.email ?? undefined,
      phone: params.phone ?? undefined,
    }),
  });
  const data = await handleApiResponse<{ emailTaken: boolean; phoneTaken: boolean }>(res);
  return { emailTaken: data.emailTaken ?? false, phoneTaken: data.phoneTaken ?? false };
}

export async function submitCareerApplication(body: {
  domainId?: string;
  domainSlug?: string;
  recaptchaToken: string;
  [key: string]: unknown;
}): Promise<{ id?: string; reference?: string }> {
  const res = await apiFetch(API_ROUTES.CAREER_APPLICATION_SUBMIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleApiResponse<{ id?: string; reference?: string }>(res);
}

// —— Admin ————————————————————————————————————————————————————————————————

export async function fetchCareerSettings(): Promise<CareerSettings> {
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_SETTINGS}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  const settings = data.settings ?? { enabled: true };
  return {
    enabled: settings.enabled !== false,
    admin_notification_emails: Array.isArray(settings.admin_notification_emails)
      ? settings.admin_notification_emails
      : [],
  };
}

export async function updateCareerSettings(
  enabled: boolean,
  adminNotificationEmails?: string[]
): Promise<void> {
  await apiFetch(API_ROUTES.CAREERS_ADMIN_SETTINGS, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      enabled,
      admin_notification_emails: adminNotificationEmails,
    }),
  });
}

export async function fetchAdminCareerDomains(): Promise<
  CareerDomainWithCount[]
> {
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_DOMAINS}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  return data.domains ?? [];
}

export async function fetchAdminCareerDomain(
  id: string
): Promise<{
  domain: CareerDomain;
  fields: CareerApplicationField[];
} | null> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN(id)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${id}`;
  const url = `${base()}${route}`;
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 404) return null;
  const data = await handleApiResponse(res);
  return { domain: data.domain, fields: data.fields ?? [] };
}

export async function createCareerDomain(body: {
  name: string;
  description?: string;
  benefits?: string;
  job_type?: string | null;
  salary?: string | null;
  job_details?: string | null;
  applications_open?: boolean;
  document_upload_enabled?: boolean;
  sort_order?: number;
}): Promise<CareerDomain> {
  const data = await handleApiResponse<{ domain: CareerDomain }>(
    await apiFetch(API_ROUTES.CAREERS_ADMIN_DOMAINS, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return data.domain;
}

export async function updateCareerDomain(
  id: string,
  body: Partial<{
    name: string;
    slug: string;
    description: string;
    benefits: string;
    job_type: string | null;
    salary: string | null;
    job_details: string | null;
    applications_open: boolean;
    document_upload_enabled: boolean;
    sort_order: number;
  }>
): Promise<CareerDomain> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN(id)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${id}`;
  const data = await handleApiResponse<{ domain: CareerDomain }>(
    await apiFetch(route, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return data.domain;
}

export async function deleteCareerDomain(id: string): Promise<void> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN(id)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${id}`;
  const res = await apiFetch(route, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || res.statusText || 'Failed to delete domain');
  }
}

export async function createCareerField(
  domainId: string,
  body: {
    field_key: string;
    label: string;
    field_type: string;
    required: boolean;
    sort_order?: number;
    options?: string[];
    validation?: Record<string, unknown>;
  }
): Promise<CareerApplicationField> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELDS === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELDS(domainId)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${domainId}/fields`;
  const data = await handleApiResponse<{ field: CareerApplicationField }>(
    await apiFetch(route, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return data.field;
}

export async function updateCareerField(
  domainId: string,
  fieldId: string,
  body: Partial<{
    field_key: string;
    label: string;
    field_type: string;
    required: boolean;
    sort_order: number;
    options: string[];
    validation: Record<string, unknown>;
  }>
): Promise<CareerApplicationField> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELD === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELD(domainId, fieldId)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${domainId}/fields/${fieldId}`;
  const data = await handleApiResponse<{ field: CareerApplicationField }>(
    await apiFetch(route, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return data.field;
}

export async function deleteCareerField(
  domainId: string,
  fieldId: string
): Promise<void> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELD === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELD(domainId, fieldId)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${domainId}/fields/${fieldId}`;
  await apiFetch(route, { method: 'DELETE', credentials: 'include' });
}

// —— Admin: form templates ———————————————————————————————————————————————

export interface CareerFormTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  fields_count?: number;
}

export async function fetchCareerTemplates(): Promise<CareerFormTemplate[]> {
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_TEMPLATES}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  return data.templates ?? [];
}

export async function saveCareerTemplateFromDomain(
  domainId: string,
  body: { name: string; description?: string }
): Promise<CareerFormTemplate> {
  const res = await apiFetch(API_ROUTES.CAREERS_ADMIN_TEMPLATES_FROM_DOMAIN, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domainId, ...body }),
  });
  const data = await handleApiResponse<{ template: CareerFormTemplate }>(res);
  return data.template;
}

export async function applyCareerTemplateToDomain(
  domainId: string,
  templateId: string
): Promise<CareerApplicationField[]> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN_APPLY_TEMPLATE === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN_APPLY_TEMPLATE(domainId)
      : `/api/admin/careers/domains/${domainId}/apply-template`;
  const res = await apiFetch(route, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId }),
  });
  const data = await handleApiResponse<{ fields: CareerApplicationField[] }>(res);
  return data.fields ?? [];
}

export interface BulkFieldInput {
  label: string;
  field_type: string;
  required?: boolean;
  options?: string[];
  validation?: Record<string, unknown>;
}

export async function createCareerFieldsBulk(
  domainId: string,
  fields: BulkFieldInput[]
): Promise<CareerApplicationField[]> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELDS_BULK === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELDS_BULK(domainId)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${domainId}/fields/bulk`;
  const data = await handleApiResponse<{ fields: CareerApplicationField[] }>(
    await apiFetch(route, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
  );
  return data.fields ?? [];
}

export async function reorderCareerFields(
  domainId: string,
  order: { id: string; sort_order: number }[]
): Promise<CareerApplicationField[]> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELDS_REORDER === 'function'
      ? API_ROUTES.CAREERS_ADMIN_DOMAIN_FIELDS_REORDER(domainId)
      : `${API_ROUTES.CAREERS_ADMIN_DOMAINS}/${domainId}/fields/reorder`;
  const data = await handleApiResponse<{ fields: CareerApplicationField[] }>(
    await apiFetch(route, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
  );
  return data.fields ?? [];
}

export async function fetchCareerApplications(params?: {
  domainId?: string;
  status?: string;
  from?: string;
  to?: string;
  genderKey?: string;
  gender?: string;
  ageKey?: string;
  ageMin?: number | string;
  ageMax?: number | string;
  cityKey?: string;
  city?: string;
  nameKey?: string;
  name?: string;
  phoneKey?: string;
  phone?: string;
  page?: number;
  limit?: number;
}): Promise<{ applications: CareerApplication[]; total?: number }> {
  const q = new URLSearchParams();
  if (params?.domainId) q.set('domainId', params.domainId);
  if (params?.status) q.set('status', params.status);
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  if (params?.genderKey) q.set('genderKey', params.genderKey);
  if (params?.gender) q.set('gender', params.gender);
  if (params?.ageKey) q.set('ageKey', params.ageKey);
  if (params?.ageMin != null) q.set('ageMin', String(params.ageMin));
  if (params?.ageMax != null) q.set('ageMax', String(params.ageMax));
  if (params?.cityKey) q.set('cityKey', params.cityKey);
  if (params?.city) q.set('city', params.city);
  if (params?.nameKey) q.set('nameKey', params.nameKey);
  if (params?.name) q.set('name', params.name);
  if (params?.phoneKey) q.set('phoneKey', params.phoneKey);
  if (params?.phone) q.set('phone', params.phone);
  if (params?.page != null) q.set('page', String(params.page));
  if (params?.limit != null) q.set('limit', String(params.limit));
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_APPLICATIONS}?${q}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  return {
    applications: data.applications ?? [],
    total: data.total,
  };
}

export async function fetchCareerApplication(
  id: string
): Promise<{
  application: CareerApplication;
  domain: CareerDomain;
  fields: CareerApplicationField[];
  logs?: CareerApplicationLog[];
} | null> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_APPLICATION === 'function'
      ? API_ROUTES.CAREERS_ADMIN_APPLICATION(id)
      : `${API_ROUTES.CAREERS_ADMIN_APPLICATIONS}/${id}`;
  const url = `${base()}${route}`;
  const res = await fetch(url, { credentials: 'include' });
  if (res.status === 404) return null;
  const data = await handleApiResponse(res);
  return data;
}

export async function updateCareerApplicationStatus(
  id: string,
  status: 'new' | 'reviewed' | 'approved' | 'rejected'
): Promise<CareerApplication> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_APPLICATION === 'function'
      ? API_ROUTES.CAREERS_ADMIN_APPLICATION(id)
      : `${API_ROUTES.CAREERS_ADMIN_APPLICATIONS}/${id}`;
  const data = await handleApiResponse<{ application: CareerApplication }>(
    await apiFetch(route, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  );
  return data.application;
}

export async function fetchCareerApplicationLogs(
  id: string
): Promise<CareerApplicationLog[]> {
  const route =
    typeof API_ROUTES.CAREERS_ADMIN_APPLICATION_LOGS === 'function'
      ? API_ROUTES.CAREERS_ADMIN_APPLICATION_LOGS(id)
      : `${API_ROUTES.CAREERS_ADMIN_APPLICATIONS}/${id}/logs`;
  const url = `${base()}${route}`;
  const res = await fetch(url, { credentials: 'include' });
  const data = await handleApiResponse(res);
  return data.logs ?? [];
}

export async function fetchCareerApplicationsCompare(
  ids: string[]
): Promise<{
  applications: (CareerApplication & { domain?: CareerDomain })[];
} | null> {
  const url = `${base()}${API_ROUTES.CAREERS_ADMIN_APPLICATIONS_COMPARE}?ids=${ids.join(',')}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return null;
  const data = await handleApiResponse(res);
  return data;
}

export function getCareerApplicationsExportUrl(params: {
  domainId?: string;
  status?: string;
  from?: string;
  to?: string;
  genderKey?: string;
  gender?: string;
  ageKey?: string;
  ageMin?: number | string;
  ageMax?: number | string;
  cityKey?: string;
  city?: string;
  nameKey?: string;
  name?: string;
  phoneKey?: string;
  phone?: string;
  format?: 'xlsx' | 'csv';
}): string {
  const q = new URLSearchParams();
  if (params.domainId) q.set('domainId', params.domainId);
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.genderKey) q.set('genderKey', params.genderKey);
  if (params.gender) q.set('gender', params.gender);
  if (params.ageKey) q.set('ageKey', params.ageKey);
  if (params.ageMin != null) q.set('ageMin', String(params.ageMin));
  if (params.ageMax != null) q.set('ageMax', String(params.ageMax));
  if (params.cityKey) q.set('cityKey', params.cityKey);
  if (params.city) q.set('city', params.city);
  if (params.nameKey) q.set('nameKey', params.nameKey);
  if (params.name) q.set('name', params.name);
  if (params.phoneKey) q.set('phoneKey', params.phoneKey);
  if (params.phone) q.set('phone', params.phone);
  if (params.format) q.set('format', params.format);
  return `${base()}${API_ROUTES.CAREERS_ADMIN_APPLICATIONS_EXPORT}?${q}`;
}

/** Export career applications as Excel (xlsx). Fetches with credentials and triggers download. */
export async function exportCareerApplicationsToExcel(params: {
  domainId?: string;
  status?: string;
  from?: string;
  to?: string;
  genderKey?: string;
  gender?: string;
  ageKey?: string;
  ageMin?: number | string;
  ageMax?: number | string;
  cityKey?: string;
  city?: string;
  nameKey?: string;
  name?: string;
  phoneKey?: string;
  phone?: string;
}): Promise<void> {
  const url = getCareerApplicationsExportUrl({ ...params, format: 'xlsx' });
  const res = await fetch(url, { credentials: 'include' });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || data.message || `Export failed: ${res.status}`);
    }
    throw new Error(`Export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const filename = filenameMatch
    ? filenameMatch[1].replace(/['"]/g, '').trim()
    : 'career-applications.xlsx';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
