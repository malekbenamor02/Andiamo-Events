/**
 * Test script to debug Tunis ville saving issue
 * This script will:
 * 1. Submit a test application with Tunis and a ville
 * 2. Check if ville was saved in database
 * 3. Compare with Sousse to find the difference
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const API_URL = process.env.API_URL || 'http://localhost:5173';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Generate unique test data
const timestamp = Date.now();
const testPhoneSousse = `2${timestamp.toString().slice(-7)}`;
const testPhoneTunis = `5${timestamp.toString().slice(-7)}`;

async function testApplication(city, ville, phone, testName) {
  console.log(`\n🧪 Testing ${testName}:`);
  console.log(`   City: ${city}`);
  console.log(`   Ville: ${ville}`);
  console.log(`   Phone: ${phone}`);

  const applicationData = {
    fullName: `Test ${testName}`,
    age: '25',
    phoneNumber: phone,
    email: `test${phone}@example.com`,
    city: city,
    ville: ville,
    socialLink: 'https://www.instagram.com/testuser/',
    motivation: 'Test application'
  };

  console.log(`\n📤 Sending application data:`, JSON.stringify(applicationData, null, 2));

  try {
    // Submit application
    const response = await fetch(`${API_URL}/api/ambassador-application`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(applicationData)
    });

    const responseData = await response.json();
    console.log(`\n📥 API Response Status: ${response.status}`);
    console.log(`📥 API Response Data:`, JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error(`❌ API Error: ${responseData.error}`);
      return null;
    }

    // Wait a bit for database to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check database
    const { data: application, error: dbError } = await supabase
      .from('ambassador_applications')
      .select('*')
      .eq('phone_number', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError) {
      console.error(`❌ Database Error:`, dbError);
      return null;
    }

    console.log(`\n📊 Database Result:`);
    console.log(`   ID: ${application.id}`);
    console.log(`   City: ${application.city}`);
    console.log(`   Ville: ${application.ville || 'NULL'}`);
    console.log(`   Ville Type: ${typeof application.ville}`);
    console.log(`   Ville === null: ${application.ville === null}`);
    console.log(`   Ville === undefined: ${application.ville === undefined}`);
    console.log(`   Ville === '': ${application.ville === ''}`);

    return {
      success: response.ok,
      applicationId: application.id,
      city: application.city,
      ville: application.ville,
      villeSaved: application.ville !== null && application.ville !== undefined && application.ville !== ''
    };
  } catch (error) {
    console.error(`❌ Test Error:`, error);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Starting Ville Bug Investigation Tests\n');
  console.log('=' .repeat(60));

  // Test 1: Sousse (should work)
  const sousseResult = await testApplication(
    'Sousse',
    'Hammam-Sousse',
    testPhoneSousse,
    'Sousse'
  );

  // Test 2: Tunis (currently failing)
  const tunisResult = await testApplication(
    'Tunis',
    'Soukra',
    testPhoneTunis,
    'Tunis'
  );

  // Compare results
  console.log('\n' + '='.repeat(60));
  console.log('📈 COMPARISON RESULTS:');
  console.log('='.repeat(60));
  
  console.log(`\n✅ Sousse Test:`);
  console.log(`   Ville Saved: ${sousseResult?.villeSaved ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Ville Value: ${sousseResult?.ville || 'NULL'}`);

  console.log(`\n❌ Tunis Test:`);
  console.log(`   Ville Saved: ${tunisResult?.villeSaved ? 'YES ✅' : 'NO ❌'}`);
  console.log(`   Ville Value: ${tunisResult?.ville || 'NULL'}`);

  if (sousseResult?.villeSaved && !tunisResult?.villeSaved) {
    console.log('\n🔍 BUG CONFIRMED: Sousse works but Tunis does not!');
    console.log('   Investigating the difference...\n');
    
    // Check what was sent vs what was received
    console.log('📋 Data Flow Analysis:');
    console.log('   1. Frontend sends ville in request body');
    console.log('   2. API receives ville from bodyData');
    console.log('   3. API sanitizes ville');
    console.log('   4. API validates ville for city');
    console.log('   5. API sets villeValue');
    console.log('   6. API inserts villeValue into database');
  } else if (sousseResult?.villeSaved && tunisResult?.villeSaved) {
    console.log('\n✅ BOTH TESTS PASSED - Bug may be fixed!');
  }

  // Cleanup test data
  console.log('\n🧹 Cleaning up test data...');
  if (sousseResult?.applicationId) {
    await supabase.from('ambassador_applications').delete().eq('id', sousseResult.applicationId);
  }
  if (tunisResult?.applicationId) {
    await supabase.from('ambassador_applications').delete().eq('id', tunisResult.applicationId);
  }
  console.log('✅ Cleanup complete');
}

runTests().catch(console.error);

