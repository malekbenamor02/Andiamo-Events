// Test JWT Authentication
const fetch = require('node-fetch');

async function testJWTAuth() {
  console.log('🧪 Testing JWT Authentication...\n');

  try {
    // Test 1: Try to login with valid credentials
    console.log('1️⃣ Testing admin login...');
    const loginResponse = await fetch('http://localhost:8081/api/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@andiamo.com',
        password: 'adminpassword'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login Response:', loginData);
    console.log('Login Status:', loginResponse.status);
    console.log('Cookies:', loginResponse.headers.get('set-cookie'));
    console.log('✅ Login test completed\n');

    // Test 2: Try to logout
    console.log('2️⃣ Testing admin logout...');
    const logoutResponse = await fetch('http://localhost:8081/api/admin-logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const logoutData = await logoutResponse.json();
    console.log('Logout Response:', logoutData);
    console.log('Logout Status:', logoutResponse.status);
    console.log('✅ Logout test completed\n');

    // Test 3: Test invalid credentials
    console.log('3️⃣ Testing invalid credentials...');
    const invalidResponse = await fetch('http://localhost:8081/api/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'wrong@email.com',
        password: 'wrongpassword'
      })
    });

    const invalidData = await invalidResponse.json();
    console.log('Invalid Login Response:', invalidData);
    console.log('Invalid Login Status:', invalidResponse.status);
    console.log('✅ Invalid credentials test completed\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testJWTAuth(); 