// Test JWT Token Expiration
const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('🧪 Testing JWT Token Expiration...\n');

// Create a token that expires in 1 second
const expiredToken = jwt.sign(
  { 
    id: 'test-admin-id', 
    email: 'admin@andiamo.com', 
    role: 'admin' 
  }, 
  process.env.JWT_SECRET || 'fallback-secret', 
  { expiresIn: '1s' }
);

console.log('1️⃣ Created token that expires in 1 second');
console.log('Token:', expiredToken);

// Wait 2 seconds for token to expire
setTimeout(() => {
  console.log('\n2️⃣ Testing expired token...');
  
  try {
    const decoded = jwt.verify(expiredToken, process.env.JWT_SECRET || 'fallback-secret');
    console.log('❌ Token should be expired but was verified:', decoded);
  } catch (error) {
    console.log('✅ Token correctly expired!');
    console.log('Error:', error.message);
  }
}, 2000);

// Create a valid token (2 hours)
const validToken = jwt.sign(
  { 
    id: 'test-admin-id', 
    email: 'admin@andiamo.com', 
    role: 'admin' 
  }, 
  process.env.JWT_SECRET || 'fallback-secret', 
  { expiresIn: '2h' }
);

console.log('\n3️⃣ Created valid token (2 hours)');
console.log('Valid Token:', validToken);

// Test valid token
try {
  const decoded = jwt.verify(validToken, process.env.JWT_SECRET || 'fallback-secret');
  console.log('✅ Valid token verified successfully!');
  console.log('Payload:', decoded);
} catch (error) {
  console.log('❌ Valid token failed verification:', error.message);
} 