'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const {
  hashRateLimitSegment,
  buildRateLimitKey,
  normalizeSegmentForHash,
} = require('./hash-key.cjs');

describe('no PII in Redis keys', () => {
  const pepper = 'unit-test-pepper-value-32chars!!';

  before(() => {
    process.env.RATE_LIMIT_KEY_PEPPER = pepper;
  });

  it('keys contain only hashed segments', () => {
    const samples = [
      { dimension: 'email', value: 'user@secret-domain.com' },
      { dimension: 'phone', value: '+216 22 123 456' },
      {
        dimension: 'order',
        value: '550e8400-e29b-41d4-a716-446655440000',
      },
      {
        dimension: 'token',
        value: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      },
    ];

    for (const s of samples) {
      const hash = hashRateLimitSegment(s.value, s.dimension);
      const key = buildRateLimitKey({
        route: 'test.route',
        dimension: s.dimension,
        segmentHash: hash,
      });

      assert.doesNotMatch(key, /@/);
      assert.doesNotMatch(key, /secret-domain/);
      assert.doesNotMatch(key, /550e8400/);
      assert.doesNotMatch(key, /6ba7b810/);
      assert.doesNotMatch(key, /216/);
      assert.match(key, /^ae:rl:v1:test\.route:[a-z_]+:[a-f0-9]{32}$/);
    }
  });

  it('normalizes email to lowercase before hash', () => {
    const a = hashRateLimitSegment('User@Example.COM', 'email');
    const b = hashRateLimitSegment('user@example.com', 'email');
    assert.equal(a, b);
  });

  it('normalizes phone to digits only before hash', () => {
    const a = hashRateLimitSegment('+216 22 123 456', 'phone');
    const b = hashRateLimitSegment('22123456', 'phone');
    assert.equal(a, b);
  });
});
