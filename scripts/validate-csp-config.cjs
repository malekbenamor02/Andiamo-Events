#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { CSP_POLICY, isValidCspPolicy } = require('../lib/csp-policy.cjs');

const vercelPath = path.join(__dirname, '..', 'vercel.json');
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
const globalHeaders = vercel.headers?.[0]?.headers || [];
const enforcing = globalHeaders.find((h) => h.key === 'Content-Security-Policy');
const reportOnly = globalHeaders.find((h) => h.key === 'Content-Security-Policy-Report-Only');

let failed = false;

function fail(msg) {
  console.error(`✗ ${msg}`);
  failed = true;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

if (!enforcing?.value) fail('vercel.json missing Content-Security-Policy');
if (!reportOnly?.value) fail('vercel.json missing Content-Security-Policy-Report-Only');

if (enforcing?.value && !isValidCspPolicy(enforcing.value)) {
  fail('vercel.json Content-Security-Policy has invalid directive formatting');
}
if (reportOnly?.value && !isValidCspPolicy(reportOnly.value)) {
  fail('vercel.json Content-Security-Policy-Report-Only has invalid directive formatting');
}

if (enforcing?.value && reportOnly?.value && enforcing.value !== reportOnly.value) {
  fail('vercel.json enforcing and Report-Only CSP policies differ');
} else if (enforcing?.value && reportOnly?.value) {
  ok('vercel.json enforcing and Report-Only CSP policies are identical');
}

if (enforcing?.value && enforcing.value !== CSP_POLICY) {
  fail('vercel.json Content-Security-Policy does not match lib/csp-policy.cjs');
} else if (enforcing?.value) {
  ok('vercel.json Content-Security-Policy matches lib/csp-policy.cjs');
}

if (!isValidCspPolicy(CSP_POLICY)) {
  fail('lib/csp-policy.cjs CSP_POLICY is malformed');
} else {
  ok('lib/csp-policy.cjs CSP_POLICY formatting is valid');
}

if (failed) {
  process.exit(1);
}

console.log('\nCSP config validation passed.\n');
