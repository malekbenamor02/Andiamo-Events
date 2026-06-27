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

export async function requireAdmin(req, res, verifyAdminAuth, permissionKey) {
  const authResult = await verifyAdminAuth(req);
  if (!authResult.valid) {
    jsonAuthFailure(res, authResult);
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
