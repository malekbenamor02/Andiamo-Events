'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  hashAmbassadorSessionToken,
  generateSessionToken,
  buildSessionCookie,
  clearAmbassadorCookie,
  shouldRotateSession,
  computeRollingExpiresAt,
  isSessionExpired,
  resolveCookieName,
  getIdleDays,
  getAbsoluteDays,
  getRotateDays,
} = require('./ambassador-auth.cjs');

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test('generateSessionToken produces base64url string with sufficient entropy', () => {
  const a = generateSessionToken();
  const b = generateSessionToken();
  assert.ok(a.length >= 32);
  assert.notStrictEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
});

test('hashAmbassadorSessionToken is stable for same pepper and token', () => {
  process.env.AMBASSADOR_SESSION_PEPPER = 'test-pepper';
  const token = 'sample-token';
  const h1 = hashAmbassadorSessionToken(token);
  const h2 = hashAmbassadorSessionToken(token);
  assert.strictEqual(h1, h2);
  assert.strictEqual(h1.length, 64);
});

test('hashAmbassadorSessionToken changes when pepper changes', () => {
  process.env.AMBASSADOR_SESSION_PEPPER = 'pepper-a';
  const h1 = hashAmbassadorSessionToken('token');
  process.env.AMBASSADOR_SESSION_PEPPER = 'pepper-b';
  const h2 = hashAmbassadorSessionToken('token');
  assert.notStrictEqual(h1, h2);
});

test('isSessionExpired detects revoked and past expires_at', () => {
  const now = new Date('2026-06-24T12:00:00Z');
  assert.strictEqual(
    isSessionExpired({ revoked_at: '2026-06-24T11:00:00Z', expires_at: '2026-07-01T00:00:00Z', absolute_expires_at: '2026-12-01T00:00:00Z' }, now),
    true
  );
  assert.strictEqual(
    isSessionExpired({ revoked_at: null, expires_at: '2026-06-20T00:00:00Z', absolute_expires_at: '2026-12-01T00:00:00Z' }, now),
    true
  );
  assert.strictEqual(
    isSessionExpired({ revoked_at: null, expires_at: '2026-07-01T00:00:00Z', absolute_expires_at: '2026-12-01T00:00:00Z' }, now),
    false
  );
});

test('shouldRotateSession when rotated_at is null or older than threshold', () => {
  process.env.AMBASSADOR_SESSION_ROTATE_DAYS = '7';
  const now = new Date('2026-06-24T12:00:00Z');
  assert.strictEqual(shouldRotateSession({ rotated_at: null }, now), true);
  assert.strictEqual(
    shouldRotateSession({ rotated_at: '2026-06-10T12:00:00Z' }, now),
    true
  );
  assert.strictEqual(
    shouldRotateSession({ rotated_at: '2026-06-22T12:00:00Z' }, now),
    false
  );
});

test('computeRollingExpiresAt caps at absolute_expires_at', () => {
  process.env.AMBASSADOR_SESSION_IDLE_DAYS = '90';
  const now = new Date('2026-06-24T12:00:00Z');
  const session = { absolute_expires_at: '2026-07-01T00:00:00Z' };
  const rolling = computeRollingExpiresAt(session, now);
  assert.strictEqual(rolling.toISOString(), '2026-07-01T00:00:00.000Z');
});

test('buildSessionCookie uses dev fallback name on plain HTTP', () => {
  process.env.AMBASSADOR_COOKIE_NAME = '__Host-andiamo_ambassador_session';
  const req = { headers: {}, secure: false };
  const cookie = buildSessionCookie('abc123', 3600, req);
  assert.ok(cookie.includes('andiamo_ambassador_session=abc123'));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(!cookie.includes('Secure'));
});

test('buildSessionCookie uses __Host name and Secure on HTTPS', () => {
  process.env.AMBASSADOR_COOKIE_NAME = '__Host-andiamo_ambassador_session';
  const req = { headers: { 'x-forwarded-proto': 'https' }, secure: false };
  const cookie = buildSessionCookie('abc123', 3600, req);
  assert.ok(cookie.includes('__Host-andiamo_ambassador_session='));
  assert.ok(cookie.includes('Secure'));
});

test('clearAmbassadorCookie clears both host and dev names', () => {
  process.env.AMBASSADOR_COOKIE_NAME = '__Host-andiamo_ambassador_session';
  const cookies = clearAmbassadorCookie({ headers: {}, secure: false });
  assert.ok(cookies.length >= 2);
  assert.ok(cookies.some((c) => c.includes('Max-Age=0')));
});

test('env defaults for session durations', () => {
  delete process.env.AMBASSADOR_SESSION_IDLE_DAYS;
  delete process.env.AMBASSADOR_SESSION_ABSOLUTE_DAYS;
  delete process.env.AMBASSADOR_SESSION_ROTATE_DAYS;
  assert.strictEqual(getIdleDays(), 90);
  assert.strictEqual(getAbsoluteDays(), 180);
  assert.strictEqual(getRotateDays(), 7);
});

test('resolveCookieName returns configured name on HTTPS', () => {
  process.env.AMBASSADOR_COOKIE_NAME = '__Host-andiamo_ambassador_session';
  const req = { headers: { 'x-forwarded-proto': 'https' }, secure: false };
  assert.strictEqual(resolveCookieName(req), '__Host-andiamo_ambassador_session');
});
