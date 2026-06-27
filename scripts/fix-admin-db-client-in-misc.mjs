/**
 * One-off: replace admin route anon/service fallback with createAdminDbClient in misc.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const miscPath = resolve(dirname(fileURLToPath(import.meta.url)), '../api/misc.js');
let src = readFileSync(miscPath, 'utf8');

const replacement = `const dbClient = await createAdminDbClient(res);
        if (!dbClient) return;`;

const patterns = [
  // Pattern A: multi-line with success: false
  /\r?\n        if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\r?\n          return res\.status\(500\)\.json\(\{ success: false, error: 'Supabase not configured' \}\);\r?\n        \}\r?\n\r?\n        const \{ createClient \} = await import\('@supabase\/supabase-js'\);\r?\n        const supabase = createClient\(\r?\n          process\.env\.SUPABASE_URL,\r?\n          process\.env\.SUPABASE_ANON_KEY\r?\n        \);\r?\n\r?\n        let supabaseService = null;\r?\n        if \(process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\r?\n          supabaseService = createClient\(\r?\n            process\.env\.SUPABASE_URL,\r?\n            process\.env\.SUPABASE_SERVICE_ROLE_KEY\r?\n          \);\r?\n        \}\r?\n\r?\n        const dbClient = supabaseService \|\| supabase;/g,
  // Pattern B: compact single-line supabase create
  /\r?\n        if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\r?\n          return res\.status\(500\)\.json\(\{ success: false, error: 'Supabase not configured' \}\);\r?\n        \}\r?\n\r?\n        const \{ createClient \} = await import\('@supabase\/supabase-js'\);\r?\n        const supabase = createClient\(process\.env\.SUPABASE_URL, process\.env\.SUPABASE_ANON_KEY\);\r?\n        let supabaseService = null;\r?\n        if \(process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\r?\n          supabaseService = createClient\(process\.env\.SUPABASE_URL, process\.env\.SUPABASE_SERVICE_ROLE_KEY\);\r?\n        \}\r?\n        const dbClient = supabaseService \|\| supabase;/g,
  // Pattern C: admin-skip style (error: 'Supabase not configured' only)
  /\r?\n        if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\r?\n          return res\.status\(500\)\.json\(\{ error: 'Supabase not configured' \}\);\r?\n        \}\r?\n        \r?\n        const bodyData = await parseBody\(req\);\r?\n        const \{ orderId, reason \} = bodyData;\r?\n        const adminId = authResult\.admin\?\.id;\r?\n        const adminEmail = authResult\.admin\?\.email;\r?\n        \r?\n        if \(!orderId\) \{\r?\n          return res\.status\(400\)\.json\(\{ error: 'Order ID is required' \}\);\r?\n        \}\r?\n        \r?\n        const \{ createClient \} = await import\('@supabase\/supabase-js'\);\r?\n        const supabase = createClient\(\r?\n          process\.env\.SUPABASE_URL,\r?\n          process\.env\.SUPABASE_ANON_KEY\r?\n        \);\r?\n        \r?\n        let supabaseService = null;\r?\n        if \(process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\r?\n          supabaseService = createClient\(\r?\n            process\.env\.SUPABASE_URL,\r?\n            process\.env\.SUPABASE_SERVICE_ROLE_KEY\r?\n          \);\r?\n        \}\r?\n        \r?\n        const dbClient = supabaseService \|\| supabase;/g,
  // Pattern D: admin-remove-order if/else service vs anon
  /\r?\n        if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\r?\n          return res\.status\(500\)\.json\(\{ \r?\n            error: 'Server configuration error',\r?\n            details: 'Supabase not configured\. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables\.'\r?\n          \}\);\r?\n        \}\r?\n        \r?\n        const bodyData = await parseBody\(req\);\r?\n        const \{ orderId \} = bodyData;\r?\n        const adminId = authResult\.admin\?\.id;\r?\n        const adminEmail = authResult\.admin\?\.email;\r?\n        \r?\n        if \(!orderId\) \{\r?\n          return res\.status\(400\)\.json\(\{ \r?\n            error: 'Order ID is required',\r?\n            details: 'orderId must be provided'\r?\n          \}\);\r?\n        \}\r?\n        \r?\n        console\.log\('✅ ADMIN: Remove Order Request:',[\s\S]*?\r?\n        \r?\n        const \{ createClient \} = await import\('@supabase\/supabase-js'\);\r?\n        \r?\n        \/\/ Use service role key if available \(for RLS bypass\)\r?\n        let supabase;\r?\n        if \(process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\r?\n          supabase = createClient\(\r?\n            process\.env\.SUPABASE_URL,\r?\n            process\.env\.SUPABASE_SERVICE_ROLE_KEY\r?\n          \);\r?\n        \} else \{\r?\n          supabase = createClient\(\r?\n            process\.env\.SUPABASE_URL,\r?\n            process\.env\.SUPABASE_ANON_KEY\r?\n          \);\r?\n        \}/g,
  // Pattern E: order qr tickets
  /\r?\n        if \(!process\.env\.SUPABASE_URL \|\| !process\.env\.SUPABASE_ANON_KEY\) \{\r?\n          return res\.status\(500\)\.json\(\{ error: 'Supabase not configured' \}\);\r?\n        \}\r?\n\r?\n        const queryString = req\.url[\s\S]*?const dbClient = supabaseService \|\| supabase;/g,
];

let total = 0;
for (const re of patterns) {
  const before = src;
  if (re === patterns[3]) {
    // Special handling for admin-remove-order - replace only supabase init part
    src = src.replace(re, (match) => {
      const prefix = match.split('const { createClient }')[0];
      return prefix + `\n        const dbClient = await createAdminDbClient(res);\n        if (!dbClient) return;\n        const supabase = dbClient`;
    });
  } else if (re === patterns[4]) {
    src = src.replace(re, (match) => {
      const header = match.split('const queryString')[0];
      return header + `\n        const dbClient = await createAdminDbClient(res);\n        if (!dbClient) return;`;
    });
  } else {
    src = src.replace(re, `\n        ${replacement}`);
  }
  const n = (before.length - src.length !== 0 || before !== src) ? (before.match(re)?.length ?? (before !== src ? 1 : 0)) : 0;
  if (before !== src) {
    const count = [...before.matchAll(re)].length;
    total += count;
    console.log('Pattern matched', count, 'times');
  }
}

// storageClient fallback → dbClient
src = src.replace(/const storageClient = supabaseService \|\| supabase;/g, 'const storageClient = dbClient;');

// Remaining compact blocks without preceding env check (after auth only)
src = src.replace(
  /\r?\n        const \{ createClient \} = await import\('@supabase\/supabase-js'\);\r?\n        const supabase = createClient\(\r?\n          process\.env\.SUPABASE_URL,\r?\n          process\.env\.SUPABASE_ANON_KEY\r?\n        \);\r?\n\r?\n        let supabaseService = null;\r?\n        if \(process\.env\.SUPABASE_SERVICE_ROLE_KEY\) \{\r?\n          supabaseService = createClient\(\r?\n            process\.env\.SUPABASE_URL,\r?\n            process\.env\.SUPABASE_SERVICE_ROLE_KEY\r?\n          \);\r?\n        \}\r?\n\r?\n        const dbClient = supabaseService \|\| supabase;/g,
  `\n        ${replacement}`
);

writeFileSync(miscPath, src);
console.log('Done. Run grep to verify remaining admin anon patterns.');
