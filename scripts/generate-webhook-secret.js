/**
 * Generate a secure random webhook secret for FLOUCI_WEBHOOK_SECRET
 * 
 * Usage: node scripts/generate-webhook-secret.js
 */

import crypto from 'crypto';

// Generate a secure random secret (64 characters, hex encoded)
const secret = crypto.randomBytes(32).toString('hex');

console.log('\n🔐 Generated Webhook Secret:\n');
console.log('='.repeat(60));
console.log(secret);
console.log('='.repeat(60));
console.log('\n📝 Add this to your .env file:');
console.log(`FLOUCI_WEBHOOK_SECRET=${secret}\n`);
console.log('⚠️  Note: This is optional. The webhook is already secure');
console.log('   because we verify payments with Flouci API.\n');

