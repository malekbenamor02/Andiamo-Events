#!/usr/bin/env node

/**
 * Security Headers Verification Script
 *
 * Uses curl raw output (same path as manual checks) and validates CSP formatting.
 *
 * Usage:
 *   node scripts/verify-security-headers.js [url]
 *
 * Example:
 *   node scripts/verify-security-headers.js https://www.andiamoevents.com
 */

import { execFileSync } from 'child_process';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  CSP_POLICY,
  hasMalformedCspSpacing,
  isValidCspPolicy,
  cspPoliciesAreIdentical,
} = require('../lib/csp-policy.cjs');

const REQUIRED_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': (value) => value && value.includes('geolocation=()'),
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-site',
  'strict-transport-security': (value) =>
    value && value.includes('includeSubDomains') && value.includes('preload'),
};

const OPTIONAL_HEADERS = {
  'x-xss-protection': null,
};

function checkHeader(headers, headerName, expectedValue) {
  const headerValue = headers[headerName.toLowerCase()];

  if (!headerValue) {
    return { present: false, valid: false, message: `Missing ${headerName}` };
  }

  if (typeof expectedValue === 'function') {
    const isValid = expectedValue(headerValue);
    return {
      present: true,
      valid: isValid,
      message: isValid ? `✓ ${headerName} is valid` : `✗ ${headerName} is invalid: ${headerValue}`,
      value: headerValue,
    };
  }

  if (headerValue.toLowerCase() === expectedValue.toLowerCase()) {
    return {
      present: true,
      valid: true,
      message: `✓ ${headerName} is correct`,
      value: headerValue,
    };
  }

  return {
    present: true,
    valid: false,
    message: `✗ ${headerName} is incorrect. Expected: ${expectedValue}, Got: ${headerValue}`,
    value: headerValue,
  };
}

/** Unfold RFC 7230 header continuation lines from curl -I output. */
function parseCurlHeaders(raw) {
  const unfolded = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    if (/^[\t ]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += ` ${line.trim()}`;
    } else if (line.includes(':')) {
      unfolded.push(line);
    }
  }

  const headers = {};
  for (const line of unfolded) {
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }
  return headers;
}

