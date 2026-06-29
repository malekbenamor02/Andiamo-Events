'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  enforceInfluencerLoginLimits,
  setFetchForTests,
  resetFetchForTests,
} = require('./academy-influencer-login-rate-limit.cjs');
const { getPolicy } = require('./rate-limit/index.cjs');
const {
  buildInfluencerAttributionOrFilter,
  registrationAttributedToInfluencer,
  influencerIdAtRegistrationFromPromo,
} = require('./academy-influencer-attribution.cjs');
const { writeAcademyInfluencerAudit, diffPromoAssignment } = require('./academy-influencer-audit.cjs');
const { loadActiveInfluencerById } = require('./academy-influencer-auth.cjs');

describe('academy-influencer hardening', () => {
  beforeEach(() => {
    process.env.RATE_LIMIT_KEY_PEPPER = 'test-pepper-32-chars-minimum!!!!';
    resetFetchForTests();
  });

  describe('login rate limiting', () => {
    it('allows attempts below the threshold', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      setFetchForTests(async () => ({
        ok: true,
        json: async () => ({ result: 1 }),
      }));

      const req = { headers: {}, socket: { remoteAddress: '1.2.3.4' }, method: 'POST' };
      const result = await enforceInfluencerLoginLimits(req, '1.2.3.4', 'a@example.com');
      assert.equal(result.allowed, true);
    });

    it('blocks after max attempts (every-attempt consumption)', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      const policy = getPolicy('LOGIN_INFLUENCER');
      const ipMax = policy.buckets.find((b) => b.dimension === 'ip').max;

      setFetchForTests(async () => ({
        ok: true,
        json: async () => ({ result: ipMax + 1 }),
      }));

      const req = { headers: {}, socket: { remoteAddress: '1.2.3.4' }, method: 'POST' };
      const result = await enforceInfluencerLoginLimits(req, '1.2.3.4', 'a@example.com');
      assert.equal(result.allowed, false);
      assert.equal(result.statusCode, 429);
    });
  });

  describe('frozen attribution helpers', () => {
    const influencerId = '11111111-1111-4111-8111-111111111111';
    const promoId = '22222222-2222-4222-8222-222222222222';
    const otherPromoId = '33333333-3333-4333-8333-333333333333';

    it('builds or filter with legacy fallback when promos exist', () => {
      const filter = buildInfluencerAttributionOrFilter(influencerId, [promoId]);
      assert.match(filter, /influencer_id_at_registration\.eq/);
      assert.match(filter, /promo_code_id\.in/);
    });

    it('builds frozen-only filter when no promos assigned', () => {
      const filter = buildInfluencerAttributionOrFilter(influencerId, []);
      assert.equal(filter, `influencer_id_at_registration.eq.${influencerId}`);
    });

    it('attributes frozen rows to original influencer after promo reassignment', () => {
      const row = {
        promo_code_id: otherPromoId,
        influencer_id_at_registration: influencerId,
      };
      const promoSet = new Set([otherPromoId]);
      assert.equal(registrationAttributedToInfluencer(row, influencerId, promoSet), true);
      assert.equal(
        registrationAttributedToInfluencer(row, '99999999-9999-4999-8999-999999999999', promoSet),
        false
      );
    });

    it('uses legacy promo ownership only when frozen id is null', () => {
      const row = { promo_code_id: promoId, influencer_id_at_registration: null };
      assert.equal(
        registrationAttributedToInfluencer(row, influencerId, new Set([promoId])),
        true
      );
      assert.equal(
        registrationAttributedToInfluencer(row, influencerId, new Set()),
        false
      );
    });

    it('snapshots influencer id from promo at registration', () => {
      assert.equal(
        influencerIdAtRegistrationFromPromo({ influencer_id: influencerId }),
        influencerId
      );
      assert.equal(influencerIdAtRegistrationFromPromo({ influencer_id: null }), null);
      assert.equal(influencerIdAtRegistrationFromPromo(null), null);
    });
  });

  describe('promo assignment diff', () => {
    it('detects assigned and unassigned promo ids', () => {
      const diff = diffPromoAssignment(['a', 'b'], ['b', 'c']);
      assert.deepEqual(diff.unassigned, ['a']);
      assert.deepEqual(diff.assigned, ['c']);
    });
  });

  describe('loadActiveInfluencerById', () => {
    it('returns null for inactive influencer without a db mock', async () => {
      const fakeDb = {
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            async maybeSingle() {
              return {
                data: { id: 'x', is_active: false, email: 'x@y.com', password_hash: 'h' },
                error: null,
              };
            },
          };
        },
      };
      const row = await loadActiveInfluencerById(fakeDb, 'x');
      assert.equal(row, null);
    });
  });

  describe('admin audit writes', () => {
    it('inserts admin_logs row with safe payload', async () => {
      let inserted = null;
      const fakeDb = {
        from(table) {
          assert.equal(table, 'admin_logs');
          return {
            insert(payload) {
              inserted = payload;
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      await writeAcademyInfluencerAudit(fakeDb, {
        admin: { id: 'admin-1', name: 'Admin', email: 'admin@example.com' },
        action: 'academy_influencer_created',
        influencerId: 'inf-1',
        influencerEmail: 'inf@example.com',
        details: { promo_code_ids: ['p1'] },
      });
      assert.equal(inserted.action, 'academy_influencer_created');
      assert.equal(inserted.target_type, 'academy_influencer');
      assert.equal(inserted.target_id, 'inf-1');
      assert.equal(inserted.details.influencer_email, 'inf@example.com');
      assert.deepEqual(inserted.details.promo_code_ids, ['p1']);
      assert.equal(inserted.details.password_hash, undefined);
      assert.equal(inserted.details.temporaryPassword, undefined);
    });
  });
});
