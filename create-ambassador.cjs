// Script to create an ambassador account
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function createAmbassador() {
  const phone = '27169458';
  const password = 'test123'; // Change this to the desired password
  const fullName = 'Test Ambassador'; // Change this to the actual name
  const email = null; // Optional
  const city = 'Tunis'; // Change this to the actual city

  console.log('🔧 Creating ambassador account...');
  console.log('='.repeat(60));
  console.log('Phone:', phone);
  console.log('Name:', fullName);
  console.log('City:', city);
  console.log('='.repeat(60));

  // Check if ambassador already exists
  const { data: existing } = await supabase
    .from('ambassadors')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    console.log('⚠️  Ambassador already exists!');
    console.log('ID:', existing.id);
    console.log('Name:', existing.full_name);
    console.log('Status:', existing.status);
    console.log('Has password:', !!existing.password);
    
    // Update password if needed
    console.log('\n🔄 Updating password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    const { error: updateError } = await supabase
      .from('ambassadors')
      .update({
        password: hashedPassword,
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('phone', phone);

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
    } else {
      console.log('✅ Password updated successfully!');
      console.log('✅ Status set to approved');
      console.log('\n📝 Login credentials:');
      console.log('   Phone:', phone);
      console.log('   Password:', password);
    }
    return;
  }

  // Hash password
  console.log('🔐 Hashing password...');
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create ambassador
  console.log('📝 Creating ambassador...');
  const { data: newAmbassador, error: createError } = await supabase
    .from('ambassadors')
    .insert({
      phone: phone,
      full_name: fullName,
      email: email,
      city: city,
      password: hashedPassword,
      status: 'approved',
      commission_rate: 10,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating ambassador:', createError);
    console.error('Details:', JSON.stringify(createError, null, 2));
  } else {
    console.log('✅ Ambassador created successfully!');
    console.log('ID:', newAmbassador.id);
    console.log('\n📝 Login credentials:');
    console.log('   Phone:', phone);
    console.log('   Password:', password);
    console.log('\n✅ You can now login with these credentials!');
  }
}

createAmbassador().catch(console.error);

