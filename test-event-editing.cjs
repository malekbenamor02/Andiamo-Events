// Test event editing functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEventEditing() {
  try {
    console.log('🔍 Testing event editing functionality...\n');
    
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
      console.log('\n📋 Testing edit action on event:', testEvent.name);

      // Step 2: Test update action
      console.log('📋 Step 2: Testing update action...');
      const updateData = {
        name: testEvent.name + ' (Updated)',
        description: testEvent.description + ' - Updated via test',
        updated_at: new Date().toISOString()
      };

      const { data: updateResult, error: updateError } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', testEvent.id)
        .select();

      if (updateError) {
        console.log('❌ Update action failed:', updateError.message);
        console.log('💡 Error details:', updateError);
      } else {
        console.log('✅ Update action successful!');
        console.log('📝 Updated event:', updateResult[0]);

        // Step 3: Verify the update
        console.log('\n📋 Step 3: Verifying update...');
        const { data: verifyData, error: verifyError } = await supabase
          .from('events')
          .select('*')
          .eq('id', testEvent.id)
          .single();

        if (verifyError) {
          console.log('❌ Verification failed:', verifyError.message);
        } else {
          console.log('✅ Verification successful!');
          console.log('📝 Current event data:', verifyData);
        }
      }
    } else {
      console.log('📝 No events found for testing');
    }

    console.log('\n🎉 Event editing test completed!');

  } catch (error) {
    console.error('❌ Event editing test failed:', error);
  }
}

testEventEditing(); 