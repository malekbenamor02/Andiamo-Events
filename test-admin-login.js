// Test script to diagnose admin login issues
// Run: node test-admin-login.js

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@andiamo.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing Supabase environment variables.');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.');
  process.exit(1);
}

async function testAdminLogin() {
  console.log('='.repeat(60));
  console.log('ADMIN LOGIN DIAGNOSTIC TEST');
  console.log('='.repeat(60));
  console.log(`\nSupabase URL: ${SUPABASE_URL ? 'configured' : 'missing'}`);
  console.log(`Admin Email: ${ADMIN_EMAIL}\n`);

  try {
    // Step 1: Connect to Supabase
    console.log('Step 1: Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✓ Connected\n');

    // Step 2: Fetch admin
    console.log('Step 2: Fetching admin account...');
    const { data: admin, error: fetchError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', ADMIN_EMAIL)
      .single();

    if (fetchError) {
      console.error('✗ Error fetching admin:', fetchError);
      return;
    }

    if (!admin) {
      console.error('✗ Admin not found!');
      return;
    }

    console.log('✓ Admin found');
    console.log(`  - Email: ${admin.email}`);
    console.log(`  - Is Active: ${admin.is_active}`);
    console.log(`  - Password configured: ${admin.password ? 'yes' : 'no'}\n`);

    // Step 3: Check password format
    console.log('Step 3: Checking password format...');
    if (!admin.password) {
      console.error('✗ Admin has no password!');
      return;
    }

    const isBcrypt = admin.password.length === 60 && 
                     (admin.password.startsWith('$2a$') || 
                      admin.password.startsWith('$2b$') || 
                      admin.password.startsWith('$2y$'));
    
    if (isBcrypt) {
      console.log('✓ Password appears to be a valid bcrypt hash');
    } else {
      console.warn('⚠ Password does not appear to be a bcrypt hash');
    }
    console.log();

    // Step 4: Test password verification
    console.log('Step 4: Testing password verification...');
    try {
      const isMatch = await bcrypt.compare(ADMIN_PASSWORD, admin.password);
      if (isMatch) {
        console.log('✓ Password verification successful!');
      } else {
        console.error('✗ Password verification failed!');
        console.log('  The password in the database does not match "admin123"');
      }
    } catch (bcryptError) {
      console.error('✗ Bcrypt comparison error:', bcryptError.message);
    }
    console.log();

    // Step 5: Test JWT generation
    console.log('Step 5: Testing JWT generation...');
    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    try {
      const token = jwt.default.sign(
        { id: admin.id, email: admin.email, role: admin.role },
        jwtSecret,
        { expiresIn: '2h' }
      );
      console.log('✓ JWT token generated successfully');
      console.log(`  Token length: ${token.length} characters`);
      console.log(`  JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET (using fallback)'}`);
    } catch (jwtError) {
      console.error('✗ JWT generation error:', jwtError.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(60));
    console.log('\nIf all steps passed, the admin login should work.');
    console.log('If any step failed, that is likely the cause of the login error.\n');

  } catch (error) {
    console.error('\n✗ Test failed with error:', error);
    console.error('Stack:', error.stack);
  }
}

testAdminLogin().catch(console.error);




