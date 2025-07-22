// Test event deletion functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEventDeletion() {
  try {
    console.log('🔍 Testing event deletion...\n');
    
    // Step 1: Get all events
    console.log('📋 Step 1: Fetching all events...');
    const { data: events, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.log('❌ Failed to fetch events:', fetchError.message);
      return;
    }

    console.log('✅ Found', events?.length || 0, 'events');

    if (events && events.length > 0) {
      const testEvent = events[0];
      console.log('\n📋 Testing delete action on event:', testEvent.name);

      // Step 2: Test delete action
      console.log('📋 Step 2: Testing delete action...');
      const { data: deleteData, error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', testEvent.id)
        .select();

      if (deleteError) {
        console.log('❌ Delete action failed:', deleteError.message);
        console.log('💡 Error details:', deleteError);
      } else {
        console.log('✅ Delete action successful!');
        console.log('📝 Deleted event:', deleteData[0]);

        // Step 3: Verify deletion by fetching again
        console.log('\n📋 Step 3: Verifying deletion...');
        const { data: eventsAfterDelete, error: verifyError } = await supabase
          .from('events')
          .select('*')
          .eq('id', testEvent.id);

        if (verifyError) {
          console.log('❌ Verification failed:', verifyError.message);
        } else {
          console.log('✅ Verification successful!');
          console.log('📝 Events with same ID after delete:', eventsAfterDelete?.length || 0);
        }
      }
    } else {
      console.log('📝 No events found for testing');
    }

    console.log('\n🎉 Event deletion test completed!');

  } catch (error) {
    console.error('❌ Event deletion test failed:', error);
  }
}

testEventDeletion(); 