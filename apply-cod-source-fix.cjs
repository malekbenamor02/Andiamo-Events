/**
 * Apply COD Source Fix
 * This script applies the migration to fix the COD order source constraint
 * Run with: node apply-cod-source-fix.cjs
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function applyFix() {
  console.log('🔧 Applying COD source constraint fix...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250202000004-fix-cod-source-constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Step 1: Dropping old constraint...');
    // Drop old constraint
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cod_source_check;`
    });

    if (dropError && !dropError.message.includes('does not exist')) {
      console.warn('⚠️  Warning dropping constraint:', dropError.message);
    } else {
      console.log('✅ Old constraint dropped\n');
    }

    console.log('Step 2: Creating new constraint...');
    // Create new constraint
    const { error: constraintError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.orders ADD CONSTRAINT orders_cod_source_check
        CHECK (
          (payment_method = 'cod' AND source IN ('platform_cod', 'ambassador_manual')) OR
          (payment_method != 'cod')
        );
      `
    });

    if (constraintError) {
      console.error('❌ Error creating constraint:', constraintError.message);
      // Try alternative approach - execute SQL directly
      console.log('\n⚠️  Trying alternative approach...');
      console.log('Please run the migration manually in Supabase SQL Editor:');
      console.log(`File: ${migrationPath}`);
      process.exit(1);
    } else {
      console.log('✅ New constraint created\n');
    }

    console.log('Step 3: Updating trigger functions...');
    // Update functions
    const functionsSQL = migrationSQL.split('-- Update validate_order_status')[1];
    
    console.log('⚠️  Note: Trigger functions need to be updated manually in Supabase SQL Editor');
    console.log(`Please run the SQL from: ${migrationPath}`);
    console.log('\n✨ Constraint fix applied!');
    console.log('⚠️  You still need to update the trigger functions manually.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Please apply the migration manually in Supabase SQL Editor:');
    console.log('supabase/migrations/20250202000004-fix-cod-source-constraint.sql');
    process.exit(1);
  }
}

applyFix()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
