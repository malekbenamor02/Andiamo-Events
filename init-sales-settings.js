// Script to initialize sales settings in database
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ykeryyraxmtjunnotoep.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

async function initSalesSettings() {
  console.log('='.repeat(60));
  console.log('INITIALIZING SALES SETTINGS');
  console.log('='.repeat(60));

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase
      .from('site_content')
      .upsert({
        key: 'sales_settings',
        content: { enabled: true },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error('Error initializing sales settings:', error);
      process.exit(1);
    }

    console.log('✓ Sales settings initialized successfully!');
    console.log('  Sales are enabled by default.');
    console.log('\nYou can now toggle sales in the admin dashboard Settings tab.\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

initSalesSettings().catch(console.error);





