// Script to fix admin account in database
// This script connects to Supabase and updates the admin account with a properly hashed password

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment variables (required)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing Supabase environment variables.');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
  process.exit(1);
}

// Admin credentials from environment variables (required)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@andiamo.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

if (!ADMIN_PASSWORD) {
  console.error('Error: Missing admin password.');
  console.error('Please set ADMIN_PASSWORD in your .env file.');
  process.exit(1);
}

async function fixAdminAccount() {
  console.log('='.repeat(60));
  console.log('FIXING ADMIN ACCOUNT IN DATABASE');
  console.log('='.repeat(60));
  console.log(`\nSupabase URL: ${SUPABASE_URL ? 'configured' : 'missing'}`);
  console.log(`Admin Email: ${ADMIN_EMAIL}`);
  console.log(`Admin Password: ${ADMIN_PASSWORD ? 'configured' : 'missing'}\n`);

  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Step 1: Check if admin exists
    console.log('Step 1: Checking if admin account exists...');
    const { data: existingAdmin, error: fetchError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is okay
      console.error('Error fetching admin:', fetchError);
      throw fetchError;
    }

    if (existingAdmin) {
      console.log('✓ Admin account found');
      console.log(`  - ID: ${existingAdmin.id}`);
      console.log(`  - Name: ${existingAdmin.name}`);
      console.log(`  - Email: ${existingAdmin.email}`);
      console.log(`  - Role: ${existingAdmin.role}`);
      console.log(`  - Is Active: ${existingAdmin.is_active}`);
      
      // Check if password is hashed
      const isHashed = /^\$2[ayb]\$.{56}$/.test(existingAdmin.password);
      if (isHashed) {
        console.log(`  - Password: ✓ Already hashed (bcrypt)`);
      } else {
        console.log(`  - Password: ✗ Plain text (needs hashing)`);
      }
    } else {
      console.log('✗ Admin account not found - will create new one');
    }

    // Step 2: Generate bcrypt hash
    console.log('\nStep 2: Generating bcrypt hash for password...');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    console.log(`✓ Password hashed successfully`);
    console.log(`  Hash: ${hashedPassword.substring(0, 30)}...`);

    // Step 3: Update or insert admin account
    console.log('\nStep 3: Updating admin account in database...');
    
    const adminData = {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: 'admin',
      is_active: true,
      updated_at: new Date().toISOString()
    };

    // Use upsert to insert or update
    const { data: updatedAdmin, error: upsertError } = await supabase
      .from('admins')
      .upsert(adminData, {
        onConflict: 'email',
        returning: 'minimal'
      });

    if (upsertError) {
      console.error('✗ Error updating admin account:', upsertError);
      
      // If RLS policy blocks the update, provide SQL alternative
      if (upsertError.code === '42501' || upsertError.message.includes('permission')) {
        console.log('\n⚠️  Permission denied. This might be due to RLS policies.');
        console.log('   Using SQL alternative method...\n');
        await generateSQLFile(hashedPassword);
        return;
      }
      
      throw upsertError;
    }

    console.log('✓ Admin account updated successfully!');

    // Step 4: Verify the update
    console.log('\nStep 4: Verifying admin account...');
    const { data: verifiedAdmin, error: verifyError } = await supabase
      .from('admins')
      .select('id, name, email, role, is_active, created_at')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (verifyError) {
      console.error('✗ Error verifying admin:', verifyError);
    } else {
      console.log('✓ Admin account verified:');
      console.log(`  - ID: ${verifiedAdmin.id}`);
      console.log(`  - Name: ${verifiedAdmin.name}`);
      console.log(`  - Email: ${verifiedAdmin.email}`);
      console.log(`  - Role: ${verifiedAdmin.role}`);
      console.log(`  - Is Active: ${verifiedAdmin.is_active}`);
      console.log(`  - Created: ${verifiedAdmin.created_at}`);
    }

    // Step 5: Test password verification
    console.log('\nStep 5: Testing password verification...');
    const { data: testAdmin } = await supabase
      .from('admins')
      .select('password')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (testAdmin && testAdmin.password) {
      const passwordMatch = await bcrypt.compare(ADMIN_PASSWORD, testAdmin.password);
      if (passwordMatch) {
        console.log('✓ Password verification successful!');
      } else {
        console.log('✗ Password verification failed!');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ADMIN ACCOUNT FIXED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`\nAdmin account has been updated successfully.`);
    console.log(`You can now login to the admin dashboard.\n`);

  } catch (error) {
    console.error('\n✗ Error fixing admin account:', error);
    console.log('\nGenerating SQL file as fallback...\n');
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await generateSQLFile(hashedPassword);
    process.exit(1);
  }
}

async function generateSQLFile(hashedPassword) {
  const sql = `-- ============================================
-- FIX ADMIN LOGIN - Create Admin with Hashed Password
-- ============================================
-- Run this in Supabase SQL Editor
-- Generated: ${new Date().toISOString()}

-- Delete existing admin if it has plain text password
DELETE FROM admins WHERE email = '${ADMIN_EMAIL}';

-- Insert admin with properly hashed password (bcrypt)
-- Password: ${ADMIN_PASSWORD}
INSERT INTO admins (name, email, password, role, is_active) 
VALUES (
  '${ADMIN_NAME}', 
  '${ADMIN_EMAIL}', 
  '${hashedPassword}',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = EXCLUDED.password,
  updated_at = NOW();

-- Verify admin was created
SELECT id, name, email, role, is_active, created_at FROM admins WHERE email = '${ADMIN_EMAIL}';

-- ============================================
-- Login Credentials:
-- Email: ${ADMIN_EMAIL}
-- Password: ${ADMIN_PASSWORD}
-- ============================================
`;

  const fs = await import('fs/promises');
  await fs.writeFile('FIX_ADMIN_NOW.sql', sql);
  
  console.log('='.repeat(60));
  console.log('SQL FILE GENERATED: FIX_ADMIN_NOW.sql');
  console.log('='.repeat(60));
  console.log('\nPlease run this SQL in your Supabase SQL Editor:');
  console.log('1. Go to: https://supabase.com/dashboard/project/ykeryyraxmtjunnotoep/sql/new');
  console.log('2. Copy the contents of FIX_ADMIN_NOW.sql');
  console.log('3. Paste and click "Run"\n');
}

// Run the fix
fixAdminAccount().catch(console.error);

