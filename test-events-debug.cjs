const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testEvents() {
  try {
    console.log('Fetching events from database...');
    
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching events:', error);
      return;
    }

    console.log(`Found ${data.length} events:`);
    
    data.forEach((event, index) => {
      console.log(`${index + 1}. ${event.name}`);
      console.log(`   - Event Type: ${event.event_type || 'null (defaults to upcoming)'}`);
      console.log(`   - Date: ${event.date}`);
      console.log(`   - City: ${event.city}`);
      console.log(`   - Featured: ${event.featured}`);
      console.log(`   - Gallery Images: ${event.gallery_images?.length || 0}`);
      console.log(`   - Gallery Videos: ${event.gallery_videos?.length || 0}`);
      console.log('');
    });

    // Check upcoming vs gallery events
    const upcomingEvents = data.filter(event => 
      event.event_type === 'upcoming' || !event.event_type
    );
    
    const galleryEvents = data.filter(event => 
      event.event_type === 'gallery'
    );

    console.log(`\nSummary:`);
    console.log(`- Upcoming Events: ${upcomingEvents.length}`);
    console.log(`- Gallery Events: ${galleryEvents.length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

testEvents(); 