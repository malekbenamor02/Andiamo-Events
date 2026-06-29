#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { CSP_POLICY } = require('../lib/csp-policy.cjs');

const vercelPath = path.join(__dirname, '..', 'vercel.json');
const vercel = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
const globalHeaders = vercel.headers?.[0]?.headers || [];

for (const header of globalHeaders) {
  if (
    header.key === 'Content-Security-Policy' ||
    header.key === 'Content-Security-Policy-Report-Only'
  ) {
    header.value = CSP_POLICY;
  }
}

fs.writeFileSync(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`, 'utf8');
console.log('Synced vercel.json CSP headers from lib/csp-policy.cjs');
