'use strict';

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { getClientIp, isTrustedProxyEnvironment } = require('./client-ip.cjs');

describe('getClientIp trusted-proxy gating', () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('ignores X-Forwarded-For when not in trusted proxy environment', () => {
    delete process.env.VERCEL;
    delete process.env.TRUST_FORWARDED_IP;

    const req = {
      headers: { 'x-forwarded-for': '203.0.113.99' },
      socket: { remoteAddress: '10.0.0.5' },
    };
    assert.equal(getClientIp(req), '10.0.0.5');
  });

  it('uses first X-Forwarded-For hop on Vercel', () => {
    process.env.VERCEL = '1';

    const req = {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    assert.equal(getClientIp(req), '203.0.113.1');
  });

  it('uses TRUST_FORWARDED_IP=1 to trust headers locally', () => {
    delete process.env.VERCEL;
    process.env.TRUST_FORWARDED_IP = '1';

    const req = {
      headers: { 'x-real-ip': '198.51.100.2' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    assert.equal(getClientIp(req), '198.51.100.2');
  });

  it('strips IPv4-mapped IPv6 prefix', () => {
    delete process.env.VERCEL;
    delete process.env.TRUST_FORWARDED_IP;

    const req = {
      headers: {},
      socket: { remoteAddress: '::ffff:192.168.1.1' },
    };
    assert.equal(getClientIp(req), '192.168.1.1');
  });

  it('isTrustedProxyEnvironment true on VERCEL', () => {
    process.env.VERCEL = '1';
    assert.equal(isTrustedProxyEnvironment(), true);
  });
});
