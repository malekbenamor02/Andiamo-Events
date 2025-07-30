const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use hardcoded credentials from the project
const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

console.log('🔗 Using Supabase URL:', supabaseUrl);
console.log('🔑 Using Supabase Key:', supabaseKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');

  try {
    // Test 1: Check if we can connect
    console.log('1️⃣ Testing basic connection...');
    const { data, error } = await supabase.from('ambassador_applications').select('count').limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return;
    }
    console.log('✅ Connection successful!\n');

    // Test 2: Check table structure
    console.log('2️⃣ Checking table structure...');
    const { data: structure, error: structureError } = await supabase
      .from('ambassador_applications')
      .select('*')
      .limit(1);

    if (structureError) {
      console.error('❌ Table structure error:', structureError.message);
      return;
    }

    if (structure && structure.length > 0) {
      const columns = Object.keys(structure[0]);
      console.log('✅ Table columns found:', columns.join(', '));
    } else {
      console.log('ℹ️  Table exists but is empty');
    }
    console.log('');

    // Test 3: Count applications
    console.log('3️⃣ Counting applications...');
    const { count, error: countError } = await supabase
      .from('ambassador_applications')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count error:', countError.message);
      return;
    }

    console.log(`✅ Found ${count} applications in database\n`);

    // Test 4: List recent applications
    console.log('4️⃣ Recent applications:');
    const { data: applications, error: appsError } = await supabase
      .from('ambassador_applications')
      .select('id, full_name, email, city, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (appsError) {
      console.error('❌ Applications fetch error:', appsError.message);
      return;
    }

    if (applications && applications.length > 0) {
      applications.forEach((app, index) => {
        console.log(`   ${index + 1}. ${app.full_name} (${app.email}) - ${app.city} - ${app.status}`);
      });
    } else {
      console.log('   No applications found');
    }
    console.log('');

    // Test 5: Test inserting a sample application
    console.log('5️⃣ Testing application insertion...');
    const testApplication = {
      full_name: 'Test User',
      age: 25,
      phone_number: '+21699999999',
      email: 'test@example.com',
      city: 'Test City',
      social_link: 'https://instagram.com/testuser',
      motivation: 'This is a test application',
      status: 'pending'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('ambassador_applications')
      .insert(testApplication)
      .select();

    if (insertError) {
      console.error('❌ Insert test failed:', insertError.message);
    } else {
      console.log('✅ Insert test successful!');
      console.log('   Inserted application ID:', insertData[0].id);
      
      // Clean up test data
      await supabase
        .from('ambassador_applications')
        .delete()
        .eq('email', 'test@example.com');
      console.log('   Test data cleaned up');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testDatabaseConnection(); 