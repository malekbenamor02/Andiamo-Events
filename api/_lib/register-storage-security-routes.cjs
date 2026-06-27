'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { registerTicketQrRoute } = require('./ticket-qr-route.cjs');
const {
  uploadCareerDocument,
  MAX_BYTES: CAREER_MAX_BYTES,
  signedUrlForFormValue,
  resolveCareerDocumentRef,
} = require('./career-document-storage.cjs');
const {
  isR2MediaEnabled,
  putPublicObject,
  deleteMediaImageVariants,
  listAndDeleteByPrefix,
  FAVICON_CACHE,
  getClientContext,
} = require('./r2-media.cjs');

function getMediaImagePipeline() {
  return require('./media-image-pipeline.cjs');
}

const IMAGE_FOLDERS = new Set([
  'posters',
  'sponsors',
  'gallery',
  'campaign-email',
  'seating-charts',
  'marketing-email-attachments',
  'favicon',
]);
const ALLOWED_BUCKETS = new Set(['images', 'hero-images']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const careerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CAREER_MAX_BYTES },
});

function multerSingle(field, limiter = upload) {
  return (req, res, next) => {
    limiter.single(field)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        return next(err);
      }
      next();
    });
  };
}

function getServiceDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function getPublicObjectUrl(bucket, objectPath) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const clean = String(objectPath || '').replace(/^\/+/, '');
  return `${base}/storage/v1/object/public/${bucket}/${clean}`;
}

function safeExt(filename) {
  const e = path.extname(filename || '').replace(/^\./, '').toLowerCase();
  return e || 'bin';
}

function publicUrlForR2Key(key) {
  const ctx = getClientContext();
  if (!ctx) return null;
  return `${ctx.publicBase}/${key}`;
}

