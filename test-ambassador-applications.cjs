const { createClient } = require('@supabase/supabase-js');

// Use the same credentials as in your client.ts
const supabaseUrl = 'https://ykeryyraxmtjunnotoep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAmbassadorApplications() {
  console.log('🔍 Testing Ambassador Applications...\n');

  try {
    // 1. Test connection
    console.log('1. Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('events')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }
    console.log('✅ Database connection successful\n');

    // 2. Check if ambassador_applications table exists
    console.log('2. Checking ambassador_applications table structure...');
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'ambassador_applications' });
    
    if (tableError) {
      console.log('⚠️  Could not get table info via RPC, trying direct query...');
    } else {
      console.log('✅ Table structure:', tableInfo);
    }

    // 3. Try to select from ambassador_applications
    console.log('\n3. Attempting to fetch ambassador applications...');
    const { data: applications, error: selectError } = await supabase
      .from('ambassador_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (selectError) {
      console.error('❌ Error fetching applications:', selectError);
      console.log('\n🔧 Possible solutions:');
      console.log('1. Check if the table exists');
      console.log('2. Check RLS policies');
      console.log('3. Check if you have the right permissions');
      return;
    }

    console.log(`✅ Successfully fetched ${applications?.length || 0} applications`);
    
    if (applications && applications.length > 0) {
      console.log('\n📋 Applications found:');
      applications.forEach((app, index) => {
        console.log(`${index + 1}. ${app.full_name} (${app.phone_number}) - Status: ${app.status}`);
      });
    } else {
      console.log('📭 No applications found in the database');
    }

    // 4. Test inserting a test application
    console.log('\n4. Testing application insertion...');
    const testApplication = {
      full_name: 'Test User',
      age: 25,
      phone_number: '+21612345678',
      email: 'test@example.com',
      city: 'Tunis',
      social_link: 'https://instagram.com/testuser',
      motivation: 'This is a test application',
      status: 'pending'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('ambassador_applications')
      .insert(testApplication)
      .select();

    if (insertError) {
      console.error('❌ Error inserting test application:', insertError);
      console.log('\n🔧 This might be due to:');
      console.log('1. Missing email column (run add-email-to-applications.sql)');
      console.log('2. RLS policies blocking insert');
      console.log('3. Table structure mismatch');
    } else {
      console.log('✅ Test application inserted successfully:', insertData);
      
      // Clean up - delete the test application
      const { error: deleteError } = await supabase
        .from('ambassador_applications')
        .delete()
        .eq('id', insertData[0].id);
      
      if (deleteError) {
        console.log('⚠️  Could not clean up test application:', deleteError);
      } else {
        console.log('🧹 Test application cleaned up');
      }
    }

    // 5. Check RLS policies
    console.log('\n5. Checking RLS policies...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'ambassador_applications' });
    
    if (policiesError) {
      console.log('⚠️  Could not get policies via RPC');
    } else {
      console.log('📋 RLS Policies:', policies);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testAmbassadorApplications(); 