'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createRequire } = require('module');

const RATE_LIMIT_INDEX = path.join(__dirname, 'index.cjs');

describe('import-compat: rate-limit index.cjs', () => {
  it('loads from CJS (academyRoutes / ticket-qr pattern)', () => {
    const rl = require(RATE_LIMIT_INDEX);
    assert.equal(typeof rl.getClientIp, 'function');
    assert.equal(typeof rl.enforceRateLimits, 'function');
    assert.equal(typeof rl.hashRateLimitSegment('x', 'ip'), 'string');
  });

  it('loads from ESM createRequire (misc.js / scan.js / pos.js pattern)', () => {
    const requireFromEsm = createRequire(path.join(__dirname, '..', '..', 'misc.js'));
    const rl = requireFromEsm('./_lib/rate-limit/index.cjs');
    assert.equal(typeof rl.getClientIp, 'function');
    assert.equal(typeof rl.incrFixedWindow, 'function');
  });

  it('loads from scan.js directory context', () => {
    const requireFromScan = createRequire(path.join(__dirname, '..', 'scan.js'));
    const rl = requireFromScan('./rate-limit/index.cjs');
    assert.equal(typeof rl.enforceRateLimits, 'function');
    assert.equal(typeof rl.sendRateLimited, 'function');
  });

  it('loads from pos.js directory context', () => {
    const requireFromPos = createRequire(path.join(__dirname, '..', 'pos.js'));
    const rl = requireFromPos('./rate-limit/index.cjs');
    assert.equal(typeof rl.getPolicy, 'function');
    assert.equal(typeof rl.buildRateLimitKey, 'function');
  });

  it('loads from academyRoutes.cjs relative path', () => {
    const academyPath = path.join(__dirname, '..', '..', '..', 'academyRoutes.cjs');
    const requireFromAcademy = createRequire(academyPath);
    const rl = requireFromAcademy('./api/_lib/rate-limit/index.cjs');
    assert.equal(typeof rl.listPolicyIds, 'function');
    assert.ok(rl.listPolicyIds().includes('LOGIN_ADMIN'));
  });

  it('loads from ticket-qr-route.cjs relative path', () => {
    const requireFromQr = createRequire(path.join(__dirname, '..', 'ticket-qr-route.cjs'));
    const rl = requireFromQr('./rate-limit/index.cjs');
    assert.equal(typeof rl.isValidUuid, 'function');
    assert.equal(typeof rl.getLuaScriptForTests, 'function');
  });
});
