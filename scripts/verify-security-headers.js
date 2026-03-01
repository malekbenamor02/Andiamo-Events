#!/usr/bin/env node

/**
 * Security Headers Verification Script
 * 
 * Verifies that all security headers are present and correctly configured.
 * 
 * Usage:
 *   node scripts/verify-security-headers.js [url]
 * 
 * Example:
 *   node scripts/verify-security-headers.js https://www.andiamoevents.com
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

const REQUIRED_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': (value) => value && value.includes('geolocation=()'),
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-site',
  'strict-transport-security': (value) => value && value.includes('includeSubDomains') && value.includes('preload'),
  'content-security-policy-report-only': (value) => value && value.includes('report-uri'),
};

const OPTIONAL_HEADERS = {
  'x-xss-protection': null, // Legacy, not required
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
      value: headerValue
    };
  }
  
  if (headerValue.toLowerCase() === expectedValue.toLowerCase()) {
    return {
      present: true,
      valid: true,
      message: `✓ ${headerName} is correct`,
      value: headerValue
    };
  }
  
  return {
    present: true,
    valid: false,
    message: `✗ ${headerName} is incorrect. Expected: ${expectedValue}, Got: ${headerValue}`,
    value: headerValue
  };
}

function fetchHeaders(url) {
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

async function verifySecurityHeaders(url) {
  console.log(`\n🔒 Verifying security headers for: ${url}\n`);
  
  try {
    const { statusCode, headers } = await fetchHeaders(url);
    
    if (statusCode !== 200) {
      console.warn(`⚠️  Warning: Received status code ${statusCode} (expected 200)`);
    }
    
    console.log('Required Headers:');
    console.log('─'.repeat(60));
    
    let allValid = true;
    const results = {};
    
    for (const [headerName, expectedValue] of Object.entries(REQUIRED_HEADERS)) {
      const result = checkHeader(headers, headerName, expectedValue);
      results[headerName] = result;
      
      if (!result.valid) {
        allValid = false;
      }
      
      console.log(`  ${result.message}`);
      if (result.value) {
        console.log(`    Value: ${result.value.substring(0, 100)}${result.value.length > 100 ? '...' : ''}`);
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
    
    // Check security.txt
    console.log('\nSecurity.txt:');
    console.log('─'.repeat(60));
    
    try {
      const securityTxtUrl = new URL('/.well-known/security.txt', url).href;
      const { statusCode: txtStatus } = await fetchHeaders(securityTxtUrl);
      if (txtStatus === 200) {
        console.log(`  ✓ Security.txt is accessible at ${securityTxtUrl}`);
      } else {
        console.log(`  ✗ Security.txt returned status ${txtStatus}`);
        allValid = false;
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
    
    return { allValid, results };
    
  } catch (error) {
    console.error(`\n❌ Error verifying headers: ${error.message}\n`);
    process.exit(1);
  }
}

// Main
const url = process.argv[2] || 'https://www.andiamoevents.com';
verifySecurityHeaders(url).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
