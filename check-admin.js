// Check and create admin account
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAndCreateAdmin() {
  console.log('🔍 Checking admin accounts...\n');

  try {
    // Check existing admins
    const { data: admins, error } = await supabase
      .from('admins')
      .select('*');

    if (error) {
      console.error('❌ Error fetching admins:', error);
      return;
    }

    console.log('📋 Existing admins:');
    if (admins && admins.length > 0) {
      admins.forEach(admin => {
        console.log(`- ${admin.email} (${admin.name || 'No name'})`);
      });
    } else {
      console.log('No admins found in database');
    }

    // Check if admin@andiamo.com exists
    const { data: existingAdmin, error: checkError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', 'admin@andiamo.com')
      .single();

    if (existingAdmin) {
      console.log('\n✅ Admin account exists: admin@andiamo.com');
      console.log('You can use these credentials:');
      console.log('Email: admin@andiamo.com');
      console.log('Password: adminpassword');
    } else {
      console.log('\n❌ Admin account not found. Creating one...');
      
      // Hash password
      const hashedPassword = await bcrypt.hash('adminpassword', 10);
      
      // Create admin account
      const { data: newAdmin, error: createError } = await supabase
        .from('admins')
        .insert({
          email: 'admin@andiamo.com',
          password: hashedPassword,
          name: 'Admin',
          role: 'admin'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating admin:', createError);
      } else {
        console.log('✅ Admin account created successfully!');
        console.log('Email: admin@andiamo.com');
        console.log('Password: adminpassword');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
checkAndCreateAdmin(); 