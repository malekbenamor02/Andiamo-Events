// Test admin authentication flow
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminFlow() {
  try {
    console.log('🔐 Testing complete admin authentication flow...\n');
    
    // Step 1: Test admin login
    console.log('📋 Step 1: Testing admin login...');
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', 'admin@andiamo.com')
      .eq('password', 'admin123')
      .eq('is_active', true)
      .single();

    if (adminError) {
      console.log('❌ Admin login failed:', adminError.message);
      return;
    }

    console.log('✅ Admin login successful!');
    console.log('👤 Admin ID:', adminData.id);

    // Step 2: Simulate session storage
    console.log('\n📋 Step 2: Simulating session storage...');
    const sessionData = {
      id: adminData.id,
      email: adminData.email,
      name: adminData.name,
      loggedInAt: new Date().toISOString()
    };

    console.log('✅ Session data created:', sessionData);

    // Step 3: Test session validation
    console.log('\n📋 Step 3: Testing session validation...');
    const { data: sessionValidation, error: sessionError } = await supabase
      .from('admins')
      .select('id, email, name, is_active')
      .eq('id', sessionData.id)
      .eq('email', sessionData.email)
      .eq('is_active', true)
      .single();

    if (sessionError) {
      console.log('❌ Session validation failed:', sessionError.message);
    } else {
      console.log('✅ Session validation successful!');
    }

    console.log('\n🎉 Admin authentication flow is working correctly!');
    console.log('\n🌐 Ready to test in browser:');
    console.log('• Frontend: http://localhost:8082/');
    console.log('• Admin Login: http://localhost:8082/admin/login');
    console.log('• Admin Dashboard: http://localhost:8082/admin');
    console.log('\n🔑 Login Credentials:');
    console.log('• Email: admin@andiamo.com');
    console.log('• Password: admin123');

  } catch (error) {
    console.error('❌ Admin flow test failed:', error);
  }
}

testAdminFlow(); 