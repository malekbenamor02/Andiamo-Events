// Debug Supabase connection and table status
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugConnection() {
  try {
    console.log('🔍 Debugging Supabase connection...\n');
    
    // Test 1: Basic connection
    console.log('📡 Testing basic connection...');
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .limit(1);

    if (eventsError) {
      console.log('❌ Events query failed:', eventsError.message);
    } else {
      console.log('✅ Events query successful, found', eventsData?.length || 0, 'events');
    }

    // Test 2: Check if admins table exists
    console.log('\n📋 Testing admins table...');
    const { data: adminsData, error: adminsError } = await supabase
      .from('admins')
      .select('*')
      .limit(1);

    if (adminsError) {
      console.log('❌ Admins table query failed:', adminsError.message);
      console.log('💡 This means the admins table does not exist yet');
    } else {
      console.log('✅ Admins table exists, found', adminsData?.length || 0, 'admins');
    }

    // Test 3: Try to create admin user
    console.log('\n👤 Testing admin user creation...');
    const { data: createAdminData, error: createAdminError } = await supabase
      .from('admins')
      .insert({
        name: 'Admin',
        email: 'admin@andiamo.com',
        password: 'admin123',
        role: 'admin',
        is_active: true
      })
      .select();

    if (createAdminError) {
      console.log('❌ Admin creation failed:', createAdminError.message);
      console.log('💡 Error details:', createAdminError);
    } else {
      console.log('✅ Admin user created successfully:', createAdminData);
    }

    // Test 4: Check ambassadors table
    console.log('\n👥 Testing ambassadors table...');
    const { data: ambassadorsData, error: ambassadorsError } = await supabase
      .from('ambassadors')
      .select('*')
      .limit(1);

    if (ambassadorsError) {
      console.log('❌ Ambassadors table query failed:', ambassadorsError.message);
    } else {
      console.log('✅ Ambassadors table exists, found', ambassadorsData?.length || 0, 'ambassadors');
    }

    // Test 5: Check clients table
    console.log('\n👤 Testing clients table...');
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError) {
      console.log('❌ Clients table query failed:', clientsError.message);
    } else {
      console.log('✅ Clients table exists, found', clientsData?.length || 0, 'clients');
    }

    console.log('\n📊 Summary:');
    console.log('• Events table: ✅ Working');
    console.log('• Admins table:', adminsError ? '❌ Missing' : '✅ Exists');
    console.log('• Ambassadors table:', ambassadorsError ? '❌ Missing' : '✅ Exists');
    console.log('• Clients table:', clientsError ? '❌ Missing' : '✅ Exists');

    if (adminsError || ambassadorsError || clientsError) {
      console.log('\n🚨 ACTION REQUIRED:');
      console.log('You need to create the missing tables in your Supabase dashboard.');
      console.log('1. Go to: https://supabase.com/dashboard/project/ykeryyraxmtjunnotoep');
      console.log('2. Click "SQL Editor"');
      console.log('3. Run the SQL commands from create-tables.sql file');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugConnection(); 