#!/usr/bin/env node
/**
 * Restores public/email-assets/logo-{black,white}.png from src/lib/email-assets.ts
 * (inverse of update-email-logos.cjs). Run after cloning if PNGs are gitignored or missing.
 */
const fs = require('fs');
const path = require('path');

const TS = path.join(__dirname, '..', 'src', 'lib', 'email-assets.ts');
const OUT = path.join(__dirname, '..', 'public', 'email-assets');

const content = fs.readFileSync(TS, 'utf8');

function extract(field) {
  const re = new RegExp(field + ': `data:image/png;base64,([^`]+)`');
  const m = content.match(re);
  if (!m) throw new Error('Missing ' + field + ' in email-assets.ts');
  return Buffer.from(m[1], 'base64');
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'logo-black.png'), extract('logoBlack'));
fs.writeFileSync(path.join(OUT, 'logo-white.png'), extract('logoWhite'));
console.log('Wrote public/email-assets/logo-black.png and logo-white.png');
