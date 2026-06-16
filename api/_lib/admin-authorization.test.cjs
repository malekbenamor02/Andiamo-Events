'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const ORIGINAL_ENV = { ...process.env };

describe('verifyAdminSession', () => {
  before(() => {
    process.env.JWT_SECRET = 'test-secret-for-admin-auth';
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';
  });

  after(() => {
    process.env.JWT_SECRET = ORIGINAL_ENV.JWT_SECRET;
    process.env.SUPABASE_URL = ORIGINAL_ENV.SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = ORIGINAL_ENV.SUPABASE_ANON_KEY;
  });

  it('returns 401 when no adminToken cookie is present', async () => {
    const { verifyAdminSession } = require('./admin-authorization.cjs');
    const result = await verifyAdminSession({ headers: {} });
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 401);
    assert.match(result.reason || result.error, /token/i);
  });

  it('returns 401 for expired JWT', async () => {
    const { verifyAdminSession } = require('./admin-authorization.cjs');
    const token = jwt.sign(
      { id: '1', email: 'a@test.com', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );
    const result = await verifyAdminSession({
      headers: { cookie: `adminToken=${token}` },
    });
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 401);
  });

  it('returns 401 for invalid role in JWT payload', async () => {
    const { verifyAdminSession } = require('./admin-authorization.cjs');
    const token = jwt.sign(
      { id: '1', email: 'a@test.com', role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const result = await verifyAdminSession({
      headers: { cookie: `adminToken=${token}` },
    });
    assert.equal(result.valid, false);
    assert.equal(result.statusCode, 403);
  });
});
