'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

async function loadHelpers() {
  return import('./admin-data-route-helpers.js');
}

test('buildApplicationSyncPatchFromAmbassadorRow maps only shared profile fields', async () => {
  const { buildApplicationSyncPatchFromAmbassadorRow } = await loadHelpers();
  const patch = buildApplicationSyncPatchFromAmbassadorRow({
    full_name: 'Jane Doe',
    phone: '24123456',
    email: 'Jane@Example.com',
    city: 'Sousse',
    ville: 'Sahloul',
    status: 'approved',
    password: 'secret',
    extra_villes: ['Khezama'],
  });
  assert.deepEqual(patch, {
    full_name: 'Jane Doe',
    phone_number: '24123456',
    email: 'Jane@Example.com',
    city: 'Sousse',
    ville: 'Sahloul',
  });
});

test('buildApplicationSyncPatchFromAmbassadorRow includes only fields present in update', async () => {
  const { buildApplicationSyncPatchFromAmbassadorRow } = await loadHelpers();
  assert.deepEqual(
    buildApplicationSyncPatchFromAmbassadorRow({ email: 'new@example.com' }),
    { email: 'new@example.com' },
  );
  assert.deepEqual(buildApplicationSyncPatchFromAmbassadorRow({ password: 'hash' }), {});
});

test('isPostgresUniqueViolation detects constraint errors', async () => {
  const { isPostgresUniqueViolation } = await loadHelpers();
  assert.equal(isPostgresUniqueViolation({ code: '23505' }), true);
  assert.equal(isPostgresUniqueViolation({ message: 'duplicate key value violates unique constraint' }), true);
  assert.equal(isPostgresUniqueViolation({ message: 'other error' }), false);
});

function createApplicationsMock(rows) {
  return {
    from(table) {
      assert.equal(table, 'ambassador_applications');
      const state = { filters: [] };
      const builder = {
        select() {
          return builder;
        },
        eq(col, val) {
          state.filters.push({ type: 'eq', col, val });
          return builder;
        },
        in(col, vals) {
          state.filters.push({ type: 'in', col, val: vals });
          return builder;
        },
        neq(col, val) {
          state.filters.push({ type: 'neq', col, val });
          return builder;
        },
        order() {
          return builder;
        },
        limit(n) {
          state.limit = n;
          return builder;
        },
        async maybeSingle() {
          const statusEq = state.filters.find((f) => f.type === 'eq' && f.col === 'status');
          const phoneEq = state.filters.find((f) => f.type === 'eq' && f.col === 'phone_number');
          const match = rows.find(
            (r) =>
              (!statusEq || r.status === statusEq.val) &&
              (!phoneEq || r.phone_number === phoneEq.val),
          );
          return { data: match || null, error: null };
        },
        async then(resolve) {
          let filtered = [...rows];
          for (const f of state.filters) {
            if (f.type === 'eq') filtered = filtered.filter((r) => r[f.col] === f.val);
            if (f.type === 'in') filtered = filtered.filter((r) => f.val.includes(r[f.col]));
            if (f.type === 'neq') filtered = filtered.filter((r) => r[f.col] !== f.val);
          }
          if (state.limit != null) filtered = filtered.slice(0, state.limit);
          resolve({ data: filtered, error: null });
        },
      };
      return builder;
    },
  };
}

test('findLatestApprovedApplicationByPhone returns latest approved row', async () => {
  const { findLatestApprovedApplicationByPhone } = await loadHelpers();
  const db = createApplicationsMock([
    { id: 'a1', phone_number: '24123456', status: 'approved', created_at: '2026-01-01' },
    { id: 'a2', phone_number: '24123456', status: 'pending', created_at: '2026-02-01' },
  ]);
  const row = await findLatestApprovedApplicationByPhone(db, '24123456');
  assert.equal(row.id, 'a1');
});

test('validateApplicationSyncConflicts rejects duplicate email', async () => {
  const { validateApplicationSyncConflicts } = await loadHelpers();
  const db = createApplicationsMock([
    { id: 'other', email: 'taken@example.com', status: 'pending' },
    { id: 'linked', email: 'old@example.com', status: 'approved' },
  ]);
  const result = await validateApplicationSyncConflicts(db, {
    syncPatch: { email: 'taken@example.com' },
    linkedApplicationId: 'linked',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /email/i);
});

test('validateApplicationSyncConflicts rejects duplicate phone', async () => {
  const { validateApplicationSyncConflicts } = await loadHelpers();
  const db = createApplicationsMock([
    { id: 'other', phone_number: '24999999', status: 'approved' },
    { id: 'linked', phone_number: '24123456', status: 'approved' },
  ]);
  const result = await validateApplicationSyncConflicts(db, {
    syncPatch: { phone_number: '24999999' },
    linkedApplicationId: 'linked',
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /phone/i);
});

test('validateApplicationSyncConflicts allows unchanged contact on linked row', async () => {
  const { validateApplicationSyncConflicts } = await loadHelpers();
  const db = createApplicationsMock([
    { id: 'linked', email: 'same@example.com', phone_number: '24123456', status: 'approved' },
  ]);
  const result = await validateApplicationSyncConflicts(db, {
    syncPatch: { email: 'same@example.com', phone_number: '24123456', full_name: 'New Name' },
    linkedApplicationId: 'linked',
  });
  assert.equal(result.ok, true);
});

test('password-only ambassador patch produces empty application sync patch', async () => {
  const { buildApplicationSyncPatchFromAmbassadorRow } = await loadHelpers();
  assert.deepEqual(buildApplicationSyncPatchFromAmbassadorRow({ password: 'abc123' }), {});
});