async function uploadToSupabasePublicBucket(db, bucket, key, buffer, contentType, cacheControl) {
  const { error } = await db.storage.from(bucket).upload(key, buffer, {
    contentType: contentType || 'application/octet-stream',
    cacheControl: cacheControl || '31536000',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return { url: getPublicObjectUrl(bucket, key), path: key, bucket };
}

async function deleteFromSupabaseBucket(db, bucket, key) {
  if (!key || key.includes('..')) throw new Error('Invalid path');
  const { error } = await db.storage.from(bucket).remove([key]);
  if (error) throw new Error(error.message);
}

function registerStorageSecurityRoutes(app, deps = {}) {
  const requireAdminAuth = deps.requireAdminAuth;
  const requireAdminPermission = deps.requireAdminPermission;
  const getDb = deps.getServiceDb || getServiceDb;

  if (!requireAdminAuth || !requireAdminPermission) {
    throw new Error('registerStorageSecurityRoutes requires requireAdminAuth and requireAdminPermission');
  }

  registerTicketQrRoute(app, getDb);

  app.post('/api/media/favicon/cleanup', requireAdminAuth, async (req, res) => {
    try {
      const faviconType = String(req.body?.faviconType || '').trim();
      if (!faviconType || !/^[a-z0-9_]+$/i.test(faviconType)) {
        return res.status(400).json({ error: 'Invalid faviconType' });
      }
      if (isR2MediaEnabled()) {
        const prefix = `favicon/${faviconType}_`;
        const n = await listAndDeleteByPrefix(prefix);
        return res.json({ deleted: n });
      }
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Storage not configured' });
      const prefixFolder = 'favicon';
      const { data, error } = await db.storage.from('images').list(prefixFolder, { search: faviconType });
      if (error) throw error;
      const paths = (data || [])
        .filter((f) => f.name.startsWith(`${faviconType}_`))
        .map((f) => `${prefixFolder}/${f.name}`);
      if (paths.length) {
        const { error: delErr } = await db.storage.from('images').remove(paths);
        if (delErr) throw delErr;
      }
      return res.json({ deleted: paths.length });
    } catch (e) {
      console.error('[media] favicon cleanup', e.message);
      return res.status(500).json({ error: e.message || 'cleanup failed' });
    }
  });

  app.post('/api/careers/upload-document', (req, res, next) => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    next();
  }, multerSingle('file', careerUpload), async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'No file' });
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Service unavailable' });
      const result = await uploadCareerDocument(db, req.file);
      if (result.error) return res.status(400).json({ error: result.error });
      return res.json({
        storageRef: result.storageRef,
        bucket: result.bucket,
        path: result.path,
        originalFilename: result.originalFilename,
        mimeType: result.mimeType,
        size: result.size,
      });
    } catch (e) {
      console.error('[careers/upload-document]', e.message);
      return res.status(500).json({ error: 'Upload failed' });
    }
  });

  app.get(
    '/api/admin/careers/applications/:id/document-url',
    requireAdminAuth,
    requireAdminPermission('careers:manage'),
    async (req, res) => {
      try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Service unavailable' });
        const fieldKey = String(req.query.field || '').trim();
        if (!fieldKey) return res.status(400).json({ error: 'field is required' });
        const { data: application, error } = await db
          .from('career_applications')
          .select('form_data')
          .eq('id', req.params.id)
          .maybeSingle();
        if (error || !application) return res.status(404).json({ error: 'Not found' });
        const value = application.form_data?.[fieldKey];
        const ref = resolveCareerDocumentRef(value);
        if (!ref) return res.status(404).json({ error: 'Document not found for field' });
        const signedUrl = await signedUrlForFormValue(db, value);
        if (!signedUrl) return res.status(500).json({ error: 'Could not create signed URL' });
        return res.json({ signedUrl, originalFilename: ref.originalFilename });
      } catch (e) {
        console.error('[admin/careers/document-url]', e.message);
        return res.status(500).json({ error: 'Server error' });
      }
    }
  );

  async function handleAdminMediaUpload(req, res) {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'No file' });
      const { processRasterToWebpAvif, shouldEncodeToWebpAvif } = getMediaImagePipeline();
      const scope = String(req.body?.scope || 'images').trim();
      const folder = String(req.body?.folder || 'posters').trim();
      const bucket = scope === 'hero' ? 'hero-images' : 'images';
      const mimetype = req.file.mimetype || 'application/octet-stream';
      const ext = safeExt(req.file.originalname);
      const rand = crypto.randomBytes(5).toString('hex');

      if (scope === 'favicon' || (scope === 'images' && folder === 'favicon')) {
        const faviconType = String(req.body?.faviconType || 'asset')
          .replace(/[^a-z0-9_]/gi, '_')
          .slice(0, 48);
        const key = `favicon/${faviconType}_${Date.now()}_${rand}.${ext}`;
        if (isR2MediaEnabled()) {
          const url = await putPublicObject({
            key,
            body: req.file.buffer,
            contentType: mimetype,
            cacheControl: FAVICON_CACHE,
          });
          if (!url) return res.status(503).json({ error: 'R2 unavailable' });
          return res.json({ url, path: key, bucket: 'images' });
        }
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'Storage not configured' });
        const out = await uploadToSupabasePublicBucket(db, 'images', key, req.file.buffer, mimetype, '3600');
        return res.json(out);
      }

      if (scope === 'hero') {
        const db = getDb();
        if (isR2MediaEnabled()) {
          if (mimetype.startsWith('video/')) {
            const ve = ext === 'webm' ? 'webm' : ext === 'mov' ? 'mov' : 'mp4';
            const key = `hero/${Date.now()}_${rand}.${ve}`;
            const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
            if (!url) return res.status(503).json({ error: 'R2 unavailable' });
            return res.json({ url, path: key, bucket: 'hero-images' });
          }
          if (shouldEncodeToWebpAvif(mimetype, ext)) {
            const { fullWebp, thumbWebp, midWebp, avifBuffer, contentHash } =
              await processRasterToWebpAvif(req.file.buffer, { includeMidForHero: true });
            const idBase = `hero/${Date.now()}_${rand}_${contentHash}`;
            const webpKey = `${idBase}.webp`;
            const url = await putPublicObject({ key: webpKey, body: fullWebp, contentType: 'image/webp' });
            await putPublicObject({ key: `${idBase}_thumb.webp`, body: thumbWebp, contentType: 'image/webp' });
            if (midWebp) {
              await putPublicObject({ key: `${idBase}_mid.webp`, body: midWebp, contentType: 'image/webp' });
            }
            if (avifBuffer) {
              await putPublicObject({ key: `${idBase}.avif`, body: avifBuffer, contentType: 'image/avif' });
            }
            return res.json({
              url,
              path: webpKey,
              bucket: 'hero-images',
              thumbUrl: publicUrlForR2Key(`${idBase}_thumb.webp`),
              midUrl: midWebp ? publicUrlForR2Key(`${idBase}_mid.webp`) : null,
              avifUrl: avifBuffer ? publicUrlForR2Key(`${idBase}.avif`) : null,
            });
          }
          const key = `hero/${Date.now()}_${rand}.${ext || 'bin'}`;
          const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
          if (!url) return res.status(503).json({ error: 'R2 unavailable' });
          return res.json({ url, path: key, bucket: 'hero-images' });
        }
        if (!db) return res.status(503).json({ error: 'Storage not configured' });
        const heroKey = `${Date.now()}_${rand}.${ext || 'webp'}`;
        const out = await uploadToSupabasePublicBucket(
          db,
          'hero-images',
          heroKey,
          req.file.buffer,
          mimetype
        );
        return res.json(out);
      }

      if (scope === 'images') {
        if (!IMAGE_FOLDERS.has(folder)) {
          return res.status(400).json({ error: 'Invalid folder' });
        }
        const db = getDb();
        if (isR2MediaEnabled()) {
          if (shouldEncodeToWebpAvif(mimetype, ext)) {
            const { fullWebp, thumbWebp, avifBuffer, contentHash } = await processRasterToWebpAvif(
              req.file.buffer
            );
            const idBase = `${folder}/${Date.now()}_${rand}_${contentHash}`;
            const webpKey = `${idBase}.webp`;
            const url = await putPublicObject({ key: webpKey, body: fullWebp, contentType: 'image/webp' });
            await putPublicObject({ key: `${idBase}_thumb.webp`, body: thumbWebp, contentType: 'image/webp' });
            if (avifBuffer) {
              await putPublicObject({ key: `${idBase}.avif`, body: avifBuffer, contentType: 'image/avif' });
            }
            return res.json({
              url,
              path: webpKey,
              bucket: 'images',
              thumbUrl: publicUrlForR2Key(`${idBase}_thumb.webp`),
              avifUrl: avifBuffer ? publicUrlForR2Key(`${idBase}.avif`) : null,
            });
          }
          const key = `${folder}/${Date.now()}_${rand}.${ext || 'bin'}`;
          const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
          if (!url) return res.status(503).json({ error: 'R2 unavailable' });
          return res.json({ url, path: key, bucket: 'images' });
        }
        if (!db) return res.status(503).json({ error: 'Storage not configured' });
        const imgKey = `${folder}/${Date.now()}_${rand}.${ext || 'bin'}`;
        const out = await uploadToSupabasePublicBucket(db, 'images', imgKey, req.file.buffer, mimetype);
        return res.json(out);
      }

      return res.status(400).json({ error: 'Invalid scope' });
    } catch (e) {
      console.error('[admin/media/upload]', e.message);
      return res.status(500).json({ error: e.message || 'Upload failed' });
    }
  }

  async function handleAdminMediaDelete(req, res) {
    try {
      const bucket = String(req.body?.bucket || 'images').trim();
      const objectPath = String(req.body?.path || req.body?.key || '').trim();
      if (!ALLOWED_BUCKETS.has(bucket)) return res.status(400).json({ error: 'Invalid bucket' });
      if (!objectPath || objectPath.includes('..')) return res.status(400).json({ error: 'Invalid path' });

      if (isR2MediaEnabled()) {
        await deleteMediaImageVariants(objectPath);
        return res.json({ ok: true });
      }
      const db = getDb();
      if (!db) return res.status(503).json({ error: 'Storage not configured' });
      await deleteFromSupabaseBucket(db, bucket, objectPath);
      return res.json({ ok: true });
    } catch (e) {
      console.error('[admin/media/delete]', e.message);
      return res.status(500).json({ error: e.message || 'Delete failed' });
    }
  }

  app.post('/api/admin/media/upload', requireAdminAuth, multerSingle('file'), handleAdminMediaUpload);
  app.post('/api/media/upload', requireAdminAuth, multerSingle('file'), handleAdminMediaUpload);

  app.post('/api/admin/media/delete', requireAdminAuth, handleAdminMediaDelete);
  app.post('/api/media/delete', requireAdminAuth, handleAdminMediaDelete);
}

module.exports = { registerStorageSecurityRoutes, getServiceDb, getPublicObjectUrl };
