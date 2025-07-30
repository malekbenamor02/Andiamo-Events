const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = "https://ykeryyraxmtjunnotoep.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPriceColumns() {
  try {
    console.log('🔧 Adding price columns to events table...\n');
    
    // Add price columns
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE events 
        ADD COLUMN IF NOT EXISTS standard_price DECIMAL(10,2) DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS vip_price DECIMAL(10,2) DEFAULT 0.00;
      `
    });

    if (alterError) {
      console.log('❌ Error adding price columns:', alterError.message);
      return;
    }

    console.log('✅ Price columns added successfully!');

    // Update existing events with sample prices
    console.log('\n📋 Updating existing events with sample prices...');
    const { error: updateError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE events 
        SET 
          standard_price = CASE 
            WHEN name LIKE '%Beach Party%' THEN 25.00
            WHEN name LIKE '%Club Night%' THEN 35.00
            WHEN name LIKE '%Sousse%' THEN 20.00
            ELSE 30.00
          END,
          vip_price = CASE 
            WHEN name LIKE '%Beach Party%' THEN 45.00
            WHEN name LIKE '%Club Night%' THEN 60.00
            WHEN name LIKE '%Sousse%' THEN 35.00
            ELSE 50.00
          END
        WHERE standard_price = 0.00 OR vip_price = 0.00;
      `
    });

    if (updateError) {
      console.log('⚠️  Warning updating prices:', updateError.message);
    } else {
      console.log('✅ Sample prices added to existing events!');
    }

    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const { data: eventsData, error: selectError } = await supabase
      .from('events')
      .select('name, standard_price, vip_price')
      .limit(5);

    if (selectError) {
      console.log('❌ Error verifying changes:', selectError.message);
    } else {
      console.log('✅ Events with prices:');
      eventsData?.forEach(event => {
        console.log(`• ${event.name}: Standard ${event.standard_price} TND, VIP ${event.vip_price} TND`);
      });
    }

    console.log('\n🎉 Price columns successfully added to events table!');
    console.log('\n🌐 You can now:');
    console.log('• Go to Admin Dashboard: http://localhost:8082/admin');
    console.log('• Create/edit events with prices');
    console.log('• View prices on the public events page');

  } catch (error) {
    console.error('❌ Failed to add price columns:', error);
  }
}

addPriceColumns(); 