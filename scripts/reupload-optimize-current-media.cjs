'use strict';

/**
 * Re-upload + optimize only media that is currently referenced in:
 * - site_content.hero_section (hero slides)
 * - events.poster_url
 * - events.gallery_images[]
 * - events.gallery_videos[]
 *
 * Usage:
 *   node scripts/reupload-optimize-current-media.cjs --dry-run
 *   node scripts/reupload-optimize-current-media.cjs --apply
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const dotenv = require('dotenv');

// Load env files for local runs (later files override earlier ones)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const args = new Set(process.argv.slice(2));
const isApply = args.has('--apply');
const isDryRun = args.has('--dry-run') || !isApply;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUPABASE_PUBLIC_OBJECT_MARKER = '/storage/v1/object/public/';

function parsePublicStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const i = url.indexOf(SUPABASE_PUBLIC_OBJECT_MARKER);
  if (i === -1) return null;
  const suffix = url.slice(i + SUPABASE_PUBLIC_OBJECT_MARKER.length);
  const slash = suffix.indexOf('/');
  if (slash <= 0) return null;
  const bucket = suffix.slice(0, slash);
  const key = suffix.slice(slash + 1);
  if (!bucket || !key) return null;
  return { bucket, key };
}

function looksVideo(url) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

function looksImage(url) {
  return /\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url);
}

async function fetchBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed downloading ${url} (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function optimizeImageBuffer(inputBuffer, maxEdge = 1920, quality = 82) {
  return sharp(inputBuffer)
    .rotate()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function transcodeVideoToMp4(inputBuffer) {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static not available');
  }
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'andiamo-media-'));
  const inPath = path.join(tmpDir, 'in.bin');
  const outPath = path.join(tmpDir, 'out.mp4');
  await fs.writeFile(inPath, inputBuffer);

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(
        ffmpegPath,
        [
          '-y',
          '-i',
          inPath,
          '-vf',
          "scale='min(1920,iw)':-2",
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '28',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          outPath,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );
      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += String(d);
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-1200)}`));
      });
    });

    return await fs.readFile(outPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

function extFromUrl(url) {
  const m = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return (m?.[1] || 'bin').toLowerCase();
}

function cacheControlForObject(bucket, folderPath) {
  if (bucket === 'hero-images') return '31536000';
  if (bucket === 'images') {
    const first = String(folderPath || '').split('/')[0];
    if (first === 'posters' || first === 'gallery') return '31536000';
  }
  return '3600';
}

async function uploadBuffer(bucket, folder, sourceUrl, buffer, contentType, ext) {
  const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 10);
  const fileName = `${Date.now()}_${hash}.${ext}`;
  const key = folder ? `${folder}/${fileName}` : fileName;
  const { error } = await sb.storage.from(bucket).upload(key, buffer, {
    contentType,
    cacheControl: cacheControlForObject(bucket, folder),
    upsert: false,
  });
  if (error) throw new Error(`Upload failed (${bucket}/${key}): ${error.message}`);
  const { data } = sb.storage.from(bucket).getPublicUrl(key);
  return { key, publicUrl: data.publicUrl };
}

async function migrateOneUrl(url, targetKind) {
  const parsed = parsePublicStorageUrl(url);
  if (!parsed) return { skipped: true, reason: 'not-supabase-public-url' };

  const folder = parsed.key.includes('/') ? parsed.key.split('/').slice(0, -1).join('/') : '';
  const isVideo = targetKind === 'video' || looksVideo(url);
  const isImage = targetKind === 'image' || looksImage(url);
  if (!isVideo && !isImage) return { skipped: true, reason: 'unknown-type' };

  if (isDryRun) {
    return { skipped: false, dryRun: true, newUrl: url };
  }

  const input = await fetchBuffer(url);
  if (isVideo) {
    const out = await transcodeVideoToMp4(input);
    const uploaded = await uploadBuffer(parsed.bucket, folder, url, out, 'video/mp4', 'mp4');
    return { skipped: false, dryRun: false, newUrl: uploaded.publicUrl, newPath: uploaded.key };
  }

  const out = await optimizeImageBuffer(input, 1920, 82);
  const uploaded = await uploadBuffer(parsed.bucket, folder, url, out, 'image/webp', 'webp');
  return { skipped: false, dryRun: false, newUrl: uploaded.publicUrl, newPath: uploaded.key };
}

async function main() {
  console.log(`[media-migrate] mode=${isDryRun ? 'dry-run' : 'apply'}`);

  const { data: heroRow, error: heroErr } = await sb
    .from('site_content')
    .select('key, content')
    .eq('key', 'hero_section')
    .single();
  if (heroErr) throw heroErr;

  const { data: events, error: eventsErr } = await sb
    .from('events')
    .select('id, poster_url, gallery_images, gallery_videos');
  if (eventsErr) throw eventsErr;

  let heroContent = heroRow?.content || {};
  const heroImages = Array.isArray(heroContent.images) ? heroContent.images : [];

  // Hero media
  for (let i = 0; i < heroImages.length; i += 1) {
    const slide = { ...heroImages[i] };
    if (slide.type === 'video' && slide.src) {
      const moved = await migrateOneUrl(slide.src, 'video');
      if (!moved.skipped && moved.newUrl) {
        slide.src = moved.newUrl;
        slide.path = moved.newPath || slide.path;
      }
      if (slide.poster) {
        const pm = await migrateOneUrl(slide.poster, 'image');
        if (!pm.skipped && pm.newUrl) {
          slide.poster = pm.newUrl;
          slide.posterPath = pm.newPath || slide.posterPath;
        }
      }
    } else if (slide.src) {
      const moved = await migrateOneUrl(slide.src, 'image');
      if (!moved.skipped && moved.newUrl) {
        slide.src = moved.newUrl;
        slide.path = moved.newPath || slide.path;
      }
    }
    heroImages[i] = slide;
  }
  heroContent = { ...heroContent, images: heroImages };

  // Events media
  const updatedEvents = [];
  for (const ev of events || []) {
    let posterUrl = ev.poster_url || null;
    const gi = Array.isArray(ev.gallery_images) ? [...ev.gallery_images] : [];
    const gv = Array.isArray(ev.gallery_videos) ? [...ev.gallery_videos] : [];
    let changed = false;

    if (posterUrl) {
      const m = await migrateOneUrl(posterUrl, 'image');
      if (!m.skipped && m.newUrl && m.newUrl !== posterUrl) {
        posterUrl = m.newUrl;
        changed = true;
      }
    }
    for (let i = 0; i < gi.length; i += 1) {
      const m = await migrateOneUrl(gi[i], 'image');
      if (!m.skipped && m.newUrl && m.newUrl !== gi[i]) {
        gi[i] = m.newUrl;
        changed = true;
      }
    }
    for (let i = 0; i < gv.length; i += 1) {
      const m = await migrateOneUrl(gv[i], 'video');
      if (!m.skipped && m.newUrl && m.newUrl !== gv[i]) {
        gv[i] = m.newUrl;
        changed = true;
      }
    }

    if (changed) {
      updatedEvents.push({
        id: ev.id,
        poster_url: posterUrl,
        gallery_images: gi,
        gallery_videos: gv,
      });
    }
  }

  if (isDryRun) {
    console.log(`[media-migrate] hero slides: ${heroImages.length}`);
    console.log(`[media-migrate] events to update: ${updatedEvents.length}`);
    console.log('[media-migrate] dry-run complete (no DB writes).');
    return;
  }

  const { error: heroUpdateErr } = await sb
    .from('site_content')
    .update({ content: heroContent, updated_at: new Date().toISOString() })
    .eq('key', 'hero_section');
  if (heroUpdateErr) throw heroUpdateErr;

  for (const ev of updatedEvents) {
    const { error } = await sb
      .from('events')
      .update({
        poster_url: ev.poster_url,
        gallery_images: ev.gallery_images,
        gallery_videos: ev.gallery_videos,
      })
      .eq('id', ev.id);
    if (error) throw error;
  }

  console.log(`[media-migrate] updated events: ${updatedEvents.length}`);
  console.log('[media-migrate] done.');
}

main().catch((err) => {
  console.error('[media-migrate] failed:', err?.message || err);
  process.exit(1);
});

