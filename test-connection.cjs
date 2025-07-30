// Test Supabase connection and help identify correct API keys
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Test with the key from the client file
const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('📡 URL:', supabaseUrl);
    console.log('🔑 Key:', supabaseKey.substring(0, 20) + '...');
    
    // Test basic connection by trying to fetch from events table
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Connection failed:', error.message);
      console.log('\n💡 To fix this:');
      console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
      console.log('2. Select your project');
      console.log('3. Go to Settings > API');
      console.log('4. Copy the "anon public" key');
      console.log('5. Update the key in setup-database.cjs');
    } else {
      console.log('✅ Connection successful!');
      console.log('📊 Found', data?.length || 0, 'events in database');
      
      // Now try to create the admin user
      console.log('\n📋 Testing admin user creation...');
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .upsert({
          name: 'Admin',
          email: 'admin@andiamo.com',
          password: 'admin123',
          role: 'admin',
          is_active: true
        }, {
          onConflict: 'email'
        });

      if (adminError) {
        console.log('❌ Admin creation failed:', adminError.message);
        console.log('💡 This might be because the admins table doesn\'t exist yet');
      } else {
        console.log('✅ Admin user created/updated successfully!');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConnection(); 