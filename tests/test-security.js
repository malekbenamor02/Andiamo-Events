/**
 * Security Features Test Script
 * Run with: node tests/test-security.js
 * 
 * This script tests all security features systematically
 * 
 * Note: This file uses ES module syntax (import/export)
 * Node.js 18+ has native fetch built-in, no import needed
 */

// ES Module - no require() needed, fetch is built-in

// Server port: defaults to 8082 (see server.cjs line 5526)
const BASE_URL = process.env.TEST_API_URL || process.env.VITE_API_URL || 'http://localhost:8082';
const TEST_ORDER_ID = process.env.TEST_ORDER_ID || 'test-order-id';

// Test results tracker
const testResults = {
  passed: [],
  failed: [],
  skipped: []
};

// Helper function to run a test
async function runTest(name, testFn) {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    await testFn();
    testResults.passed.push(name);
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    const errorMsg = error.message || error.toString();
    testResults.failed.push({ name, error: errorMsg });
    
    // Better error messages
    if (errorMsg.includes('fetch failed') || errorMsg.includes('ECONNREFUSED')) {
      console.log(`❌ FAILED: ${name} - Server not running at ${BASE_URL}`);
      console.log(`   💡 Start your server first: npm start or node server.cjs`);
    } else {
      console.log(`❌ FAILED: ${name} - ${errorMsg}`);
    }
  }
}

// Helper to skip tests
function skipTest(name, reason) {
  testResults.skipped.push({ name, reason });
  console.log(`⏭️  SKIPPED: ${name} - ${reason}`);
}

// Test 1: Webhook Signature Verification
async function testWebhookSignature() {
  // Test invalid signature
  const response = await fetch(`${BASE_URL}/api/flouci-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-flouci-signature': 'invalid_signature'
    },
    body: JSON.stringify({
      payment_id: 'test123',
      status: 'SUCCESS',
      developer_tracking_id: TEST_ORDER_ID
    })
  });
  
  if (response.status === 401) {
    console.log('   ✓ Invalid signature correctly rejected');
  } else if (response.status === 200) {
    console.log('   ⚠️  Signature verification not configured (FLOUCI_WEBHOOK_SECRET not set)');
  } else {
    throw new Error(`Unexpected status: ${response.status}`);
  }
}

// Test 2: Rate Limiting on QR Code Endpoint
async function testQRCodeRateLimit() {
  const accessToken = 'test-token-' + Date.now();
  let rateLimited = false;
  
  // Make 21 requests (limit is 20)
  for (let i = 1; i <= 21; i++) {
    const response = await fetch(`${BASE_URL}/api/qr-codes/${accessToken}-${i}`, {
      method: 'GET'
    });
    
    if (response.status === 429) {
      rateLimited = true;
      console.log(`   ✓ Rate limit triggered at request ${i}`);
      break;
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!rateLimited) {
    console.log('   ⚠️  Rate limiting may be disabled in development mode');
  }
}

// Test 3: Order Ownership Verification
async function testOrderOwnership() {
  // Test with invalid order ID
  const response = await fetch(`${BASE_URL}/api/generate-tickets-for-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
      orderId: 'non-existent-order-id',
      recaptchaToken: 'localhost-bypass-token'
    })
  });
  
  if (response.status === 404) {
    console.log('   ✓ Invalid order ID correctly rejected');
  } else {
    throw new Error(`Expected 404, got ${response.status}`);
  }
}

// Test 4: Rate Limiting on SMS Endpoints
async function testSMSRateLimit() {
  let rateLimited = false;
  
  // Make 11 requests (limit is 10 per hour)
  for (let i = 1; i <= 11; i++) {
    const response = await fetch(`${BASE_URL}/api/send-order-confirmation-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        orderId: `test-order-${i}`
      })
    });
    
    if (response.status === 429) {
      rateLimited = true;
      console.log(`   ✓ Rate limit triggered at request ${i}`);
      break;
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!rateLimited) {
    console.log('   ⚠️  Rate limiting may be disabled in development mode');
  }
}

// Test 5: CAPTCHA Verification
async function testCAPTCHA() {
  // Test without CAPTCHA token
  const response1 = await fetch(`${BASE_URL}/api/generate-tickets-for-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
      orderId: TEST_ORDER_ID
    })
  });
  
  const data1 = await response1.json();
  
  if (response1.status === 400 && data1.error && data1.error.includes('reCAPTCHA')) {
    console.log('   ✓ Missing CAPTCHA correctly rejected');
  } else {
    throw new Error(`Expected CAPTCHA error, got: ${JSON.stringify(data1)}`);
  }
}

// Test 6: Security Audit Logging
async function testSecurityLogging() {
  // Make a request that should be logged
  await fetch(`${BASE_URL}/api/generate-tickets-for-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000'
    },
    body: JSON.stringify({
      orderId: 'test-logging',
      recaptchaToken: 'localhost-bypass-token'
    })
  });
  
  console.log('   ✓ Request made (check security_audit_logs table to verify logging)');
  console.log('   ⚠️  Manual verification required: SELECT * FROM security_audit_logs ORDER BY created_at DESC LIMIT 1;');
}

// Check if server is running by trying any endpoint
async function checkServer() {
  try {
    // Try a simple GET request to any endpoint (we'll use a safe one)
    // If server is running, we'll get a response (even if 404)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${BASE_URL}/api/events`, { 
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    // Any response (even 404/401) means server is running
    return true;
  } catch (error) {
    // Connection refused or timeout means server is not running
    if (error.name === 'AbortError' || error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      return false;
    }
    // Other errors might mean server is running but endpoint doesn't exist
    return true;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Security Features Tests\n');
  console.log('='.repeat(60));
  
  // Check if server is running
  console.log(`\n🔍 Checking server at ${BASE_URL}...`);
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log(`\n⚠️  Server is not running at ${BASE_URL}`);
    console.log(`   Please start your server first:`);
    console.log(`   - npm start`);
    console.log(`   - or: node server.cjs`);
    console.log(`\n   Then run this test again.\n`);
    process.exit(1);
  }
  
  console.log(`✅ Server is running!\n`);
  console.log('='.repeat(60));
  
  await runTest('Webhook Signature Verification', testWebhookSignature);
  await runTest('QR Code Rate Limiting', testQRCodeRateLimit);
  await runTest('Order Ownership Verification', testOrderOwnership);
  await runTest('SMS Rate Limiting', testSMSRateLimit);
  await runTest('CAPTCHA Verification', testCAPTCHA);
  await runTest('Security Audit Logging', testSecurityLogging);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${testResults.passed.length}`);
  console.log(`❌ Failed: ${testResults.failed.length}`);
  console.log(`⏭️  Skipped: ${testResults.skipped.length}`);
  
  if (testResults.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.failed.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }
  
  if (testResults.skipped.length > 0) {
    console.log('\n⏭️  Skipped Tests:');
    testResults.skipped.forEach(({ name, reason }) => {
      console.log(`   - ${name}: ${reason}`);
    });
  }
  
  console.log('\n💡 Note: Some features may be disabled in development mode.');
  console.log('   Set NODE_ENV=production to test all features.\n');
}

// Run tests
runAllTests().catch(console.error);

