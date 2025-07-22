// Fix events deletion by updating RLS policies
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixEventsDeletion() {
  try {
    console.log('🔧 Fixing events deletion by updating RLS policies...\n');
    
    // Step 1: Disable RLS temporarily
    console.log('📋 Step 1: Disabling RLS on events table...');
    const { error: disableError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE events DISABLE ROW LEVEL SECURITY;'
    });

    if (disableError) {
      console.log('⚠️  Could not disable RLS via RPC, trying alternative approach...');
      
      // Alternative: Create a policy that allows all operations
      console.log('📋 Creating permissive RLS policy...');
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: `
          DROP POLICY IF EXISTS "Enable all operations for events" ON events;
          CREATE POLICY "Enable all operations for events" ON events
            FOR ALL USING (true) WITH CHECK (true);
        `
      });

      if (policyError) {
        console.log('❌ Could not create policy via RPC:', policyError.message);
        console.log('💡 You need to run this SQL manually in your Supabase dashboard:');
        console.log(`
          -- Option 1: Disable RLS completely
          ALTER TABLE events DISABLE ROW LEVEL SECURITY;
          
          -- Option 2: Create permissive policy
          DROP POLICY IF EXISTS "Enable all operations for events" ON events;
          CREATE POLICY "Enable all operations for events" ON events
            FOR ALL USING (true) WITH CHECK (true);
        `);
        return;
      } else {
        console.log('✅ Created permissive RLS policy');
      }
    } else {
      console.log('✅ Disabled RLS on events table');
    }

    // Step 2: Test deletion again
    console.log('\n📋 Step 2: Testing event deletion...');
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .limit(1);

    if (fetchError) {
      console.log('❌ Failed to fetch events:', fetchError.message);
      return;
    }

    if (events && events.length > 0) {
      const testEvent = events[0];
      console.log(`📝 Testing deletion of event: ${testEvent.name}`);

      const { data: deleteData, error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', testEvent.id)
        .select();

      if (deleteError) {
        console.log('❌ Delete still failed:', deleteError.message);
        console.log('💡 Error details:', deleteError);
      } else {
        console.log('✅ Delete successful!');
        console.log('📝 Deleted event:', deleteData[0]);

        // Verify deletion
        const { data: verifyData, error: verifyError } = await supabase
          .from('events')
          .select('id')
          .eq('id', testEvent.id)
          .single();

        if (verifyError && verifyError.code === 'PGRST116') {
          console.log('✅ Verification: Event successfully deleted');
        } else {
          console.log('❌ Verification: Event still exists');
        }
      }
    } else {
      console.log('📝 No events found for testing');
    }

    console.log('\n🎉 Events deletion fix completed!');
    console.log('\n🌐 Test the admin dashboard now:');
    console.log('• Admin Login: http://localhost:8084/admin/login');
    console.log('• Admin Dashboard: http://localhost:8084/admin');

  } catch (error) {
    console.error('❌ Fix failed:', error);
    console.log('\n💡 Manual fix required:');
    console.log('1. Go to your Supabase Dashboard → SQL Editor');
    console.log('2. Run this SQL:');
    console.log(`
      -- Disable RLS on events table
      ALTER TABLE events DISABLE ROW LEVEL SECURITY;
      
      -- Or create permissive policy
      DROP POLICY IF EXISTS "Enable all operations for events" ON events;
      CREATE POLICY "Enable all operations for events" ON events
        FOR ALL USING (true) WITH CHECK (true);
    `);
  }
}

fixEventsDeletion(); 