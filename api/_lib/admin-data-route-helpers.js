/**
 * Helpers for admin data routes: permissions, field allowlists, password hashing.
 */
import { hasEffectivePermission } from './admin-authorization.mjs';
import { createServiceRoleClient, requireServiceRoleClient } from './service-role-client.js';
import { randomBytes } from 'crypto';

/** Route → permission key (matches shared/admin/tabDefinitions.data.json) */
export const ADMIN_DATA_ROUTE_PERMISSIONS = {
  DASHBOARD_BOOTSTRAP: 'dashboard:view',
  AMBASSADORS: 'ambassadors:manage',
  APPLICATIONS: 'applications:manage',
  CONTACT_MESSAGES: 'contact:view',
  SUBSCRIBERS: 'marketing:manage',
  AUDIENCE_SUGGESTIONS: 'suggestions:manage',
  LOGS: 'logs:view',
  ORDER_PASSES: 'orders:manage',
};

export const AMBASSADOR_WRITABLE_FIELDS = [
  'full_name',
  'phone',
  'email',
  'city',
  'ville',
  'extra_villes',
  'status',
  'requires_password_change',
];

/** Plaintext password or generatePassword flag — never accept bcrypt hash from client */
export const AMBASSADOR_PASSWORD_INPUT_FIELDS = ['password', 'generatePassword'];

export const CONTACT_MESSAGE_UPDATE_FIELDS = ['status', 'notes'];
export const PHONE_SUBSCRIBER_UPDATE_FIELDS = ['import_label'];
export const NEWSLETTER_SUBSCRIBER_UPDATE_FIELDS = ['import_label'];
export const AUDIENCE_SUGGESTION_UPDATE_FIELDS = ['read_at'];

export const APPLICATION_SELECTION_WRITABLE_FIELDS = ['name', 'status'];
export const APPLICATION_SELECTION_ITEM_WRITABLE_FIELDS = ['selection_id', 'application_id'];
export const APPLICATION_SELECTION_ITEM_BULK_FIELDS = ['selection_id', 'application_ids'];
export const APPLICATION_SELECTION_ITEM_REMOVE_BULK_FIELDS = ['selection_id', 'application_ids'];

export const SITE_LOG_CLIENT_FIELDS = [
  'log_type',
  'category',
  'message',
  'details',
  'user_type',
  'page_url',
  'request_method',
  'request_path',
  'response_status',
  'error_stack',
];

function jsonAuthFailure(res, authResult) {
  return res.status(authResult.statusCode || 401).json({
    error: authResult.error,
    reason: authResult.reason || 'Authentication failed',
    valid: false,
  });
}

export function jsonForbidden(res, message = 'Insufficient permissions') {
  return res.status(403).json({ error: message, reason: 'forbidden' });
}

export function jsonBadRequest(res, message, details) {
  return res.status(400).json({ error: message, ...(details ? { details } : {}) });
}

export function pickAllowedFields(payload, allowedFields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const out = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      out[key] = payload[key];
    }
  }
  return out;
}

export function findUnexpectedFields(payload, allowedFields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const allowed = new Set(allowedFields);
  return Object.keys(payload).filter((k) => !allowed.has(k));
}

export function rejectUnexpectedFields(res, payload, allowedFields) {
  const unexpected = findUnexpectedFields(payload, allowedFields);
  if (unexpected.length === 0) return false;
  jsonBadRequest(
    res,
    'Unexpected fields in request body',
    `Disallowed: ${unexpected.join(', ')}`,
  );
  return true;
}

export function requireAdminPermission(authResult, permissionKey) {
  const perms = authResult?.permissions || [];
  return hasEffectivePermission(perms, permissionKey);
}

export async function requireAdmin(req, res, verifyAdminAuth, permissionKey, opts = {}) {
  const authResult = await verifyAdminAuth(req);
  if (!authResult.valid) {
    jsonAuthFailure(res, authResult);
    return null;
  }
  if (authResult.requiresPasswordChange && !opts.skipPasswordChangeGate) {
    res.status(403).json({
      error: 'Password change required',
      reason: 'password_change_required',
      requiresPasswordChange: true,
    });
    return null;
  }
  if (permissionKey && !requireAdminPermission(authResult, permissionKey)) {
    jsonForbidden(res);
    return null;
  }
  const env = requireServiceRoleClient(res);
  if (!env) return null;
  const db = await createServiceRoleClient();
  return { auth: authResult, db, permissions: authResult.permissions || [] };
}

export function generateTemporaryPassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Reject values that look like bcrypt hashes sent from the browser */
export function looksLikeBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPasswordServerSide(plain) {
  const bcrypt = (await import('bcryptjs')).default;
  return bcrypt.hash(String(plain), 10);
}

/**
 * Resolve ambassador password from body: generatePassword flag or plaintext password.
 * Returns { hash, temporaryPassword } or throws on invalid input.
 */
