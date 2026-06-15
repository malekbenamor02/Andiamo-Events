'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sha256 } = require('./user-data.cjs');
const {
  parseAttributionFromBody,
  buildCanonicalAmbassadorLeadEvent,
  buildCapiLeadServerEvent,
  validateLeadConsistency,
  redactServerEventForDebug,
} = require('./ambassador-lead-tracking.cjs');

const sampleApplication = {
  id: 'app-abc-123',
  full_name: 'Jane Doe',
  phone_number: '22123456',
  email: 'jane@example.com',
  city: 'Sousse',
  meta_attribution: {
    eventId: 'lead_1700000000_abc12xyz',
    fbp: 'fb.1.test',
    fbc: 'fb.2.test',
    eventSourceUrl: 'https://andiamoevents.com/ambassador',
    clientIp: '203.0.113.1',
    clientUserAgent: 'Mozilla/5.0',
  },
};

test('parseAttributionFromBody reads meta fields and request context', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'Mozilla/5.0 Test' },
    get: (name) => (name === 'user-agent' ? 'Mozilla/5.0 Test' : undefined),
  };
  const attr = parseAttributionFromBody(req, {
    metaEventId: 'lead_123',
    metaFbp: 'fb.1.x',
    metaFbc: 'fb.2.y',
    metaEventSourceUrl: 'https://example.com/ambassador',
  });

  assert.ok(attr);
  assert.strictEqual(attr.eventId, 'lead_123');
  assert.strictEqual(attr.fbp, 'fb.1.x');
  assert.strictEqual(attr.fbc, 'fb.2.y');
  assert.strictEqual(attr.eventSourceUrl, 'https://example.com/ambassador');
  assert.strictEqual(attr.clientIp, '203.0.113.10');
  assert.strictEqual(attr.clientUserAgent, 'Mozilla/5.0 Test');
});

test('buildCanonicalAmbassadorLeadEvent requires eventId', () => {
  const canonical = buildCanonicalAmbassadorLeadEvent({
    application: { id: 'x', full_name: 'A', phone_number: '22123456', email: 'a@b.com', city: 'Tunis' },
    attribution: {},
  });
  assert.strictEqual(canonical, null);
});

test('buildCapiLeadServerEvent uses stored eventId and hashed user_data', () => {
  const canonical = buildCanonicalAmbassadorLeadEvent({ application: sampleApplication });
  assert.ok(canonical);

  const capi = buildCapiLeadServerEvent(canonical);
  assert.ok(capi);
  assert.strictEqual(capi.event_name, 'Lead');
  assert.strictEqual(capi.event_id, 'lead_1700000000_abc12xyz');
  assert.strictEqual(capi.action_source, 'website');
  assert.strictEqual(capi.event_source_url, 'https://andiamoevents.com/ambassador');
  assert.strictEqual(capi.custom_data.content_name, 'Ambassador Application');
  assert.strictEqual(capi.user_data.fbp, 'fb.1.test');
  assert.strictEqual(capi.user_data.fbc, 'fb.2.test');
  assert.strictEqual(capi.user_data.client_ip_address, '203.0.113.1');
  assert.strictEqual(capi.user_data.client_user_agent, 'Mozilla/5.0');
  assert.strictEqual(capi.user_data.em, sha256('jane@example.com'));
  assert.strictEqual(capi.user_data.ph, sha256('21622123456'));
  assert.ok(capi.user_data.fn);
  assert.ok(capi.user_data.ct);
  assert.notStrictEqual(Object.prototype.hasOwnProperty.call(capi.custom_data, 'fbp'), true);
  assert.notStrictEqual(Object.prototype.hasOwnProperty.call(capi.custom_data, 'fbc'), true);
});

test('buildCapiLeadServerEvent returns null without canonical', () => {
  assert.strictEqual(buildCapiLeadServerEvent(null), null);
});

test('validateLeadConsistency warns when fbp and fbc are both missing', () => {
  const canonical = buildCanonicalAmbassadorLeadEvent({
    application: {
      id: 'app-1',
      full_name: 'Jane Doe',
      phone_number: '22123456',
      email: 'jane@example.com',
      city: 'Tunis',
    },
    attribution: { eventId: 'lead_test_1' },
  });
  assert.ok(canonical);
  const warnings = validateLeadConsistency(canonical);
  assert.ok(warnings.includes('missing_fbp_and_fbc'));
});

test('redactServerEventForDebug never exposes raw hashed PII values as readable email', () => {
  const canonical = buildCanonicalAmbassadorLeadEvent({ application: sampleApplication });
  const serverEvent = buildCapiLeadServerEvent(canonical);
  const redacted = redactServerEventForDebug(serverEvent);
  assert.strictEqual(redacted.user_data.em, '[hashed]');
  assert.strictEqual(redacted.user_data.ph, '[hashed]');
  assert.notStrictEqual(redacted.user_data.em, sha256('jane@example.com'));
});
