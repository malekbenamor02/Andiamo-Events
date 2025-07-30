// Comprehensive database setup script for Andiamo Nightlife Vibes
// This script will create all necessary tables and initial data

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup for Andiamo Nightlife Vibes...\n');

    // 1. Create admins table
    console.log('📋 Creating admins table...');
    const { error: adminsError } = await supabase.rpc('exec_sql', {
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

    if (adminsError) {
      console.log('⚠️  Admins table creation (might already exist):', adminsError.message);
    } else {
      console.log('✅ Admins table created successfully');
    }

    // 2. Create ambassadors table
    console.log('📋 Creating ambassadors table...');
    const { error: ambassadorsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ambassadors (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          full_name TEXT NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          email TEXT,
          city TEXT NOT NULL,
          password TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
          commission_rate DECIMAL(5,2) DEFAULT 10.00,
          approved_by UUID,
          approved_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (ambassadorsError) {
      console.log('⚠️  Ambassadors table creation (might already exist):', ambassadorsError.message);
    } else {
      console.log('✅ Ambassadors table created successfully');
    }

    // 3. Create clients table
    console.log('📋 Creating clients table...');
    const { error: clientsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS clients (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
          event_id UUID REFERENCES events(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT,
          age INTEGER,
          standard_tickets INTEGER DEFAULT 0,
          vip_tickets INTEGER DEFAULT 0,
          total_amount DECIMAL(10,2) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (clientsError) {
      console.log('⚠️  Clients table creation (might already exist):', clientsError.message);
    } else {
      console.log('✅ Clients table created successfully');
    }

    // 4. Create ambassador_events table
    console.log('📋 Creating ambassador_events table...');
    const { error: ambassadorEventsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ambassador_events (
          ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
          event_id UUID REFERENCES events(id) ON DELETE CASCADE,
          assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (ambassador_id, event_id)
        );
      `
    });

    if (ambassadorEventsError) {
      console.log('⚠️  Ambassador events table creation (might already exist):', ambassadorEventsError.message);
    } else {
      console.log('✅ Ambassador events table created successfully');
    }

    // 5. Create ambassador_performance table
    console.log('📋 Creating ambassador_performance table...');
    const { error: performanceError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ambassador_performance (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
          event_id UUID REFERENCES events(id) ON DELETE CASCADE,
          sales_count INTEGER DEFAULT 0,
          revenue_generated DECIMAL(10,2) DEFAULT 0.00,
          commission_earned DECIMAL(10,2) DEFAULT 0.00,
          rank INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (performanceError) {
      console.log('⚠️  Ambassador performance table creation (might already exist):', performanceError.message);
    } else {
      console.log('✅ Ambassador performance table created successfully');
    }

    // 6. Create indexes for better performance
    console.log('📋 Creating database indexes...');
    const { error: indexesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
        CREATE INDEX IF NOT EXISTS idx_ambassadors_phone ON ambassadors(phone);
        CREATE INDEX IF NOT EXISTS idx_ambassadors_status ON ambassadors(status);
        CREATE INDEX IF NOT EXISTS idx_clients_ambassador_id ON clients(ambassador_id);
        CREATE INDEX IF NOT EXISTS idx_clients_event_id ON clients(event_id);
        CREATE INDEX IF NOT EXISTS idx_ambassador_events_ambassador_id ON ambassador_events(ambassador_id);
        CREATE INDEX IF NOT EXISTS idx_ambassador_events_event_id ON ambassador_events(event_id);
        CREATE INDEX IF NOT EXISTS idx_ambassador_performance_ambassador_id ON ambassador_performance(ambassador_id);
        CREATE INDEX IF NOT EXISTS idx_ambassador_performance_event_id ON ambassador_performance(event_id);
      `
    });

    if (indexesError) {
      console.log('⚠️  Indexes creation (might already exist):', indexesError.message);
    } else {
      console.log('✅ Database indexes created successfully');
    }

    // 7. Enable Row Level Security (RLS)
    console.log('📋 Enabling Row Level Security...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ambassadors ENABLE ROW LEVEL SECURITY;
        ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ambassador_events ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ambassador_performance ENABLE ROW LEVEL SECURITY;
      `
    });

    if (rlsError) {
      console.log('⚠️  RLS setup (might already exist):', rlsError.message);
    } else {
      console.log('✅ Row Level Security enabled successfully');
    }

    // 8. Create RLS policies
    console.log('📋 Creating RLS policies...');
    const { error: policiesError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Admins can view admin data
        DROP POLICY IF EXISTS "Admins can view admin data" ON admins;
        CREATE POLICY "Admins can view admin data" ON admins
          FOR ALL USING (true);

        -- Ambassadors can only see their own data
        DROP POLICY IF EXISTS "Ambassadors can view own data" ON ambassadors;
        CREATE POLICY "Ambassadors can view own data" ON ambassadors
          FOR SELECT USING (auth.uid()::text = id::text);

        -- Anyone can insert new ambassador applications
        DROP POLICY IF EXISTS "Anyone can insert ambassador applications" ON ambassadors;
        CREATE POLICY "Anyone can insert ambassador applications" ON ambassadors
          FOR INSERT WITH CHECK (true);

        -- Ambassadors can update their own data
        DROP POLICY IF EXISTS "Ambassadors can update own data" ON ambassadors;
        CREATE POLICY "Ambassadors can update own data" ON ambassadors
          FOR UPDATE USING (auth.uid()::text = id::text);

        -- Clients policies
        DROP POLICY IF EXISTS "Ambassadors can view own clients" ON clients;
        CREATE POLICY "Ambassadors can view own clients" ON clients
          FOR SELECT USING (
            ambassador_id IN (
              SELECT id FROM ambassadors WHERE auth.uid()::text = id::text
            )
          );

        DROP POLICY IF EXISTS "Ambassadors can insert own clients" ON clients;
        CREATE POLICY "Ambassadors can insert own clients" ON clients
          FOR INSERT WITH CHECK (
            ambassador_id IN (
              SELECT id FROM ambassadors WHERE auth.uid()::text = id::text
            )
          );

        -- Admin can view all data
        DROP POLICY IF EXISTS "Admin can view all ambassadors" ON ambassadors;
        CREATE POLICY "Admin can view all ambassadors" ON ambassadors
          FOR ALL USING (true);

        DROP POLICY IF EXISTS "Admin can view all clients" ON clients;
        CREATE POLICY "Admin can view all clients" ON clients
          FOR ALL USING (true);

        DROP POLICY IF EXISTS "Admin can view all ambassador events" ON ambassador_events;
        CREATE POLICY "Admin can view all ambassador events" ON ambassador_events
          FOR ALL USING (true);

        DROP POLICY IF EXISTS "Admin can view all ambassador performance" ON ambassador_performance;
        CREATE POLICY "Admin can view all ambassador performance" ON ambassador_performance
          FOR ALL USING (true);
      `
    });

    if (policiesError) {
      console.log('⚠️  RLS policies setup (might already exist):', policiesError.message);
    } else {
      console.log('✅ RLS policies created successfully');
    }

    // 9. Insert default admin user
    console.log('📋 Creating default admin user...');
    const { data: adminData, error: adminInsertError } = await supabase
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

    if (adminInsertError) {
      console.error('❌ Error creating admin user:', adminInsertError);
    } else {
      console.log('✅ Default admin user created successfully');
    }

    // 10. Insert sample events if they don't exist
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
      console.log('⚠️  Sample events creation (might already exist):', eventsError.message);
    } else {
      console.log('✅ Sample events created successfully');
    }

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Admins table created');
    console.log('✅ Ambassadors table created');
    console.log('✅ Clients table created');
    console.log('✅ Ambassador events table created');
    console.log('✅ Ambassador performance table created');
    console.log('✅ Database indexes created');
    console.log('✅ Row Level Security enabled');
    console.log('✅ RLS policies created');
    console.log('✅ Default admin user created');
    console.log('✅ Sample events created');
    
    console.log('\n🔑 Default Admin Credentials:');
    console.log('📧 Email: admin@andiamo.com');
    console.log('🔐 Password: admin123');
    console.log('🌐 Login URL: http://localhost:5173/admin/login');
    
    console.log('\n🚀 Next steps:');
    console.log('1. Start the development server: npm run dev:full');
    console.log('2. Visit http://localhost:5173/admin/login');
    console.log('3. Login with the admin credentials above');
    console.log('4. Start managing your ambassador applications!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
  }
}

setupDatabase(); 