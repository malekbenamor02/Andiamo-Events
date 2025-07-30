// Script to manually insert admin user into database
// Run this after setting up your Supabase project

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdmin() {
  try {
    console.log('Setting up admin user...');
    
    // First, create the admins table if it doesn't exist
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS admins (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (createTableError) {
      console.log('Table creation error (might already exist):', createTableError.message);
    }

    // Insert admin user
    const plainPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const { data, error } = await supabase
      .from('admins')
      .upsert({
        name: 'Admin',
        email: 'admin@andiamo.com',
        password: hashedPassword,
        role: 'admin',
        is_active: true
      }, {
        onConflict: 'email'
      });

    if (error) {
      console.error('Error inserting admin:', error);
      return;
    }

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@andiamo.com');
    console.log('🔑 Password: admin123');
    console.log('🌐 Login URL: http://localhost:5173/admin/login');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupAdmin(); 