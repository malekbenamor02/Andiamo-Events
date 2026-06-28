'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('fs');
const { resolve, join } = require('path');
const http = require('http');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

function walkFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walkFiles(full, acc);
    } else if (/\.(js|ts|tsx|cjs|mjs)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function grepInFiles(files, pattern) {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const re = new RegExp(pattern, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      hits.push({ file, match: m[0] });
    }
  }
  return hits;
}

async function httpGet(port, path) {
  return new Promise((resolvePromise, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolvePromise({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

describe('reports export route — ESM/CJS interop', () => {
  it('reports-export-route.cjs can be required without throwing', () => {
    const routePath = require.resolve('./reports-export-route.cjs');
    delete require.cache[routePath];
    assert.doesNotThrow(() => require(routePath));
  });

  it('uses dynamic import for admin-mutation-audit.js (no require)', () => {
    const src = read('api/_lib/reports-export-route.cjs');
    assert.doesNotMatch(src, /require\(['"]\.\/admin-mutation-audit\.js['"]\)/);
    assert.match(src, /import\(['"]\.\/admin-mutation-audit\.js['"]\)/);
  });

  it('can dynamically load admin-mutation-audit.js', async () => {
    const mod = await import('./admin-mutation-audit.js');
    assert.equal(typeof mod.writeAdminMutationAudit, 'function');
  });
});

describe('reports export route — authZ before data access', () => {
  const src = read('api/_lib/reports-export-route.cjs');

  it('registers GET /api/admin/reports/export with auth middleware before handler', () => {
    const routeIdx = src.indexOf("'/api/admin/reports/export'");
    const authIdx = src.indexOf('requireAdminAuth', routeIdx);
    const permIdx = src.indexOf("requireAdminPermission('reports:view')", routeIdx);
    const loadIdx = src.indexOf('loadReportsExportPayload', routeIdx);
    assert.ok(routeIdx >= 0);
    assert.ok(authIdx > routeIdx && permIdx > authIdx);
    assert.ok(loadIdx > permIdx, 'DB load must run only after permission gate');
  });

  it('does not write workbook to public or dist paths', () => {
    assert.doesNotMatch(src, /public\//);
    assert.doesNotMatch(src, /dist\//);
    assert.doesNotMatch(src, /writeFileSync|createWriteStream/);
    assert.match(src, /res\.send\(buffer\)/);
  });

  it('audit logs export without embedding order payload', () => {
    assert.match(src, /writeAdminMutationAudit/);
    assert.match(src, /reports_excel_export/);
    assert.match(src, /row_count/);
    assert.doesNotMatch(src, /details:\s*\{[^}]*orders/);
  });

  it('is registered in admin-privileged-app and server.cjs', () => {
    assert.match(read('api/_lib/admin-privileged-app.cjs'), /registerReportsExportRoute/);
    assert.match(read('server.cjs'), /registerReportsExportRoute/);
    assert.match(read('vercel.json'), /\/api\/admin\/reports\/export/);
  });
});

describe('reports export route — HTTP status codes', () => {
  let server;
  let port;
  let restorePayload;

  before(async () => {
    const express = require('express');
    const dataPath = require.resolve('./reports-export-data.cjs');
    const routePath = require.resolve('./reports-export-route.cjs');
    delete require.cache[routePath];

    const dataMod = require(dataPath);
    restorePayload = dataMod.loadReportsExportPayload;
    dataMod.loadReportsExportPayload = async () => ({
      orders: [],
      ambassadorRoster: [],
      eventPassNames: [],
      passStockRows: [],
    });

    const { registerReportsExportRoute } = require(routePath);

    const mockDb = {
      from: () => ({
        insert: async () => ({ error: null }),
      }),
    };

    const app = express();
    registerReportsExportRoute(app, {
      supabaseService: mockDb,
      requireAdminAuth: (req, res, next) => {
        if (!req.headers['x-test-auth']) {
          return res.status(401).json({ error: 'Not authenticated', valid: false });
        }
        req.admin = { id: 'admin-test-1', email: 'admin@test.local', name: 'Test Admin', role: 'admin' };
        next();
      },
      requireAdminPermission: (perm) => (req, res, next) => {
        if (perm !== 'reports:view') {
          return res.status(500).json({ error: 'unexpected permission' });
        }
        if (req.headers['x-test-deny-perm'] === '1') {
          return res.status(403).json({ error: 'Forbidden', valid: false });
        }
        next();
      },
    });

    server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(async () => {
    const dataPath = require.resolve('./reports-export-data.cjs');
    const routePath = require.resolve('./reports-export-route.cjs');
    const dataMod = require(dataPath);
    dataMod.loadReportsExportPayload = restorePayload;
    delete require.cache[routePath];
    if (server) {
      await new Promise((r) => server.close(r));
    }
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await httpGet(port, '/api/admin/reports/export');
    assert.equal(res.status, 401);
  });

  it('returns 403 when admin lacks reports:view', async () => {
    const res = await new Promise((resolvePromise, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/admin/reports/export',
          method: 'GET',
          headers: { 'x-test-auth': '1', 'x-test-deny-perm': '1' },
        },
        (response) => {
          const chunks = [];
          response.on('data', (c) => chunks.push(c));
          response.on('end', () => resolvePromise({ status: response.statusCode, body: Buffer.concat(chunks) }));
        }
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 403);
  });

  it('returns xlsx attachment for authorized admin', async () => {
    const res = await new Promise((resolvePromise, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/admin/reports/export?date_range=ALL_TIME&language=en',
          method: 'GET',
          headers: { 'x-test-auth': '1' },
        },
        (response) => {
          const chunks = [];
          response.on('data', (c) => chunks.push(c));
          response.on('end', () =>
            resolvePromise({
              status: response.statusCode,
              headers: response.headers,
              body: Buffer.concat(chunks),
            })
          );
        }
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 200);
    assert.match(String(res.headers['content-type'] || ''), /spreadsheetml/);
    assert.match(String(res.headers['content-disposition'] || ''), /\.xlsx/);
    assert.ok(res.body.length > 100);
  });
});

describe('reports export — no client secrets or hardcoded passwords', () => {
  it('frontend export client does not reference VITE_REPORTS_EXCEL_LOCK_PASSWORD or exceljs', () => {
    const src = read('src/lib/analytics/reportsExcelExport.ts');
    assert.doesNotMatch(src, /VITE_REPORTS_EXCEL_LOCK_PASSWORD/);
    assert.doesNotMatch(src, /AndiamoEventsReports/);
    assert.doesNotMatch(src, /exceljs|ExcelJS/);
    assert.match(src, /ADMIN_REPORTS_EXPORT/);
  });

  it('src tree has no VITE_REPORTS_EXCEL_LOCK_PASSWORD or AndiamoEventsReports', () => {
    const srcFiles = walkFiles(resolve(root, 'src'));
    const viteHits = grepInFiles(srcFiles, 'VITE_REPORTS_EXCEL_LOCK_PASSWORD');
    const pwdHits = grepInFiles(srcFiles, 'AndiamoEventsReports');
    assert.deepEqual(viteHits, [], `unexpected VITE password refs: ${JSON.stringify(viteHits)}`);
    assert.deepEqual(pwdHits, [], `unexpected hardcoded password: ${JSON.stringify(pwdHits)}`);
  });

  it('REPORTS_EXCEL_LOCK_PASSWORD appears only in server-side report modules', () => {
    const allowed = new Set([
      resolve(root, 'api/_lib/reports-excel-export.cjs'),
      resolve(root, 'api/_lib/reports-excel-server.src.ts'),
      resolve(root, 'api/_lib/reports-export-route.cjs'),
      resolve(root, 'api/_lib/reports-export-route.test.cjs'),
    ]);
    const apiFiles = walkFiles(resolve(root, 'api')).concat(
      walkFiles(resolve(root, 'scripts')).filter((f) => f.includes('reports'))
    );
    const hits = grepInFiles(apiFiles, 'REPORTS_EXCEL_LOCK_PASSWORD');
    for (const hit of hits) {
      assert.ok(
        allowed.has(hit.file) || hit.file.endsWith('reports-export-route.test.cjs'),
        `REPORTS_EXCEL_LOCK_PASSWORD in unexpected file: ${hit.file}`
      );
    }
    const srcHits = grepInFiles(walkFiles(resolve(root, 'src')), 'REPORTS_EXCEL_LOCK_PASSWORD');
    assert.deepEqual(srcHits, []);
  });
});
