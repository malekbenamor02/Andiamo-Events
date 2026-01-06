/**
 * Check Security Configuration
 * 
 * This script checks if all security-related environment variables are configured
 * 
 * Usage: node scripts/check-security-config.js
 */

import dotenv from 'dotenv';
dotenv.config();

const checks = {
  required: [],
  recommended: [],
  optional: []
};

// Required security variables
if (!process.env.FLOUCI_PUBLIC_KEY) {
  checks.required.push('FLOUCI_PUBLIC_KEY - Required for payment processing');
}
if (!process.env.FLOUCI_SECRET_KEY) {
  checks.required.push('FLOUCI_SECRET_KEY - Required for payment processing');
}
if (!process.env.RECAPTCHA_SECRET_KEY) {
  checks.recommended.push('RECAPTCHA_SECRET_KEY - Recommended for CAPTCHA protection');
}
if (!process.env.JWT_SECRET) {
  checks.required.push('JWT_SECRET - Required for admin authentication');
}

// Recommended security variables
if (!process.env.SECURITY_ALERT_EMAIL) {
  checks.recommended.push('SECURITY_ALERT_EMAIL - Recommended for security alerts');
}
if (!process.env.ENABLE_SECURITY_LOGGING) {
  checks.recommended.push('ENABLE_SECURITY_LOGGING - Recommended for security audit logging in development');
}

// Optional security variables
if (!process.env.FLOUCI_WEBHOOK_SECRET) {
  checks.optional.push('FLOUCI_WEBHOOK_SECRET - Optional (webhook already secured via API verification)');
}

// Display results
console.log('\n🔒 Security Configuration Check\n');
console.log('='.repeat(60));

if (checks.required.length === 0) {
  console.log('✅ Required: All required security variables are set');
} else {
  console.log('❌ Required (MUST SET):');
  checks.required.forEach(item => console.log(`   - ${item}`));
}

console.log('');

if (checks.recommended.length === 0) {
  console.log('✅ Recommended: All recommended security variables are set');
} else {
  console.log('⚠️  Recommended:');
  checks.recommended.forEach(item => console.log(`   - ${item}`));
}

console.log('');

if (checks.optional.length === 0) {
  console.log('✅ Optional: All optional security variables are set');
} else {
  console.log('ℹ️  Optional:');
  checks.optional.forEach(item => console.log(`   - ${item}`));
}

console.log('\n' + '='.repeat(60));

// Summary
const totalIssues = checks.required.length + checks.recommended.length;
if (totalIssues === 0) {
  console.log('\n✅ All security configurations are properly set!\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  Found ${totalIssues} configuration issue(s)\n`);
  if (checks.required.length > 0) {
    console.log('❌ CRITICAL: Fix required variables before deploying to production!\n');
    process.exit(1);
  }
  process.exit(0);
}

