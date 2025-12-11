/**
 * Utility script to reset admin password
 * Usage: node reset-admin-password.cjs <email> <newPassword>
 */

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword(email, newPassword) {
  try {
    console.log('🔍 Looking for admin with email:', email);
    
    // Find admin
    const { data: admin, error: findError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (findError || !admin) {
      console.error('❌ Admin not found:', findError?.message || 'No admin with this email');
      return;
    }

    console.log('✅ Admin found:', {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      is_active: admin.is_active
    });

    // Hash the new password
    console.log('🔐 Hashing new password...');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    console.log('✅ Password hashed. Hash length:', hashedPassword.length);
    console.log('Hash preview:', hashedPassword.substring(0, 30) + '...');

    // Update the password
    console.log('💾 Updating password in database...');
    const { data: updated, error: updateError } = await supabase
      .from('admins')
      .update({ password: hashedPassword })
      .eq('id', admin.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update password:', updateError.message);
      return;
    }

    console.log('✅ Password updated successfully!');
    console.log('📧 Admin email:', updated.email);
    console.log('🔑 You can now login with the new password');
    
    // Verify the password works
    console.log('\n🔍 Verifying password...');
    const isMatch = await bcrypt.compare(newPassword, updated.password);
    if (isMatch) {
      console.log('✅ Password verification successful!');
    } else {
      console.error('❌ Password verification failed - something went wrong');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node reset-admin-password.cjs <email> <newPassword>');
  console.log('Example: node reset-admin-password.cjs admin@example.com MyNewPassword123');
  process.exit(1);
}

resetPassword(email, password);

