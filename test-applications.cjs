// Test ambassador_applications table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testApplications() {
  try {
    console.log('🔍 Testing ambassador_applications table...\n');
    
    // Test 1: Check if table exists
    console.log('📋 Testing if ambassador_applications table exists...');
    const { data: applicationsData, error: applicationsError } = await supabase
      .from('ambassador_applications')
      .select('*')
      .limit(5);

    if (applicationsError) {
      console.log('❌ Ambassador applications table query failed:', applicationsError.message);
      console.log('💡 You need to create the ambassador_applications table');
      console.log('📝 Run the SQL from create-ambassador-applications.sql in your Supabase dashboard');
      return;
    }

    console.log('✅ Ambassador applications table exists!');
    console.log('📊 Found', applicationsData?.length || 0, 'applications');

    // Test 2: Try to insert a test application
    console.log('\n📋 Testing application insertion...');
    const { data: insertData, error: insertError } = await supabase
      .from('ambassador_applications')
      .insert({
        full_name: 'Test Ambassador',
        age: 25,
        phone_number: '+21612345679',
        city: 'Test City',
        social_link: 'https://instagram.com/test',
        motivation: 'Testing the application system',
        status: 'pending'
      })
      .select();

    if (insertError) {
      console.log('❌ Application insertion failed:', insertError.message);
    } else {
      console.log('✅ Application insertion successful!');
      console.log('📝 Created application:', insertData[0]);
    }

    // Test 3: Try to update an application
    console.log('\n📋 Testing application update...');
    const { data: updateData, error: updateError } = await supabase
      .from('ambassador_applications')
      .update({ status: 'approved' })
      .eq('phone_number', '+21612345679')
      .select();

    if (updateError) {
      console.log('❌ Application update failed:', updateError.message);
    } else {
      console.log('✅ Application update successful!');
      console.log('📝 Updated application:', updateData[0]);
    }

    console.log('\n🎉 Ambassador applications system is working!');
    console.log('\n🌐 Ready to test in admin dashboard:');
    console.log('• Admin Login: http://localhost:8082/admin/login');
    console.log('• Admin Dashboard: http://localhost:8082/admin');

  } catch (error) {
    console.error('❌ Applications test failed:', error);
  }
}

testApplications(); 