#!/usr/bin/env node
/**
 * One-off migration: download public images from Supabase Storage URLs, re-encode WebP+AVIF+thumb,
 * upload to R2, update database columns.
 *
 * Requires .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_*, PUBLIC_ASSETS_BASE_URL
 *
 *   node scripts/backfill-supabase-media-to-r2.cjs           # events.poster_url + sponsors.logo_url
 *   node scripts/backfill-supabase-media-to-r2.cjs --dry-run
 */

'use strict';

const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const { processRasterToWebpAvif, shouldEncodeToWebpAvif } = require(path.join(
  __dirname,
  '..',
  'api',
  'lib',
  'media-image-pipeline.cjs'
));
const { putPublicObject, isR2MediaEnabled } = require(path.join(
  __dirname,
  '..',
  'api',
  'lib',
  'r2-media.cjs'
));

const STORAGE_MARKER = 'supabase.co/storage/v1/object/public/';

function isSupabasePublicStorageUrl(u) {
  return typeof u === 'string' && u.includes(STORAGE_MARKER);
}

async function migrateRasterUrl(buffer, mimetypeHint, destFolder) {
  const mime = mimetypeHint || 'image/jpeg';
  const ext = mime.includes('png') ? 'png' : 'jpg';
  if (!shouldEncodeToWebpAvif(mime, ext)) {
    throw new Error('Unsupported raster type for backfill (try GIF/SVG manually)');
  }
  const { fullWebp, thumbWebp, avifBuffer, contentHash } = await processRasterToWebpAvif(buffer);
  const rand = crypto.randomBytes(4).toString('hex');
  const idBase = `${destFolder}/${Date.now()}_${rand}_${contentHash}`;
  const webpKey = `${idBase}.webp`;
  const thumbKey = `${idBase}_thumb.webp`;
  const mainUrl = await putPublicObject({ key: webpKey, body: fullWebp, contentType: 'image/webp' });
  await putPublicObject({ key: thumbKey, body: thumbWebp, contentType: 'image/webp' });
  if (avifBuffer) {
    await putPublicObject({ key: `${idBase}.avif`, body: avifBuffer, contentType: 'image/avif' });
  }
  return mainUrl;
}

async function backfillColumn(sb, { table, idColumn, urlColumn, folder }, dryRun) {
  const { data: rows, error } = await sb.from(table).select(`${idColumn}, ${urlColumn}`);
  if (error) throw error;

  let updated = 0;
  for (const row of rows || []) {
    const url = row[urlColumn];
    if (!isSupabasePublicStorageUrl(url)) continue;

    console.log(`[${table}] ${idColumn}=${row[idColumn]} …`);
    if (dryRun) {
      updated++;
      continue;
    }

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  skip: download ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'image/jpeg';
    try {
      const newUrl = await migrateRasterUrl(buf, ct, folder);
      const { error: upErr } = await sb.from(table).update({ [urlColumn]: newUrl }).eq(idColumn, row[idColumn]);
      if (upErr) console.error('  update failed:', upErr.message);
      else {
        updated++;
        console.log('  →', newUrl);
      }
    } catch (e) {
      console.error('  skip:', e.message);
    }
  }
  return updated;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!isR2MediaEnabled()) {
    console.error('Configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, PUBLIC_ASSETS_BASE_URL');
    process.exit(1);
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
  }

  const sb = createClient(url, key);
  console.log(dryRun ? 'Dry run (no uploads/updates)' : 'Backfill starting…');

  await backfillColumn(sb, { table: 'events', idColumn: 'id', urlColumn: 'poster_url', folder: 'posters' }, dryRun);
  await backfillColumn(sb, { table: 'sponsors', idColumn: 'id', urlColumn: 'logo_url', folder: 'sponsors' }, dryRun);

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
