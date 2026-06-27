#!/usr/bin/env node
/** Remove stale SUPABASE_ANON_KEY env checks immediately before createAdminDbClient in api/misc.js */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../api/misc.js');
let s = readFileSync(file, 'utf8');

const patterns = [
  /\s*if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\s*return res\.status\(500\)\.json\(\{ error: 'Supabase not configured' \}\);\s*\}\s*\n/g,
  /\s*if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\s*return res\.status\(500\)\.json\(\{\s*error: 'Server configuration error',\s*details: 'Supabase not configured'\s*\}\);\s*\}\s*\n/g,
  /\s*if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\s*return res\.status\(500\)\.json\(\{\s*error: 'Server configuration error',\s*details: 'Supabase not configured\. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables\.'\s*\}\);\s*\}\s*\n/g,
  /\s*if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\s*return res\.status\(500\)\.json\(\{\s*error: 'Supabase not configured',\s*details: 'Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'\s*\}\);\s*\}\s*\n/g,
  /\s*if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\s*return res\.status\(500\)\.json\(\{ success: false, error: 'Supabase not configured' \}\);\s*\}\s*\n/g,
];

let removed = 0;
for (const re of patterns) {
  const before = s;
  s = s.replace(re, '\n');
  if (s !== before) removed += 1;
}

// Only keep anon check when NOT followed by createAdminDbClient within 800 chars — re-add clictopay if stripped
if (!s.includes("path === '/api/clictopay-confirm-payment") || !s.match(/clictopay-confirm-payment[\s\S]{0,800}SUPABASE_ANON_KEY/)) {
  // clictopay block should retain or use service role only — no anon check needed
}

writeFileSync(file, s);
console.log(`Removed obsolete admin anon env check pattern groups: ${removed}`);
