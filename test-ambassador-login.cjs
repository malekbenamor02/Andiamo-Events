// Test ambassador login directly
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testLogin() {
  const phone = '27169458';
  const password = 'test123';

  console.log('🧪 Testing Ambassador Login');
  console.log('='.repeat(60));
  console.log('Phone:', phone);
  console.log('Password:', password);
  console.log('='.repeat(60));

  // Normalize phone
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

  const normalizedPhone = normalizePhone(phone);
  console.log('Normalized phone:', normalizedPhone);

  // Find ambassador
  console.log('\n1. Finding ambassador...');
  const { data: ambassador, error: findError } = await supabase
    .from('ambassadors')
    .select('*')
    .eq('phone', normalizedPhone)
    .maybeSingle();

  if (findError) {
    console.error('❌ Error finding ambassador:', findError);
    return;
  }

  if (!ambassador) {
    console.error('❌ Ambassador not found!');
    return;
  }

  console.log('✅ Ambassador found:');
  console.log('   ID:', ambassador.id);
  console.log('   Name:', ambassador.full_name);
  console.log('   Phone:', ambassador.phone);
  console.log('   Status:', ambassador.status);
  console.log('   Has password:', !!ambassador.password);
  console.log('   Password length:', ambassador.password?.length || 0);

  // Check password
  console.log('\n2. Verifying password...');
  if (!ambassador.password) {
    console.error('❌ Ambassador has no password!');
    return;
  }

  try {
    const isValid = await bcrypt.compare(password, ambassador.password);
    console.log('Password match:', isValid ? '✅ YES' : '❌ NO');

    if (!isValid) {
      console.log('\n⚠️  Password mismatch!');
      console.log('   Expected password:', password);
      console.log('   Stored hash:', ambassador.password.substring(0, 20) + '...');
      
      // Try to update password
      console.log('\n3. Updating password...');
      const newHash = await bcrypt.hash(password, 10);
      const { error: updateError } = await supabase
        .from('ambassadors')
        .update({
          password: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', ambassador.id);

      if (updateError) {
        console.error('❌ Error updating password:', updateError);
      } else {
        console.log('✅ Password updated successfully!');
        console.log('   New hash:', newHash.substring(0, 20) + '...');
        
        // Test again
        console.log('\n4. Testing login again...');
        const isValidNow = await bcrypt.compare(password, newHash);
        console.log('Password match after update:', isValidNow ? '✅ YES' : '❌ NO');
      }
    } else {
      console.log('\n✅ Login should work!');
      console.log('   Status:', ambassador.status);
      if (ambassador.status !== 'approved') {
        console.log('   ⚠️  WARNING: Status is not "approved" - login will be blocked!');
      }
    }
  } catch (error) {
    console.error('❌ Error comparing password:', error);
  }
}

testLogin().catch(console.error);

