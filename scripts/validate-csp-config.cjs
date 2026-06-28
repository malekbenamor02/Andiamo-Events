#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  CSP_POLICY,
  hasMalformedCspSpacing,
  isValidCspPolicy,
  cspPoliciesAreIdentical,
} = require('../lib/csp-policy.cjs');

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

for (const [label, value] of [
  ['Content-Security-Policy', enforcing?.value],
  ['Content-Security-Policy-Report-Only', reportOnly?.value],
]) {
  if (!value) continue;
  if (hasMalformedCspSpacing(value)) {
    fail(`vercel.json ${label} contains malformed directive spacing (e.g. style-src'self')`);
  }
  if (!isValidCspPolicy(value)) {
    fail(`vercel.json ${label} failed CSP policy validation`);
  }
}

if (enforcing?.value && reportOnly?.value) {
  if (!cspPoliciesAreIdentical(enforcing.value, reportOnly.value)) {
    fail('vercel.json enforcing and Report-Only CSP policies differ');
  } else {
    ok('vercel.json enforcing and Report-Only CSP policies are identical');
  }
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

if (hasMalformedCspSpacing(CSP_POLICY)) {
  fail('lib/csp-policy.cjs CSP_POLICY contains style-src\'self\' / connect-src\'self\' patterns');
}

// Regression guard: validator must reject the live bug pattern
const malformedSample = "default-src 'self'; style-src'self' 'unsafe-inline' https:; connect-src'self' https:; report-uri /api/csp-report;";
if (!hasMalformedCspSpacing(malformedSample) || isValidCspPolicy(malformedSample)) {
  fail('CSP validator does not reject style-src\'self\' malformed spacing');
} else {
  ok('CSP validator rejects style-src\'self\' malformed spacing');
}

const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  const built = fs.readFileSync(distIndex, 'utf8');
  const metaMatch = built.match(
    /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']*)["']/i
  );
  if (metaMatch) {
    fail('dist/index.html contains Content-Security-Policy meta tag (enforcing CSP must be HTTP headers only)');
  } else {
    ok('dist/index.html has no duplicate enforcing CSP meta tag');
  }
}

if (failed) {
  process.exit(1);
}

console.log('\nCSP config validation passed.\n');