export async function resolveAmbassadorPasswordFromBody(body) {
  if (body.generatePassword === true) {
    const temporaryPassword = generateTemporaryPassword();
    const hash = await hashPasswordServerSide(temporaryPassword);
    return { hash, temporaryPassword };
  }
  if (body.password != null && String(body.password).trim() !== '') {
    const plain = String(body.password);
    if (looksLikeBcryptHash(plain)) {
      throw new Error('Pre-hashed passwords are not accepted; send plaintext or generatePassword');
    }
    if (plain.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    const hash = await hashPasswordServerSide(plain);
    return { hash, temporaryPassword: plain };
  }
  return { hash: null, temporaryPassword: null };
}

/** Ambassador PATCH fields mirrored to ambassador_applications (when both exist). */
export const AMBASSADOR_TO_APPLICATION_SYNC_FIELDS = {
  full_name: 'full_name',
  phone: 'phone_number',
  email: 'email',
  city: 'city',
  ville: 'ville',
};

export const ACTIVE_APPLICATION_CONTACT_STATUSES = ['pending', 'approved'];

/**
 * Build ambassador_applications patch from normalized ambassador row fields present in the update.
 */
export function buildApplicationSyncPatchFromAmbassadorRow(ambassadorRowPatch) {
  if (!ambassadorRowPatch || typeof ambassadorRowPatch !== 'object') return {};
  const patch = {};
  for (const [ambField, appField] of Object.entries(AMBASSADOR_TO_APPLICATION_SYNC_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(ambassadorRowPatch, ambField)) {
      patch[appField] = ambassadorRowPatch[ambField];
    }
  }
  return patch;
}

export function isPostgresUniqueViolation(error) {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = String(error.message || '');
  return /unique constraint|duplicate key/i.test(msg);
}

export async function findLatestApprovedApplicationByPhone(db, phone) {
  if (!phone) return null;
  const { data, error } = await db
    .from('ambassador_applications')
    .select('id, phone_number, email, full_name, city, ville, status, created_at')
    .eq('status', 'approved')
    .eq('phone_number', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Returns a conflicting application row id, if any, for pending/approved contact fields.
 * @param {'email'|'phone'} field
 */
export async function findApplicationContactConflict(db, { field, value, excludeApplicationId }) {
  const normalized = field === 'phone' ? String(value || '').replace(/\D/g, '') : String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  const column = field === 'phone' ? 'phone_number' : 'email';
  let query = db
    .from('ambassador_applications')
    .select('id')
    .in('status', ACTIVE_APPLICATION_CONTACT_STATUSES)
    .eq(column, normalized)
    .limit(1);
  if (excludeApplicationId) {
    query = query.neq('id', excludeApplicationId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0] || null;
}

export async function validateApplicationSyncConflicts(db, { syncPatch, linkedApplicationId }) {
  if (syncPatch.email != null) {
    const conflict = await findApplicationContactConflict(db, {
      field: 'email',
      value: syncPatch.email,
      excludeApplicationId: linkedApplicationId,
    });
    if (conflict) {
      return { ok: false, message: 'An application with this email already exists' };
    }
  }
  if (syncPatch.phone_number != null) {
    const conflict = await findApplicationContactConflict(db, {
      field: 'phone',
      value: syncPatch.phone_number,
      excludeApplicationId: linkedApplicationId,
    });
    if (conflict) {
      return { ok: false, message: 'An application with this phone number already exists' };
    }
  }
  return { ok: true };
}

export async function buildAmbassadorWritePayload(body, { allowStatus = true, adminId = null } = {}) {
  const allowed = [...AMBASSADOR_WRITABLE_FIELDS, ...AMBASSADOR_PASSWORD_INPUT_FIELDS];
  const picked = pickAllowedFields(body, allowed);

  const row = {};
  if (picked.full_name != null) row.full_name = String(picked.full_name).trim();
  if (picked.phone != null) row.phone = String(picked.phone).replace(/\D/g, '');
  if (picked.email != null) row.email = String(picked.email).trim().toLowerCase();
  if (picked.city != null) row.city = String(picked.city).trim();
  if (picked.ville !== undefined) row.ville = picked.ville == null ? null : String(picked.ville).trim() || null;
  if (picked.extra_villes !== undefined) {
    row.extra_villes = Array.isArray(picked.extra_villes) ? picked.extra_villes : [];
  }
  if (allowStatus && picked.status != null) row.status = picked.status;
  if (picked.requires_password_change !== undefined) {
    row.requires_password_change = !!picked.requires_password_change;
  }

  let temporaryPassword = null;
  if (picked.generatePassword === true || picked.password != null) {
    const resolved = await resolveAmbassadorPasswordFromBody(picked);
    if (resolved.hash) row.password = resolved.hash;
    temporaryPassword = resolved.temporaryPassword;
  }

  if (adminId && row.status === 'approved' && !row.approved_by) {
    row.approved_by = adminId;
    row.approved_at = new Date().toISOString();
  }

  return { row, temporaryPassword };
}
