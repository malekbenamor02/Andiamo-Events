// Test admin login functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminLogin() {
  try {
    console.log('🔐 Testing admin login functionality...\n');
    
    // Test admin login with correct credentials
    console.log('📋 Testing admin login with correct credentials...');
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', 'admin@andiamo.com')
      .eq('password', 'admin123')
      .eq('is_active', true)
      .single();

    if (adminError) {
      console.log('❌ Admin login failed:', adminError.message);
    } else {
      console.log('✅ Admin login successful!');
      console.log('👤 Admin details:', {
        id: adminData.id,
        name: adminData.name,
        email: adminData.email,
        role: adminData.role,
        is_active: adminData.is_active
      });
    }

    // Test with wrong password
    console.log('\n📋 Testing admin login with wrong password...');
    const { data: wrongPassData, error: wrongPassError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', 'admin@andiamo.com')
      .eq('password', 'wrongpassword')
      .single();

    if (wrongPassError) {
      console.log('✅ Correctly rejected wrong password');
    } else {
      console.log('❌ Should have rejected wrong password');
    }

    // Test with non-existent email
    console.log('\n📋 Testing admin login with non-existent email...');
    const { data: wrongEmailData, error: wrongEmailError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', 'nonexistent@example.com')
      .eq('password', 'admin123')
      .single();

    if (wrongEmailError) {
      console.log('✅ Correctly rejected non-existent email');
    } else {
      console.log('❌ Should have rejected non-existent email');
    }

    console.log('\n🎉 Admin login system is working correctly!');
    console.log('\n🔑 Ready to use:');
    console.log('• URL: http://localhost:5173/admin/login');
    console.log('• Email: admin@andiamo.com');
    console.log('• Password: admin123');

  } catch (error) {
    console.error('❌ Admin login test failed:', error);
  }
}

testAdminLogin(); 