function fetchHeadersWithCurl(url) {
  const raw = execFileSync('curl.exe', ['-sS', '-I', url], {
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
  return parseCurlHeaders(raw);
}

function fetchHeadersNode(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'HEAD',
      timeout: 10000,
    };

    const req = client.request(options, (res) => {
      const headers = {};
      for (const [key, value] of Object.entries(res.headers)) {
        headers[key.toLowerCase()] = value;
      }
      resolve({ statusCode: res.statusCode, headers });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function validateCspPair(enforcing, reportOnly) {
  const issues = [];

  if (!enforcing) {
    issues.push('Missing Content-Security-Policy header');
  }
  if (!reportOnly) {
    issues.push('Missing Content-Security-Policy-Report-Only header');
  }

  if (enforcing && hasMalformedCspSpacing(enforcing)) {
    issues.push(
      "Content-Security-Policy contains malformed spacing (e.g. script-src'self', style-src'self', connect-src'self')"
    );
  }
  if (reportOnly && hasMalformedCspSpacing(reportOnly)) {
    issues.push('Content-Security-Policy-Report-Only contains malformed directive spacing');
  }

  if (enforcing && !isValidCspPolicy(enforcing)) {
    issues.push('Content-Security-Policy failed directive validation');
  }
  if (reportOnly && !isValidCspPolicy(reportOnly)) {
    issues.push('Content-Security-Policy-Report-Only failed directive validation');
  }

  if (enforcing && reportOnly && !cspPoliciesAreIdentical(enforcing, reportOnly)) {
    issues.push('Content-Security-Policy and Content-Security-Policy-Report-Only differ');
  }

  if (enforcing && reportOnly && enforcing !== reportOnly) {
    issues.push('Content-Security-Policy and Content-Security-Policy-Report-Only are not byte-identical');
  }

  return issues;
}

function snippetAroundDirective(value, directive) {
  const idx = String(value || '').toLowerCase().indexOf(directive);
  if (idx === -1) return `(${directive} not found)`;
  return String(value).slice(idx, idx + 48);
}

async function verifySecurityHeaders(url) {
  console.log(`\n🔒 Verifying security headers for: ${url}\n`);

  let allValid = true;

  try {
    let headers;
    let usedCurl = false;
    try {
      headers = fetchHeadersWithCurl(url);
      usedCurl = true;
      console.log('Header source: curl.exe -sS -I (raw, unfolded)\n');
    } catch (curlError) {
      console.warn(`⚠️  curl unavailable (${curlError.message}); falling back to Node https\n`);
      const nodeResult = await fetchHeadersNode(url);
      headers = nodeResult.headers;
      if (nodeResult.statusCode !== 200) {
        console.warn(`⚠️  Warning: Received status code ${nodeResult.statusCode} (expected 200)`);
      }
    }

    const csp = headers['content-security-policy'];
    const cspRo = headers['content-security-policy-report-only'];

    console.log('Required Headers:');
    console.log('─'.repeat(60));

    for (const [headerName, expectedValue] of Object.entries(REQUIRED_HEADERS)) {
      const result = checkHeader(headers, headerName, expectedValue);
      if (!result.valid) allValid = false;
      console.log(`  ${result.message}`);
      if (result.value) {
        console.log(
          `    Value: ${result.value.substring(0, 100)}${result.value.length > 100 ? '...' : ''}`
        );
      }
    }

    console.log('\nContent-Security-Policy:');
    console.log('─'.repeat(60));

    const cspIssues = validateCspPair(csp, cspRo);
    if (cspIssues.length === 0) {
      console.log('  ✓ Content-Security-Policy is present and valid');
      console.log('  ✓ Content-Security-Policy-Report-Only is present and valid');
      console.log('  ✓ Enforcing and Report-Only policies are identical');
      console.log(`    style-src fragment: ${snippetAroundDirective(csp, 'style-src')}`);
      console.log(`    script-src fragment: ${snippetAroundDirective(csp, 'script-src')}`);
      console.log(`    connect-src fragment: ${snippetAroundDirective(csp, 'connect-src')}`);
    } else {
      allValid = false;
      for (const issue of cspIssues) {
        console.log(`  ✗ ${issue}`);
      }
      if (csp) {
        console.log(`    Enforcing style-src fragment: ${snippetAroundDirective(csp, 'style-src')}`);
        console.log(`    Enforcing script-src fragment: ${snippetAroundDirective(csp, 'script-src')}`);
        console.log(`    Enforcing connect-src fragment: ${snippetAroundDirective(csp, 'connect-src')}`);
      }
      if (cspRo) {
        console.log(`    Report-Only style-src fragment: ${snippetAroundDirective(cspRo, 'style-src')}`);
        console.log(`    Report-Only script-src fragment: ${snippetAroundDirective(cspRo, 'script-src')}`);
        console.log(`    Report-Only connect-src fragment: ${snippetAroundDirective(cspRo, 'connect-src')}`);
      }
    }

    if (usedCurl && csp && cspRo) {
      const probes = [];
      for (let i = 1; i <= 3; i += 1) {
        try {
          const probeHeaders = fetchHeadersWithCurl(`${url}${url.includes('?') ? '&' : '?'}csp_probe=${i}`);
          probes.push({
            enforcing: probeHeaders['content-security-policy'],
            reportOnly: probeHeaders['content-security-policy-report-only'],
          });
        } catch {
          // optional probes
        }
      }

      for (const [index, probe] of probes.entries()) {
        const probeIssues = validateCspPair(probe.enforcing, probe.reportOnly);
        if (probeIssues.length > 0) {
          allValid = false;
          console.log(`  ✗ CSP probe ${index + 1} failed: ${probeIssues.join('; ')}`);
          if (probe.enforcing) {
            console.log(`    Probe script-src fragment: ${snippetAroundDirective(probe.enforcing, 'script-src')}`);
          }
        }
      }
    }

    if (CSP_POLICY && csp && !cspPoliciesAreIdentical(csp, CSP_POLICY)) {
      console.log('  ⚠️  Live CSP differs from lib/csp-policy.cjs (deploy may be pending)');
    }

    console.log('\nCSP hardening review (warnings only — do not fail deploy):');
    console.log('─'.repeat(60));
    const cspValue = csp || '';
    for (const [label, re] of [
      ["'unsafe-inline' in script-src or default-src", /unsafe-inline/i],
      ["'unsafe-eval' in script-src or default-src", /unsafe-eval/i],
    ]) {
      if (re.test(cspValue)) {
        console.log(`  ⚠️  CSP contains ${label}`);
      } else {
        console.log(`  ✓ CSP does not contain ${label}`);
      }
    }

    console.log('\nOptional Headers:');
    console.log('─'.repeat(60));

    for (const [headerName] of Object.entries(OPTIONAL_HEADERS)) {
      const result = checkHeader(headers, headerName, null);
      if (result.present) {
        console.log(`  ℹ️  ${headerName} is present (legacy header, not required)`);
      }
    }

    console.log('\nSecurity.txt:');
    console.log('─'.repeat(60));

    try {
      const securityTxtUrl = new URL('/.well-known/security.txt', url).href;
      if (usedCurl) {
        const txtRaw = execFileSync('curl.exe', ['-sS', '-I', securityTxtUrl], {
          encoding: 'utf8',
        });
        const statusLine = txtRaw.split(/\r?\n/)[0] || '';
        const txtStatus = Number(statusLine.match(/\s(\d{3})\s/)?.[1] || 0);
        if (txtStatus === 200) {
          console.log(`  ✓ Security.txt is accessible at ${securityTxtUrl}`);
        } else {
          console.log(`  ✗ Security.txt returned status ${txtStatus}`);
          allValid = false;
        }
      } else {
        const { statusCode: txtStatus } = await fetchHeadersNode(securityTxtUrl);
        if (txtStatus === 200) {
          console.log(`  ✓ Security.txt is accessible at ${securityTxtUrl}`);
        } else {
          console.log(`  ✗ Security.txt returned status ${txtStatus}`);
          allValid = false;
        }
      }
    } catch (error) {
      console.log(`  ✗ Security.txt check failed: ${error.message}`);
      allValid = false;
    }

    console.log('\n' + '═'.repeat(60));
    if (allValid) {
      console.log('✅ All security headers are present and valid!');
    } else {
      console.log('❌ Some security headers are missing or invalid.');
      console.log('   Please review the output above and fix any issues.');
    }
    console.log('═'.repeat(60) + '\n');

    if (!allValid) {
      process.exit(1);
    }

    return { allValid };
  } catch (error) {
    console.error(`\n❌ Error verifying headers: ${error.message}\n`);
    process.exit(1);
  }
}

const url = process.argv[2] || 'https://www.andiamoevents.com';
verifySecurityHeaders(url).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
