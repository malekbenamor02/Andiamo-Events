// Simple database setup for Andiamo Nightlife Vibes
// This script creates tables by inserting data and letting Supabase handle table creation

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabaseSimple() {
  try {
    console.log('🚀 Starting simple database setup for Andiamo Nightlife Vibes...\n');

    // 1. Create admin user (this will create the admins table if it doesn't exist)
    console.log('📋 Creating admin user...');
    const { data: adminData, error: adminError } = await supabase
      .from('admins')
      .upsert({
        name: 'Admin',
        email: 'admin@andiamo.com',
        password: 'admin123',
        role: 'admin',
        is_active: true
      }, {
        onConflict: 'email'
      });

    if (adminError) {
      console.log('⚠️  Admin creation failed:', adminError.message);
      console.log('💡 You may need to create the admins table manually in Supabase dashboard');
    } else {
      console.log('✅ Admin user created successfully');
    }

    // 2. Create sample ambassador (this will create the ambassadors table)
    console.log('📋 Creating sample ambassador...');
    const { data: ambassadorData, error: ambassadorError } = await supabase
      .from('ambassadors')
      .upsert({
        full_name: 'Sample Ambassador',
        phone: '+21612345678',
        email: 'sample@ambassador.com',
        city: 'Tunis',
        password: 'password123',
        status: 'approved',
        commission_rate: 10.00
      }, {
        onConflict: 'phone'
      });

    if (ambassadorError) {
      console.log('⚠️  Ambassador creation failed:', ambassadorError.message);
      console.log('💡 You may need to create the ambassadors table manually in Supabase dashboard');
    } else {
      console.log('✅ Sample ambassador created successfully');
    }

    // 3. Create sample client (this will create the clients table)
    console.log('📋 Creating sample client...');
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .upsert({
        ambassador_id: ambassadorData?.[0]?.id || '00000000-0000-0000-0000-000000000000',
        event_id: '00000000-0000-0000-0000-000000000000', // We'll update this later
        full_name: 'Sample Client',
        phone: '+21698765432',
        email: 'client@example.com',
        age: 25,
        standard_tickets: 2,
        vip_tickets: 0,
        total_amount: 50.00
      }, {
        onConflict: 'phone'
      });

    if (clientError) {
      console.log('⚠️  Client creation failed:', clientError.message);
      console.log('💡 You may need to create the clients table manually in Supabase dashboard');
    } else {
      console.log('✅ Sample client created successfully');
    }

    // 4. Create sample events if they don't exist
    console.log('📋 Creating sample events...');
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .upsert([
        {
          name: 'Beach Party Monastir',
          date: '2024-08-15',
          city: 'Monastir',
          venue: 'Beach Club',
          description: 'Amazing beach party with international DJs',
          featured: true,
          ticket_link: 'https://tickets.andiamo.com/beach-party',
          whatsapp_link: 'https://wa.me/21612345678'
        },
        {
          name: 'Club Night Tunis',
          date: '2024-08-20',
          city: 'Tunis',
          venue: 'Club Andiamo',
          description: 'Exclusive club night with premium experience',
          featured: true,
          ticket_link: 'https://tickets.andiamo.com/club-night',
          whatsapp_link: 'https://wa.me/21612345678'
        },
        {
          name: 'Sousse Night Event',
          date: '2024-08-25',
          city: 'Sousse',
          venue: 'Night Club Sousse',
          description: 'Unforgettable night in Sousse',
          featured: false,
          ticket_link: 'https://tickets.andiamo.com/sousse-night',
          whatsapp_link: 'https://wa.me/21612345678'
        }
      ], {
        onConflict: 'name'
      });

    if (eventsError) {
      console.log('⚠️  Sample events creation failed:', eventsError.message);
    } else {
      console.log('✅ Sample events created successfully');
    }

    console.log('\n🎉 Simple database setup completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Admin user created');
    console.log('✅ Sample ambassador created');
    console.log('✅ Sample client created');
    console.log('✅ Sample events created');
    
    console.log('\n🔑 Default Admin Credentials:');
    console.log('📧 Email: admin@andiamo.com');
    console.log('🔐 Password: admin123');
    console.log('🌐 Login URL: http://localhost:5173/admin/login');
    
    console.log('\n⚠️  Important Notes:');
    console.log('• If any tables failed to create, you may need to create them manually in Supabase dashboard');
    console.log('• Go to your Supabase dashboard > Table Editor to see the created tables');
    console.log('• You can also run SQL commands in the SQL Editor to create missing tables');
    
    console.log('\n🚀 Next steps:');
    console.log('1. Start the development server: npm run dev:full');
    console.log('2. Visit http://localhost:5173/admin/login');
    console.log('3. Login with the admin credentials above');
    console.log('4. Start managing your ambassador applications!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
  }
}

setupDatabaseSimple(); 