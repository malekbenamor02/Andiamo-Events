'use strict';

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const {
  isR2MediaEnabled,
  putPublicObject,
  deleteMediaImageVariants,
  listAndDeleteByPrefix,
  FAVICON_CACHE,
  getClientContext,
} = require('./r2-media.cjs');
const { processRasterToWebpAvif, shouldEncodeToWebpAvif } = require('./media-image-pipeline.cjs');

const IMAGE_FOLDERS = new Set(['posters', 'sponsors', 'gallery', 'campaign-email']);
const CAREER_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 45 * 1024 * 1024 },
});

function multerSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
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

function safeExt(filename) {
  const e = path.extname(filename || '').replace(/^\./, '').toLowerCase();
  return e || 'bin';
}

function publicUrlForKey(key) {
  const ctx = getClientContext();
  if (!ctx) return null;
  return `${ctx.publicBase}/${key}`;
}

function requireR2(req, res, next) {
  if (!isR2MediaEnabled()) {
    return res.status(503).json({ error: 'R2 media not configured', code: 'R2_DISABLED' });
  }
  next();
}

function registerMediaRoutes(app, { requireAdminAuth, requireAdminPermission }) {
  if (!requireAdminAuth || !requireAdminPermission) {
    throw new Error('registerMediaRoutes requires requireAdminAuth and requireAdminPermission');
  }
  if (!isR2MediaEnabled()) {
    console.warn('[media] R2 env not set — /api/media/* returns 503 until R2_* and PUBLIC_ASSETS_BASE_URL are set.');
  }

  app.post('/api/media/favicon/cleanup', requireAdminAuth, requireAdminPermission('settings:manage'), requireR2, async (req, res) => {
    try {
      const faviconType = String(req.body?.faviconType || '').trim();
      if (!faviconType || !/^[a-z0-9_]+$/i.test(faviconType)) {
        return res.status(400).json({ error: 'Invalid faviconType' });
      }
      const prefix = `favicon/${faviconType}_`;
      const n = await listAndDeleteByPrefix(prefix);
      return res.json({ deleted: n });
    } catch (e) {
      console.error('[media] favicon cleanup', e);
      return res.status(500).json({ error: e.message || 'cleanup failed' });
    }
  });

  app.post('/api/media/upload', requireAdminAuth, requireAdminPermission('settings:manage'), requireR2, multerSingle('file'), async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ error: 'No file' });
      const scope = String(req.body?.scope || '').trim();
      const folder = String(req.body?.folder || '').trim();
      const mimetype = req.file.mimetype || 'application/octet-stream';
      const ext = safeExt(req.file.originalname);
      const rand = crypto.randomBytes(5).toString('hex');

      if (scope === 'favicon') {
        const faviconType = String(req.body?.faviconType || 'asset')
          .replace(/[^a-z0-9_]/gi, '_')
          .slice(0, 48);
        const key = `favicon/${faviconType}_${Date.now()}_${rand}.${ext}`;
        const url = await putPublicObject({
          key,
          body: req.file.buffer,
          contentType: mimetype,
          cacheControl: FAVICON_CACHE,
        });
        if (!url) return res.status(503).json({ error: 'R2 unavailable' });
        return res.json({ url, path: key });
      }

      if (scope === 'career') {
        if (!CAREER_TYPES.has(mimetype)) {
          return res.status(400).json({ error: 'Unsupported document type' });
        }
        const safeName = String(req.body?.safeName || req.file.originalname || 'document')
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .slice(0, 120);
        const key = `career-documents/${Date.now()}_${rand}_${safeName}`;
        const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
        if (!url) return res.status(503).json({ error: 'R2 unavailable' });
        return res.json({ url, path: key });
      }

      if (scope === 'hero') {
        if (mimetype.startsWith('video/')) {
          const ve = ext === 'webm' ? 'webm' : ext === 'mov' ? 'mov' : 'mp4';
          const key = `hero/${Date.now()}_${rand}.${ve}`;
          const ct =
            mimetype.startsWith('video/') ? mimetype : ve === 'webm' ? 'video/webm' : 'video/mp4';
          const url = await putPublicObject({ key, body: req.file.buffer, contentType: ct });
          if (!url) return res.status(503).json({ error: 'R2 unavailable' });
          return res.json({ url, path: key });
        }
        if (shouldEncodeToWebpAvif(mimetype, ext)) {
          const { fullWebp, thumbWebp, midWebp, avifBuffer, contentHash } = await processRasterToWebpAvif(
            req.file.buffer,
            { includeMidForHero: true }
          );
          const idBase = `hero/${Date.now()}_${rand}_${contentHash}`;
          const webpKey = `${idBase}.webp`;
          const thumbKey = `${idBase}_thumb.webp`;
          const midKey = `${idBase}_mid.webp`;
          const url = await putPublicObject({ key: webpKey, body: fullWebp, contentType: 'image/webp' });
          await putPublicObject({ key: thumbKey, body: thumbWebp, contentType: 'image/webp' });
          if (midWebp) {
            await putPublicObject({ key: midKey, body: midWebp, contentType: 'image/webp' });
          }
          if (avifBuffer) {
            await putPublicObject({ key: `${idBase}.avif`, body: avifBuffer, contentType: 'image/avif' });
          }
          const thumbUrl = publicUrlForKey(thumbKey);
          const midUrl = midWebp ? publicUrlForKey(midKey) : null;
          const avifUrl = avifBuffer ? publicUrlForKey(`${idBase}.avif`) : null;
          return res.json({ url, path: webpKey, thumbUrl, midUrl, avifUrl });
        }
        const key = `hero/${Date.now()}_${rand}.${ext || 'bin'}`;
        const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
        if (!url) return res.status(503).json({ error: 'R2 unavailable' });
        return res.json({ url, path: key });
      }

      if (scope === 'images') {
        if (!IMAGE_FOLDERS.has(folder)) {
          return res.status(400).json({ error: 'Invalid folder for scope images' });
        }
        if (mimetype.startsWith('video/')) {
          const ve = ext === 'webm' ? 'webm' : 'mp4';
          const key = `${folder}/${Date.now()}_${rand}.${ve}`;
          const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
          if (!url) return res.status(503).json({ error: 'R2 unavailable' });
          return res.json({ url, path: key });
        }
        if (shouldEncodeToWebpAvif(mimetype, ext)) {
          const { fullWebp, thumbWebp, avifBuffer, contentHash } = await processRasterToWebpAvif(
            req.file.buffer
          );
          const idBase = `${folder}/${Date.now()}_${rand}_${contentHash}`;
          const webpKey = `${idBase}.webp`;
          const thumbKey = `${idBase}_thumb.webp`;
          const url = await putPublicObject({ key: webpKey, body: fullWebp, contentType: 'image/webp' });
          await putPublicObject({ key: thumbKey, body: thumbWebp, contentType: 'image/webp' });
          if (avifBuffer) {
            await putPublicObject({ key: `${idBase}.avif`, body: avifBuffer, contentType: 'image/avif' });
          }
          return res.json({
            url,
            path: webpKey,
            thumbUrl: publicUrlForKey(thumbKey),
            avifUrl: avifBuffer ? publicUrlForKey(`${idBase}.avif`) : null,
          });
        }
        const key = `${folder}/${Date.now()}_${rand}.${ext || 'bin'}`;
        const url = await putPublicObject({ key, body: req.file.buffer, contentType: mimetype });
        if (!url) return res.status(503).json({ error: 'R2 unavailable' });
        return res.json({ url, path: key });
      }

      return res.status(400).json({ error: 'Invalid scope' });
    } catch (e) {
      console.error('[media] upload', e);
      return res.status(500).json({ error: e.message || 'Upload failed' });
    }
  });

  app.post('/api/media/delete', requireAdminAuth, requireAdminPermission('settings:manage'), requireR2, async (req, res) => {
    try {
      const key = String(req.body?.path || req.body?.key || '').trim();
      if (!key || key.includes('..')) return res.status(400).json({ error: 'Invalid path' });
      await deleteMediaImageVariants(key);
      return res.json({ ok: true });
    } catch (e) {
      console.error('[media] delete', e);
      return res.status(500).json({ error: e.message || 'Delete failed' });
    }
  });
}

module.exports = { registerMediaRoutes };
