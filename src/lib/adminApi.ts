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

  fetchDashboardBootstrap: () => adminFetch(API_ROUTES.ADMIN_DASHBOARD_BOOTSTRAP),

  listAmbassadors: () =>
    adminFetch(API_ROUTES.ADMIN_AMBASSADORS).then((r: { data?: unknown[] }) => r.data || []),

  updateApplication: (payload: {
    applicationId: string;
    status: 'approved' | 'rejected';
    reapply_delay_date?: string | null;
    /** Plaintext temporary password (HTTPS only); server hashes before storage */
    temporaryPassword?: string;
    /** Server generates password and returns temporaryPassword once */
    generatePassword?: boolean;
  }) =>
    adminFetch(API_ROUTES.ADMIN_UPDATE_APPLICATION, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createAmbassador: (payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_AMBASSADORS, { method: 'POST', body: JSON.stringify(payload) }).then(
      (r: { data: unknown; temporaryPassword?: string }) => ({
        data: r.data,
        temporaryPassword: r.temporaryPassword,
      }),
    ),

  updateAmbassador: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_AMBASSADOR(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((r: { data: unknown; temporaryPassword?: string }) => ({
      data: r.data,
      temporaryPassword: r.temporaryPassword,
    })),

  deleteAmbassador: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_AMBASSADOR(id), { method: 'DELETE' }),

  listAmbassadorApplications: () =>
    adminFetch(API_ROUTES.ADMIN_AMBASSADOR_APPLICATIONS).then((r: { data?: unknown[] }) => r.data || []),

  listContactMessages: () =>
    adminFetch(API_ROUTES.ADMIN_CONTACT_MESSAGES).then((r: { data?: unknown[] }) => r.data || []),

  updateContactMessage: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_CONTACT_MESSAGE(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((r: { data: unknown }) => r.data),

  deleteContactMessage: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_CONTACT_MESSAGE(id), { method: 'DELETE' }),

  listPhoneSubscribers: () =>
    adminFetch(API_ROUTES.ADMIN_SUBSCRIBERS_PHONES).then((r: { data?: unknown[] }) => r.data || []),

  updatePhoneSubscriber: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_SUBSCRIBER_PHONE(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((r: { data: unknown }) => r.data),

  deletePhoneSubscriber: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_SUBSCRIBER_PHONE(id), { method: 'DELETE' }),

  listNewsletterSubscribers: () =>
    adminFetch(API_ROUTES.ADMIN_SUBSCRIBERS_NEWSLETTERS).then((r: { data?: unknown[] }) => r.data || []),

  updateNewsletterSubscriber: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_SUBSCRIBER_NEWSLETTER(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((r: { data: unknown }) => r.data),

  deleteNewsletterSubscriber: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_SUBSCRIBER_NEWSLETTER(id), { method: 'DELETE' }),

  listAudienceSuggestions: () =>
    adminFetch(API_ROUTES.ADMIN_AUDIENCE_SUGGESTIONS).then((r: { data?: unknown[] }) => r.data || []),

  updateAudienceSuggestion: (id: string, payload: Record<string, unknown>) =>
    adminFetch(API_ROUTES.ADMIN_AUDIENCE_SUGGESTION(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }).then((r: { data: unknown }) => r.data),

  deleteAudienceSuggestion: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_AUDIENCE_SUGGESTION(id), { method: 'DELETE' }),

  listSmsLogs: (limit = 200) =>
    adminFetch(`${API_ROUTES.ADMIN_SMS_LOGS}?limit=${limit}`).then((r: { data?: unknown[] }) => r.data || []),

  listSiteLogs: (limit = 200) =>
    adminFetch(`${API_ROUTES.ADMIN_SITE_LOGS}?limit=${limit}`).then((r: { data?: unknown[] }) => r.data || []),

  listOrderPassesByPassIds: (passIds: string[]) => {
    if (passIds.length === 0) return Promise.resolve([]);
    const qs = passIds.map(encodeURIComponent).join(',');
    return adminFetch(`${API_ROUTES.ADMIN_ORDER_PASSES}?pass_ids=${qs}`).then(
      (r: { data?: unknown[] }) => r.data || []
    );
  },
};
