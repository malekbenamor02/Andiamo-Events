import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from '@/lib/api-routes';

async function adminFetch(path: string, init?: RequestInit) {
  const url = buildFullApiUrl(path, getApiBaseUrl());
  if (!url) throw new Error('API URL not configured');
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.details || `Request failed (${response.status})`);
  }
  return body;
}

export const adminApi = {
  listAdmins: () => adminFetch(API_ROUTES.ADMIN_ADMINS),
  createAdmin: (payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_ADMINS, { method: 'POST', body: JSON.stringify(payload) }),
  updateAdmin: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_ADMIN(id), { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteAdmin: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_ADMIN(id), { method: 'DELETE' }),

  listSponsors: () => adminFetch(API_ROUTES.ADMIN_SPONSORS),
  createSponsor: (payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_SPONSORS, { method: 'POST', body: JSON.stringify(payload) }),
  updateSponsor: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_SPONSOR(id), { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSponsor: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_SPONSOR(id), { method: 'DELETE' }),

  listTeamMembers: () => adminFetch(API_ROUTES.ADMIN_TEAM_MEMBERS),
  createTeamMember: (payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_TEAM_MEMBERS, { method: 'POST', body: JSON.stringify(payload) }),
  updateTeamMember: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_TEAM_MEMBER(id), { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteTeamMember: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_TEAM_MEMBER(id), { method: 'DELETE' }),

  deletePass: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_PASS_DELETE(id), { method: 'DELETE' }),
};
