// Script to create admin account with hashed password
// Run this locally: node create-admin.js
// Then use the generated SQL in Supabase

import bcrypt from 'bcryptjs';

async function createAdmin() {
  const email = 'admin@andiamo.com';
  const password = 'admin123'; // Change this to your desired password
  const name = 'Admin User';
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  console.log('='.repeat(50));
  console.log('ADMIN ACCOUNT CREATION SQL');
  console.log('='.repeat(50));
  console.log('\nRun this SQL in Supabase SQL Editor:\n');
  console.log(`-- Delete existing admin if exists`);
  console.log(`DELETE FROM admins WHERE email = '${email}';`);
  console.log(`\n-- Insert admin with hashed password`);
  console.log(`INSERT INTO admins (name, email, password, role, is_active)`);
  console.log(`VALUES (`);
  console.log(`  '${name}',`);
  console.log(`  '${email}',`);
  console.log(`  '${hashedPassword}',`);
  console.log(`  'admin',`);
  console.log(`  true`);
  console.log(`)`);
  console.log(`ON CONFLICT (email) DO UPDATE`);
  console.log(`SET`);
  console.log(`  password = EXCLUDED.password,`);
  console.log(`  updated_at = NOW();`);
  console.log(`\n-- Login credentials:`);
  console.log(`-- Email: ${email}`);
  console.log(`-- Password: ${password}`);
  console.log('='.repeat(50));
}

createAdmin().catch(console.error);

