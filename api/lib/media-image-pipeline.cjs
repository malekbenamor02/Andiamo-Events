'use strict';

const sharp = require('sharp');
const crypto = require('crypto');

const MAX_EDGE = 2560;
const THUMB_EDGE = 400;

const DEFAULT_HERO_MID_EDGE = 1280;

function heroMidEdge() {
  const n = Number(process.env.MEDIA_HERO_MID_EDGE || DEFAULT_HERO_MID_EDGE);
  if (!Number.isFinite(n) || n < 480) return DEFAULT_HERO_MID_EDGE;
  return Math.min(2560, Math.round(n));
}

/**
 * Normalize orientation, cap size, emit WebP full + thumb and optional AVIF.
 * @param {Buffer} inputBuffer
 * @param {{ includeMidForHero?: boolean }} [options] — when true, also emit midWebp (hero-responsive srcset)
 */
async function processRasterToWebpAvif(inputBuffer, options = {}) {
  const includeMidForHero = options.includeMidForHero === true;
  const generateAvif = process.env.MEDIA_SKIP_AVIF !== '1' && process.env.MEDIA_SKIP_AVIF !== 'true';

  const normalized = await sharp(inputBuffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);

  const webpQ = Math.min(100, Math.max(50, Number(process.env.MEDIA_WEBP_QUALITY || 82)));
  const webpEffort = Math.min(6, Math.max(2, Number(process.env.MEDIA_WEBP_EFFORT || 4)));

  const fullPromise = sharp(normalized).webp({ quality: webpQ, effort: webpEffort }).toBuffer();
  const thumbPromise = sharp(normalized)
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: webpEffort })
    .toBuffer();

  const mid = includeMidForHero ? heroMidEdge() : null;
  const midPromise =
    includeMidForHero && mid != null
      ? sharp(normalized)
          .resize(mid, mid, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: webpQ, effort: webpEffort })
          .toBuffer()
      : Promise.resolve(null);

  let avifPromise = Promise.resolve(null);
  if (generateAvif) {
    const avifQ = Math.min(63, Math.max(20, Number(process.env.MEDIA_AVIF_QUALITY || 45)));
    avifPromise = sharp(normalized)
      .avif({ quality: avifQ })
      .toBuffer()
      .catch((e) => {
        console.warn('[media-image-pipeline] AVIF encode skipped:', e.message);
        return null;
      });
  }

  const [fullWebp, thumbWebp, midWebp, avifBuffer] = await Promise.all([
    fullPromise,
    thumbPromise,
    midPromise,
    avifPromise,
  ]);

  return { fullWebp, thumbWebp, midWebp, avifBuffer, contentHash };
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
  heroMidEdge,
};
