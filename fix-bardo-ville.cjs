/**
 * Fix Script: Add Bardo ville for Tunis
 * This script ensures "Bardo" exists in the villes table for Tunis city
 * Run with: node fix-bardo-ville.cjs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixBardoVille() {
  console.log('🔧 Fixing Bardo ville for Tunis...\n');

  try {
    // Step 1: Get Tunis city ID
    console.log('Step 1: Finding Tunis city...');
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id, name')
      .eq('name', 'Tunis')
      .single();

    if (cityError || !city) {
      console.error('❌ Error: Tunis city not found in database');
      console.error('   Error:', cityError?.message || 'City not found');
      process.exit(1);
    }

    console.log(`✅ Found Tunis city (ID: ${city.id})\n`);

    // Step 2: Check if Bardo already exists
    console.log('Step 2: Checking if Bardo already exists...');
    const { data: existingVille, error: checkError } = await supabase
      .from('villes')
      .select('id, name')
      .eq('name', 'Bardo')
      .eq('city_id', city.id)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Error checking for existing ville:', checkError.message);
      process.exit(1);
    }

    if (existingVille) {
      console.log('✅ Bardo already exists in database');
      console.log(`   Ville ID: ${existingVille.id}`);
      console.log('\n✨ No action needed - Bardo is already in the database!');
      return;
    }

    // Step 3: Insert Bardo
    console.log('Step 3: Adding Bardo to database...');
    const { data: newVille, error: insertError } = await supabase
      .from('villes')
      .insert({
        name: 'Bardo',
        city_id: city.id
      })
      .select('id, name')
      .single();

    if (insertError) {
      console.error('❌ Error inserting Bardo:', insertError.message);
      console.error('   Code:', insertError.code);
      process.exit(1);
    }

    console.log('✅ Successfully added Bardo to database!');
    console.log(`   Ville ID: ${newVille.id}`);
    console.log(`   Name: ${newVille.name}`);
    console.log(`   City: Tunis\n`);

    // Step 4: Verify
    console.log('Step 4: Verifying insertion...');
    const { data: verifyVille, error: verifyError } = await supabase
      .from('villes')
      .select('id, name, city_id, cities(name)')
      .eq('name', 'Bardo')
      .eq('city_id', city.id)
      .single();

    if (verifyError || !verifyVille) {
      console.warn('⚠️  Warning: Could not verify insertion');
    } else {
      console.log('✅ Verification successful!');
      console.log(`   Bardo is now available for Tunis city\n`);
    }

    console.log('✨ Fix completed successfully!');
    console.log('   You can now submit orders with ville "Bardo" for city "Tunis"');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixBardoVille()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
