#!/usr/bin/env node
/**
 * Remove supabaseService || supabase fallbacks from server.cjs.
 * Admin/private/scanner/payment paths use service role only (fail closed via requireServiceRoleDb).
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../../server.cjs');
let s = readFileSync(file, 'utf8');

const helpers = `
/** Service role only — never fall back to anon for privileged DB access. */
function failClosedServiceRole(res, details) {
  const payload = {
    error: 'Server configuration error',
    details: details || 'SUPABASE_SERVICE_ROLE_KEY is required.',
  };
  if (res && typeof res.status === 'function') {
    res.status(503).json(payload);
    return null;
  }
  return null;
}

function requireServiceRoleDb(res) {
  if (!supabaseService) {
    return failClosedServiceRole(res);
  }
  return supabaseService;
}

function getServiceRoleDbOrThrow() {
  if (!supabaseService) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  return supabaseService;
}

function getSecurityAuditDb() {
  return supabaseService;
}

function getPublicAnonDb() {
  return supabase;
}
`;

if (!s.includes('function requireServiceRoleDb(res)')) {
  s = s.replace(
    /} else \{\s*\n\s*\/\/ Supabase client not initialized - admin login disabled\s*\n\}/,
    `} else {\n  // Supabase client not initialized - admin login disabled\n}\n${helpers}`,
  );
}

s = s.replace(
  /  \} else \{\s*\n    console\.warn\('SUPABASE_SERVICE_ROLE_KEY not set - storage operations may fail\. Using anon key instead\.'\);\s*\n  \}/,
  `  } else {\n    console.warn('SUPABASE_SERVICE_ROLE_KEY not set — privileged routes will fail closed (503).');\n  }`,
);

s = s.replace(/const securityLogClient = supabaseService \|\| supabase;/g, 'const securityLogClient = getSecurityAuditDb();');

// Internal async helpers (no res)
s = s.replace(
  /async function releaseOrderStock\(orderId, reason\) \{\s*\n  if \(!supabase\) \{\s*\n    throw new Error\('Supabase not configured'\);\s*\n  \}\s*\n\s*const dbClient = supabaseService \|\| supabase;/,
  `async function releaseOrderStock(orderId, reason) {
  const dbClient = getServiceRoleDbOrThrow();`,
);

// Route handlers — dbClient
s = s.replace(
  /const dbClient = supabaseService \|\| supabase;\s*\n/g,
  `const dbClient = requireServiceRoleDb(res);
    if (!dbClient) return;
`,
);

// Route handlers — db (not dbClient)
s = s.replace(
  /const db = supabaseService \|\| supabase;\s*\n/g,
  `const db = requireServiceRoleDb(res);
    if (!db) return;
`,
);

// loginDb
s = s.replace(
  /const loginDb = supabaseService \|\| supabase;\s*\n/g,
  `const loginDb = requireServiceRoleDb(res);
    if (!loginDb) return;
`,
);

// storageClient paired with dbClient (approve order block)
s = s.replace(
  /const storageClient = supabaseService \|\| supabase;\s*\n/g,
  `const storageClient = dbClient;
`,
);

// Standalone at column 0 (helper functions)
s = s.replace(
  /^  const dbClient = supabaseService \|\| supabase;\s*$/gm,
  `  const dbClient = getServiceRoleDbOrThrow();`,
);

const remaining = (s.match(/supabaseService \|\| supabase/g) || []).length;
writeFileSync(file, s);
console.log(`server.cjs patched. Remaining supabaseService || supabase: ${remaining}`);
