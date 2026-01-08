/**
 * Add idempotency_key column to orders table
 * Run with: node add-idempotency-key.cjs
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

async function addIdempotencyKey() {
  console.log('🔧 Adding idempotency_key column to orders table...\n');

  try {
    // Check if column already exists
    console.log('Step 1: Checking if column exists...');
    const { data: columns, error: checkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'idempotency_key'
      `
    });

    if (checkError) {
      // If RPC doesn't work, try direct query
      console.log('⚠️  RPC not available, trying alternative method...');
    }

    // Use direct SQL execution via a simple query to check
    // Since we can't easily check, just try to add it (migration handles IF NOT EXISTS)
    console.log('Step 2: Adding idempotency_key column...');
    
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20250202000002-add-idempotency-key-to-orders.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚠️  Note: This migration needs to be applied manually in Supabase SQL Editor');
    console.log(`Please run the SQL from: ${migrationPath}`);
    console.log('\nOr apply it directly:');
    console.log('\n-- Add idempotency_key column');
    console.log('ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key UUID;');
    console.log('\n-- Create unique index');
    console.log('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique');
    console.log('  ON public.orders(idempotency_key)');
    console.log('  WHERE idempotency_key IS NOT NULL;');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Please apply the migration manually in Supabase SQL Editor:');
    console.log('supabase/migrations/20250202000002-add-idempotency-key-to-orders.sql');
    process.exit(1);
  }
}

addIdempotencyKey()
  .then(() => {
    console.log('\n✅ Instructions provided');
    console.log('⚠️  Please apply the migration in Supabase SQL Editor');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
