'use strict';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const {
  requireScannerAuthWithDb,
  normalizeScannerRole,
} = require('./scanner-auth.cjs');

process.env.JWT_SECRET = 'test-jwt-secret-for-scanner-auth';

function mockReq(tokenPayload) {
  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { headers: { cookie: `scannerToken=${encodeURIComponent(token)}` } };
}

function mockDb(scannerRow) {
  return {
    from(table) {
      assert.strictEqual(table, 'scanners');
      return {
        select() {
          return {
            eq(_col, id) {
              return {
                maybeSingle: async () => {
                  if (!scannerRow || scannerRow.id !== id) {
                    return { data: null, error: null };
                  }
                  return { data: scannerRow, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('requireScannerAuthWithDb rejects inactive scanner', async () => {
  const req = mockReq({
    scannerId: '11111111-1111-1111-1111-111111111111',
    email: 's@test.com',
    type: 'scanner',
    scannerRole: 'scanner',
  });
  const db = mockDb({
    id: '11111111-1111-1111-1111-111111111111',
    email: 's@test.com',
    name: 'Scanner',
    role: 'scanner',
    is_active: false,
  });
  let cleared = false;
  const auth = await requireScannerAuthWithDb(req, db, {
    res: {},
    clearCookie: () => {
      cleared = true;
    },
  });
  assert.ok(auth.err);
  assert.strictEqual(auth.err.statusCode, 401);
  assert.ok(cleared);
});

test('requireScannerAuthWithDb uses DB role not stale JWT supervisor claim', async () => {
  const req = mockReq({
    scannerId: '11111111-1111-1111-1111-111111111111',
    email: 's@test.com',
    type: 'scanner',
    scannerRole: 'supervisor',
  });
  const db = mockDb({
    id: '11111111-1111-1111-1111-111111111111',
    email: 's@test.com',
    name: 'Scanner',
    role: 'scanner',
    is_active: true,
  });
  const auth = await requireScannerAuthWithDb(req, db, {});
  assert.ok(auth.scanner);
  assert.strictEqual(auth.scanner.role, 'scanner');
});

test('normalizeScannerRole defaults unknown to scanner', () => {
  assert.strictEqual(normalizeScannerRole('supervisor'), 'supervisor');
  assert.strictEqual(normalizeScannerRole('other'), 'scanner');
});
