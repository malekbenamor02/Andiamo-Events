'use strict';

const crypto = require('crypto');
const path = require('path');

const BUCKET = 'career-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SEC = 900;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']);

const STORAGE_REF_PREFIX = 'storage:career-documents/';

function safeExt(originalName, mimetype) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (ALLOWED_EXT.has(ext)) return ext;
  if (mimetype === 'application/pdf') return '.pdf';
  if (mimetype === 'application/msword') return '.doc';
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return '.docx';
  }
  if (mimetype === 'image/jpeg') return '.jpg';
  if (mimetype === 'image/png') return '.png';
  return null;
}

function validateCareerDocumentFile(file) {
  if (!file || !file.buffer) return { ok: false, error: 'No file' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'File too large (max 10 MB)' };
  const mime = String(file.mimetype || '').toLowerCase();
  const ext = safeExt(file.originalname, mime);
  if (!ext || !ALLOWED_MIME.has(mime)) {
    return { ok: false, error: 'Unsupported file type' };
  }
  const blocked = ['.html', '.htm', '.svg', '.js', '.exe', '.zip', '.bat', '.sh'];
  if (blocked.includes(ext)) return { ok: false, error: 'Unsupported file type' };
  return { ok: true, ext, mime };
}

function buildStoragePath(ext) {
  const id = crypto.randomUUID();
  const rand = crypto.randomBytes(8).toString('hex');
  return `${id}/${rand}${ext}`;
}

function encodeStorageRef(storagePath, originalFilename) {
  const safeName = String(originalFilename || 'document')
    .replace(/[|]/g, '_')
    .slice(0, 120);
  return `${STORAGE_REF_PREFIX}${storagePath}|${safeName}`;
}

function parseStorageRef(value) {
  if (!value || typeof value !== 'string') return null;
  if (!value.startsWith(STORAGE_REF_PREFIX)) return null;
  const rest = value.slice(STORAGE_REF_PREFIX.length);
  const pipe = rest.indexOf('|');
  const storagePath = pipe >= 0 ? rest.slice(0, pipe) : rest;
  const originalFilename = pipe >= 0 ? rest.slice(pipe + 1) : 'document';
  if (!storagePath || storagePath.includes('..')) return null;
  return { bucket: BUCKET, path: storagePath, originalFilename };
}

function parseLegacyCareerPublicUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (!value.includes('career-documents')) return null;
  try {
    const u = new URL(value);
    const marker = '/career-documents/';
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const storagePath = decodeURIComponent(u.pathname.slice(idx + marker.length));
    if (!storagePath || storagePath.includes('..')) return null;
    const base = storagePath.split('/').pop() || 'document';
    return { bucket: BUCKET, path: storagePath, originalFilename: base };
  } catch (_) {
    return null;
  }
}

function resolveCareerDocumentRef(value) {
  return parseStorageRef(value) || parseLegacyCareerPublicUrl(value);
}

async function uploadCareerDocument(db, file) {
  const v = validateCareerDocumentFile(file);
  if (!v.ok) return { error: v.error };
  const storagePath = buildStoragePath(v.ext);
  const { error } = await db.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: v.mime,
    upsert: false,
  });
  if (error) return { error: error.message || 'Upload failed' };
  return {
    bucket: BUCKET,
    path: storagePath,
    originalFilename: String(file.originalname || 'document').slice(0, 120),
    mimeType: v.mime,
    size: file.size,
    storageRef: encodeStorageRef(storagePath, file.originalname),
  };
}

async function createCareerDocumentSignedUrl(db, storagePath, expiresInSec = SIGNED_URL_TTL_SEC) {
  if (!storagePath || storagePath.includes('..')) return null;
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function signedUrlForFormValue(db, formValue) {
  const ref = resolveCareerDocumentRef(formValue);
  if (!ref) return null;
  return createCareerDocumentSignedUrl(db, ref.path);
}

module.exports = {
  BUCKET,
  MAX_BYTES,
  SIGNED_URL_TTL_SEC,
  STORAGE_REF_PREFIX,
  validateCareerDocumentFile,
  encodeStorageRef,
  parseStorageRef,
  resolveCareerDocumentRef,
  uploadCareerDocument,
  createCareerDocumentSignedUrl,
  signedUrlForFormValue,
};
