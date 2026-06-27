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
    const msg = [body.error, body.details].filter(Boolean).join(': ') || `Request failed (${response.status})`;
    throw new Error(msg);
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

  listApplicationSelections: (includeArchived = false) =>
    adminFetch(
      `${API_ROUTES.ADMIN_APPLICATION_SELECTIONS}?include_archived=${includeArchived ? '1' : '0'}`,
    ).then((r: { data?: unknown[] }) => r.data || []),

  createApplicationSelection: (name: string) =>
    adminFetch(API_ROUTES.ADMIN_APPLICATION_SELECTIONS, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then((r: { data: unknown }) => r.data),

  archiveApplicationSelection: (id: string) =>
    adminFetch(API_ROUTES.ADMIN_APPLICATION_SELECTION(id), {
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    }).then((r: { data: unknown }) => r.data),

  listApplicationSelectionItems: (selectionId: string) =>
    adminFetch(
      `${API_ROUTES.ADMIN_APPLICATION_SELECTION_ITEMS}?selection_id=${encodeURIComponent(selectionId)}`,
    ).then((r: { data?: unknown[] }) => r.data || []),

  addApplicationsToSelection: (selectionId: string, applicationIds: string[]) =>
    adminFetch(API_ROUTES.ADMIN_APPLICATION_SELECTION_ITEMS, {
      method: 'POST',
      body: JSON.stringify({ selection_id: selectionId, application_ids: applicationIds }),
    }).then((r: { data?: unknown[]; added?: number; skipped?: number }) => r),

  removeApplicationFromSelection: (selectionId: string, applicationId: string) =>
    adminFetch(API_ROUTES.ADMIN_APPLICATION_SELECTION_ITEM(applicationId, selectionId), {
      method: 'DELETE',
    }),

  removeApplicationsFromSelection: (selectionId: string, applicationIds: string[]) =>
    adminFetch(API_ROUTES.ADMIN_APPLICATION_SELECTION_ITEMS_REMOVE, {
      method: 'POST',
      body: JSON.stringify({ selection_id: selectionId, application_ids: applicationIds }),
    }).then((r: { removed?: number }) => r.removed ?? applicationIds.length),

  changePassword: (currentPassword: string, newPassword: string) =>
    adminFetch(API_ROUTES.ADMIN_CHANGE_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
