'use strict';

const sharp = require('sharp');
const crypto = require('crypto');

const MAX_EDGE = 2560;
const THUMB_EDGE = 400;

/**
 * Normalize orientation, cap size, emit WebP full + thumb and optional AVIF.
 */
async function processRasterToWebpAvif(inputBuffer) {
  const generateAvif = process.env.MEDIA_SKIP_AVIF !== '1' && process.env.MEDIA_SKIP_AVIF !== 'true';

  const normalized = await sharp(inputBuffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);

  const webpQ = Math.min(100, Math.max(50, Number(process.env.MEDIA_WEBP_QUALITY || 82)));
  const fullWebp = await sharp(normalized)
    .webp({ quality: webpQ, effort: 4 })
    .toBuffer();

  const thumbWebp = await sharp(normalized)
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  let avifBuffer = null;
  if (generateAvif) {
    try {
      const avifQ = Math.min(63, Math.max(20, Number(process.env.MEDIA_AVIF_QUALITY || 45)));
      avifBuffer = await sharp(normalized).avif({ quality: avifQ }).toBuffer();
    } catch (e) {
      console.warn('[media-image-pipeline] AVIF encode skipped:', e.message);
    }
  }

  return { fullWebp, thumbWebp, avifBuffer, contentHash };
}

function shouldEncodeToWebpAvif(mimetype, ext) {
  const e = (ext || '').toLowerCase().replace(/^\./, '');
  if (String(mimetype || '').startsWith('video/')) return false;
  if (mimetype === 'image/gif' || e === 'gif') return false;
  if (mimetype === 'image/svg+xml' || e === 'svg') return false;
  if (e === 'ico' || e === 'cur' || mimetype === 'image/x-icon') return false;
  if (String(mimetype || '').startsWith('image/')) return true;
  return false;
}

module.exports = {
  processRasterToWebpAvif,
  shouldEncodeToWebpAvif,
  MAX_EDGE,
  THUMB_EDGE,
};
