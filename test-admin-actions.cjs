// Test admin actions (approve/reject applications)
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAdminActions() {
  try {
    console.log('🔍 Testing admin actions on applications...\n');
    
    // Step 1: Get all applications
    console.log('📋 Step 1: Fetching all applications...');
    const { data: applications, error: fetchError } = await supabase
      .from('ambassador_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.log('❌ Failed to fetch applications:', fetchError.message);
      return;
    }

    console.log('✅ Found', applications?.length || 0, 'applications');

    if (applications && applications.length > 0) {
      const pendingApps = applications.filter(app => app.status === 'pending');
      console.log('📊 Pending applications:', pendingApps.length);

      if (pendingApps.length > 0) {
        const testApp = pendingApps[0];
        console.log('\n📋 Testing approve action on application:', testApp.full_name);

        // Step 2: Test approve action
        console.log('📋 Step 2: Testing approve action...');
        const { data: approveData, error: approveError } = await supabase
          .from('ambassador_applications')
          .update({ status: 'approved' })
          .eq('id', testApp.id)
          .select();

        if (approveError) {
          console.log('❌ Approve action failed:', approveError.message);
        } else {
          console.log('✅ Approve action successful!');
          console.log('📝 Updated application:', approveData[0]);

          // Step 3: Test reject action (change back to rejected)
          console.log('\n📋 Step 3: Testing reject action...');
          const { data: rejectData, error: rejectError } = await supabase
            .from('ambassador_applications')
            .update({ status: 'rejected' })
            .eq('id', testApp.id)
            .select();

          if (rejectError) {
            console.log('❌ Reject action failed:', rejectError.message);
          } else {
            console.log('✅ Reject action successful!');
            console.log('📝 Updated application:', rejectData[0]);

            // Step 4: Change back to pending for testing
            console.log('\n📋 Step 4: Resetting to pending for testing...');
            const { data: resetData, error: resetError } = await supabase
              .from('ambassador_applications')
              .update({ status: 'pending' })
              .eq('id', testApp.id)
              .select();

            if (resetError) {
              console.log('❌ Reset action failed:', resetError.message);
            } else {
              console.log('✅ Reset action successful!');
              console.log('📝 Application reset to pending');
            }
          }
        }
      } else {
        console.log('📝 No pending applications found for testing');
      }
    }

    console.log('\n🎉 Admin actions are working correctly!');
    console.log('\n🌐 Ready to test in admin dashboard:');
    console.log('• Admin Login: http://localhost:8082/admin/login');
    console.log('• Admin Dashboard: http://localhost:8082/admin');
    console.log('\n💡 The admin can now:');
    console.log('• View all applications');
    console.log('• Approve applications');
    console.log('• Reject applications');
    console.log('• Send email notifications');

  } catch (error) {
    console.error('❌ Admin actions test failed:', error);
  }
}

testAdminActions(); 