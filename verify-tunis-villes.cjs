/**
 * Verification Script: Check all Tunis villes
 * This script verifies that all villes from constants.ts exist in the database
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

async function verifyTunisVilles() {
  console.log('🔍 Verifying all Tunis villes...\n');

  try {
    // Get Tunis city ID
    const { data: city, error: cityError } = await supabase
      .from('cities')
      .select('id, name')
      .eq('name', 'Tunis')
      .single();

    if (cityError || !city) {
      console.error('❌ Error: Tunis city not found');
      process.exit(1);
    }

    console.log(`✅ Found Tunis city (ID: ${city.id})\n`);

    // Get all existing villes for Tunis
    const { data: existingVilles, error: fetchError } = await supabase
      .from('villes')
      .select('name')
      .eq('city_id', city.id);

    if (fetchError) {
      console.error('❌ Error fetching villes:', fetchError.message);
      process.exit(1);
    }

    const existingNames = (existingVilles || []).map(v => v.name);
    const missing = [];
    const found = [];

    console.log('Checking each ville:\n');
    for (const ville of TUNIS_VILLES) {
      if (existingNames.includes(ville)) {
        console.log(`  ✅ ${ville}`);
        found.push(ville);
      } else {
        console.log(`  ❌ ${ville} - MISSING`);
        missing.push(ville);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Found: ${found.length}/${TUNIS_VILLES.length}`);
    console.log(`   Missing: ${missing.length}`);

    if (missing.length > 0) {
      console.log(`\n⚠️  Missing villes: ${missing.join(', ')}`);
      console.log(`\n💡 To fix, run the migration: supabase/migrations/20250202000001-add-tunis-villes.sql`);
      return false;
    } else {
      console.log(`\n✨ All Tunis villes are present in the database!`);
      return true;
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

verifyTunisVilles()
  .then((allPresent) => {
    process.exit(allPresent ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
