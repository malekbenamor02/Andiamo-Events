'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('handleAdminLogout global session invalidation', () => {
  it('returns 200 and clears cookie when token is missing (no error leak)', async () => {
    const setHeaderCalls = [];
    const res = {
      headersSent: false,
      setHeader(name, value) {
        setHeaderCalls.push([name, value]);
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    const { handleAdminLogout } = await import('./admin-logout-http.js');
    await handleAdminLogout({ headers: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const cookieHeader = setHeaderCalls.find(([n]) => n === 'Set-Cookie');
    assert.ok(cookieHeader);
    assert.match(cookieHeader[1], /adminToken=/);
  });
});

describe('bumpAdminSessionVersionOnLogout', () => {
  it('increments session_version in DB update payload', async () => {
    let updatePayload = null;
    const mockDb = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  single: async () => ({ data: { session_version: 4 }, error: null }),
                };
              },
            };
          },
          update(payload) {
            updatePayload = payload;
            return { eq: async () => ({ error: null }) };
          },
        };
      },
    };

    const { bumpAdminSessionVersionOnLogout } = await import('./admin-logout-http.js');
    const ok = await bumpAdminSessionVersionOnLogout(mockDb, 'admin-id-1');
    assert.equal(ok, true);
    assert.equal(updatePayload.session_version, 5);
  });
});
