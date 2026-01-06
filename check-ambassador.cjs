// Script to check if an ambassador exists in the database
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkAmbassador() {
  const phoneToCheck = '27169458';
  
  console.log('🔍 Checking ambassador with phone:', phoneToCheck);
  console.log('='.repeat(60));

  // Normalize phone number
  const normalizePhone = (phoneNum) => {
    if (!phoneNum) return '';
    let cleaned = phoneNum.replace(/[\s\-\(\)]/g, '').trim();
    if (cleaned.startsWith('+216')) {
      cleaned = cleaned.substring(4);
    } else if (cleaned.startsWith('216')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('00216')) {
      cleaned = cleaned.substring(5);
    }
    cleaned = cleaned.replace(/^0+/, '');
    return cleaned;
  };

  const normalizedPhone = normalizePhone(phoneToCheck);
  console.log('Normalized phone:', normalizedPhone);

  // Check exact match
  console.log('\n1. Checking exact match...');
  const { data: exactMatch, error: exactError } = await supabase
    .from('ambassadors')
    .select('*')
    .eq('phone', phoneToCheck)
    .maybeSingle();

  if (exactMatch) {
    console.log('✅ Found with exact match:', {
      id: exactMatch.id,
      phone: exactMatch.phone,
      name: exactMatch.full_name,
      status: exactMatch.status,
      hasPassword: !!exactMatch.password
    });
  } else {
    console.log('❌ Not found with exact match');
    if (exactError && exactError.code !== 'PGRST116') {
      console.log('Error:', exactError);
    }
  }

  // Check normalized match
  console.log('\n2. Checking normalized match...');
  const { data: normalizedMatch, error: normalizedError } = await supabase
    .from('ambassadors')
    .select('*')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (normalizedMatch) {
    console.log('✅ Found with normalized match:', {
      id: normalizedMatch.id,
      phone: normalizedMatch.phone,
      name: normalizedMatch.full_name,
      status: normalizedMatch.status,
      hasPassword: !!normalizedMatch.password
    });
  } else {
    console.log('❌ Not found with normalized match');
    if (normalizedError && normalizedError.code !== 'PGRST116') {
      console.log('Error:', normalizedError);
    }
  }

  // List all ambassadors to see what phone formats exist
  console.log('\n3. Listing all ambassadors (first 10)...');
  const { data: allAmbassadors, error: allError } = await supabase
    .from('ambassadors')
    .select('id, phone, full_name, status')
    .limit(10);

  if (allError) {
    console.error('Error fetching ambassadors:', allError);
  } else {
    console.log('Found', allAmbassadors?.length || 0, 'ambassadors:');
    allAmbassadors?.forEach(amb => {
      const normalized = normalizePhone(amb.phone || '');
      const matches = normalized === normalizedPhone;
      console.log(`  - Phone: "${amb.phone}" (normalized: "${normalized}") ${matches ? '✅ MATCHES' : ''} | Name: ${amb.full_name} | Status: ${amb.status}`);
    });
  }

  // Search for similar phone numbers
  console.log('\n4. Searching for similar phone numbers...');
  const { data: similarPhones, error: similarError } = await supabase
    .from('ambassadors')
    .select('id, phone, full_name, status')
    .like('phone', `%${phoneToCheck.slice(-4)}%`); // Last 4 digits

  if (similarError) {
    console.error('Error searching similar:', similarError);
  } else if (similarPhones && similarPhones.length > 0) {
    console.log('Found similar phone numbers:');
    similarPhones.forEach(amb => {
      console.log(`  - Phone: "${amb.phone}" | Name: ${amb.full_name} | Status: ${amb.status}`);
    });
  } else {
    console.log('No similar phone numbers found');
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 If ambassador not found:');
  console.log('   1. Check if the phone number is correct');
  console.log('   2. Verify the ambassador exists in the database');
  console.log('   3. Check if the phone number format matches (should be 8 digits)');
  console.log('   4. Ensure the ambassador status is "approved"');
}

checkAmbassador().catch(console.error);

