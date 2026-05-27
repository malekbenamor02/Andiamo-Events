'use strict';

const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} = require('@aws-sdk/client-s3');

/**
 * Cloudflare R2 (S3-compatible) + public CDN hostname.
 *
 * Env (server / Vercel):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   PUBLIC_ASSETS_BASE_URL   e.g. https://assets.example.com  (no trailing slash)
 *
 * Frontend (Vite): VITE_PUBLIC_ASSETS_BASE_URL — same value for URL helpers / srcset.
 */

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = (process.env.PUBLIC_ASSETS_BASE_URL || '').replace(/\/$/, '');
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBase };
}

function isR2MediaEnabled() {
  return getR2Config() !== null;
}

let _client;
function getClientContext() {
  const c = getR2Config();
  if (!c) return null;
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return { client: _client, bucket: c.bucket, publicBase: c.publicBase };
}

const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const FAVICON_CACHE = 'public, max-age=3600';

async function putPublicObject({ key, body, contentType, cacheControl }) {
  const ctx = getClientContext();
  if (!ctx) return null;
  await ctx.client.send(
    new PutObjectCommand({
      Bucket: ctx.bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
      CacheControl: cacheControl || IMMUTABLE_CACHE,
    })
  );
  return `${ctx.publicBase}/${key}`;
}

async function deleteObjectKey(key) {
  const ctx = getClientContext();
  if (!ctx) return false;
  await ctx.client.send(new DeleteObjectCommand({ Bucket: ctx.bucket, Key: key }));
  return true;
}

/** primaryKey e.g. posters/abc.webp → also removes .avif, _thumb.webp, _mid.webp (hero) */
async function deleteMediaImageVariants(primaryKey) {
  const ctx = getClientContext();
  if (!ctx) return false;
  if (!primaryKey.endsWith('.webp')) {
    try {
      await ctx.client.send(new DeleteObjectCommand({ Bucket: ctx.bucket, Key: primaryKey }));
    } catch (_) {
      /* ignore */
    }
    return true;
  }
  const base = primaryKey.slice(0, -5);
  const keys = [primaryKey, `${base}.avif`, `${base}_thumb.webp`, `${base}_mid.webp`];
  for (const k of keys) {
    try {
      await ctx.client.send(new DeleteObjectCommand({ Bucket: ctx.bucket, Key: k }));
    } catch (_) {
      /* ignore */
    }
  }
  return true;
}

async function listAndDeleteByPrefix(prefix) {
  const ctx = getClientContext();
  if (!ctx) return 0;
  let count = 0;
  let token;
  do {
    const out = await ctx.client.send(
      new ListObjectsV2Command({
        Bucket: ctx.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const objs = out.Contents || [];
    if (objs.length) {
      await ctx.client.send(
        new DeleteObjectsCommand({
          Bucket: ctx.bucket,
          Delete: { Objects: objs.map((o) => ({ Key: o.Key })) },
        })
      );
      count += objs.length;
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  return count;
}

/**
 * Upload ticket / invitation QR PNG. Uses R2 when configured, else Supabase tickets bucket.
 */
async function uploadTicketQrToR2OrSupabase(buffer, key, storageClient) {
  const url = await putPublicObject({
    key,
    body: buffer,
    contentType: 'image/png',
    cacheControl: IMMUTABLE_CACHE,
  });
  if (url) return url;
  if (!storageClient?.storage) throw new Error('No R2 config and no Supabase storage client');
  const { error } = await storageClient.storage.from('tickets').upload(key, buffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = storageClient.storage.from('tickets').getPublicUrl(key);
  return data.publicUrl;
}

module.exports = {
  isR2MediaEnabled,
  getClientContext,
  putPublicObject,
  deleteObjectKey,
  deleteMediaImageVariants,
  listAndDeleteByPrefix,
  uploadTicketQrToR2OrSupabase,
  IMMUTABLE_CACHE,
  FAVICON_CACHE,
};
