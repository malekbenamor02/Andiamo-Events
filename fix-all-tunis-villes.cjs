/**
 * Fix Script: Add all Tunis villes
 * This script ensures all Tunis villes from constants.ts exist in the database
 * Run with: node fix-all-tunis-villes.cjs
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

// All Tunis villes from constants.ts
const TUNIS_VILLES = [
  'Aouina',
  'Ariana',
  'Bardo',
  'Carthage',
  'Ennasser/Ghazela',
  'Ezzahra/Boumhel',
  'Gammarth',
  'Jardin de Carthage',
  'Megrine/Rades',
  'Menzah 7/8/9',
  'Mourouj',
  'Soukra'
];

async function fixAllTunisVilles() {
  console.log('🔧 Adding all Tunis villes to database...\n');

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

    // Step 2: Get existing villes
    console.log('Step 2: Checking existing villes...');
    const { data: existingVilles, error: fetchError } = await supabase
      .from('villes')
      .select('name')
      .eq('city_id', city.id);

    if (fetchError) {
      console.error('❌ Error fetching existing villes:', fetchError.message);
      process.exit(1);
    }

    const existingNames = new Set((existingVilles || []).map(v => v.name));
    const toAdd = TUNIS_VILLES.filter(v => !existingNames.has(v));
    const alreadyExist = TUNIS_VILLES.filter(v => existingNames.has(v));

    if (alreadyExist.length > 0) {
      console.log(`✅ Already exists (${alreadyExist.length}): ${alreadyExist.join(', ')}\n`);
    }

    if (toAdd.length === 0) {
      console.log('✨ All Tunis villes already exist in the database!');
      return;
    }

    console.log(`📝 Need to add (${toAdd.length}): ${toAdd.join(', ')}\n`);

    // Step 3: Insert missing villes
    console.log('Step 3: Adding missing villes...');
    const villesToInsert = toAdd.map(name => ({
      name: name,
      city_id: city.id
    }));

    const { data: insertedVilles, error: insertError } = await supabase
      .from('villes')
      .insert(villesToInsert)
      .select('id, name');

    if (insertError) {
      console.error('❌ Error inserting villes:', insertError.message);
      console.error('   Code:', insertError.code);
      process.exit(1);
    }

    console.log(`✅ Successfully added ${insertedVilles.length} villes:`);
    insertedVilles.forEach(v => {
      console.log(`   - ${v.name} (ID: ${v.id})`);
    });

    console.log(`\n✨ Fix completed successfully!`);
    console.log(`   All ${TUNIS_VILLES.length} Tunis villes are now in the database`);

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

// Run the fix
fixAllTunisVilles()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
