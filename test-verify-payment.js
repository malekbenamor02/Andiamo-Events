/**
 * Test script to manually verify a payment by orderId
 * Usage: node test-verify-payment.js <orderId>
 */

import https from 'https';
import http from 'http';

const orderId = process.argv[2];

if (!orderId) {
  console.error('❌ Please provide an order ID');
  console.log('Usage: node test-verify-payment.js <orderId>');
  process.exit(1);
}

const BASE_URL = process.env.API_URL || 'http://localhost:8082';
const fullUrl = `${BASE_URL}/api/flouci-verify-payment-by-order`;
const url = new URL(fullUrl);

async function testVerifyPayment() {
  console.log('🧪 Testing payment verification for order:', orderId);
  console.log('🌐 API URL:', fullUrl);
  console.log('');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ orderId });
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          
          console.log('📡 Response Status:', res.statusCode);
          console.log('📦 Response Data:', JSON.stringify(jsonData, null, 2));
          console.log('');

          if (res.statusCode === 200 && jsonData.success) {
            if (jsonData.status === 'SUCCESS' && jsonData.orderUpdated) {
              console.log('✅ SUCCESS: Payment verified and order updated to PAID!');
            } else if (jsonData.status === 'SUCCESS' && !jsonData.orderUpdated) {
              console.log('⚠️  Payment is SUCCESS but order update failed');
            } else {
              console.log(`ℹ️  Payment status: ${jsonData.status}`);
              console.log(`   Order updated: ${jsonData.orderUpdated ? 'Yes' : 'No'}`);
            }
          } else {
            console.log('❌ Verification failed:', jsonData.error || 'Unknown error');
          }
          
          resolve();
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

testVerifyPayment().catch(console.error);

