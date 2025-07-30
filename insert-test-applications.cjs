// Insert test applications for admin testing
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = 'https://ykeryyraxmtjunnotoep.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZXJ5eXJheG10anVubm90b2VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTE4MjQsImV4cCI6MjA2ODI2NzgyNH0.0nKr2T72ztFAlMRRllkdqNlzJASadgYKO0hkSp8hGPM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function insertTestApplications() {
  const testApplications = [
    {
      full_name: 'Alice Test',
      age: 22,
      phone_number: '+21611111111',
      email: 'alice.test@example.com',
      city: 'Tunis',
      social_link: 'https://instagram.com/alice.test',
      motivation: 'I love events and want to join!',
      status: 'pending'
    },
    {
      full_name: 'Bob Example',
      age: 25,
      phone_number: '+21622222222',
      email: 'bob.example@example.com',
      city: 'Sousse',
      social_link: 'https://instagram.com/bob.example',
      motivation: 'Excited to be an ambassador.',
      status: 'pending'
    },
    {
      full_name: 'Charlie Demo',
      age: 28,
      phone_number: '+21633333333',
      email: 'charlie.demo@example.com',
      city: 'Monastir',
      social_link: 'https://instagram.com/charlie.demo',
      motivation: 'Looking forward to helping out.',
      status: 'pending'
    }
  ];

  const { data, error } = await supabase
    .from('ambassador_applications')
    .insert(testApplications)
    .select();

  if (error) {
    console.error('Error inserting test applications:', error);
  } else {
    console.log('Inserted test applications:', data);
  }
}

insertTestApplications(); 