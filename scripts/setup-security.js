/**
 * Security Setup Helper Script
 * 
 * This script helps you set up security configuration
 * 
 * Usage: node scripts/setup-security.js
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n🔒 Security Setup Helper\n');
  console.log('='.repeat(60));
  console.log('This script will help you configure security settings.\n');

  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), 'env.example');
  
  // Check if .env exists
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Found .env file\n');
  } else {
    console.log('⚠️  .env file not found. Creating from env.example...\n');
    if (fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, 'utf8');
    }
  }

  const updates = [];

  // Check SECURITY_ALERT_EMAIL
  if (!envContent.includes('SECURITY_ALERT_EMAIL=')) {
    const email = await question('Enter SECURITY_ALERT_EMAIL (optional, press Enter to skip): ');
    if (email.trim()) {
      envContent += `\n# Security Monitoring & Alerts\nSECURITY_ALERT_EMAIL=${email.trim()}\n`;
      updates.push('✅ Added SECURITY_ALERT_EMAIL');
    }
  }

  // Check ENABLE_SECURITY_LOGGING
  if (!envContent.includes('ENABLE_SECURITY_LOGGING=')) {
    const enable = await question('Enable security logging in development? (y/n, default: n): ');
    if (enable.toLowerCase() === 'y') {
      envContent += `\nENABLE_SECURITY_LOGGING=true\n`;
      updates.push('✅ Enabled security logging');
    }
  }

  // Save .env file
  if (updates.length > 0) {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Updated .env file:');
    updates.forEach(update => console.log(`   ${update}`));
  } else {
    console.log('\n✅ No updates needed. Security configuration looks good!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n💡 Next steps:');
  console.log('   1. Review your .env file');
  console.log('   2. Run: node scripts/check-security-config.js');
  console.log('   3. Apply database migration: supabase migration up');
  console.log('   4. Test security features: node tests/test-security.js\n');

  rl.close();
}

main().catch(console.error);

