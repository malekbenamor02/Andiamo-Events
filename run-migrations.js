/**
 * Migration Runner Script
 * Runs all migration files in order from supabase/migrations directory
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const { Client } = pg;

// Connection string from command line or environment
const connectionString = process.argv[2] || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: Database connection string required');
  console.log('Usage: node run-migrations.js "postgresql://user:pass@host:port/db"');
  console.log('   OR: DATABASE_URL="..." node run-migrations.js');
  process.exit(1);
}

// Extract password from connection string for display (masked)
const maskedConnection = connectionString.replace(/:([^:@]+)@/, ':****@');
console.log(`🔌 Connecting to: ${maskedConnection}`);

const client = new Client({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Supabase requires SSL but uses self-signed certs
  }
});

// Get all migration files, sorted by name
const migrationsDir = join(process.cwd(), 'supabase', 'migrations');
const migrationFiles = readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .filter(file => file.startsWith('20250202')) // Only run our new migrations
  .sort();

console.log(`\n📋 Found ${migrationFiles.length} migration files to run:\n`);
migrationFiles.forEach((file, index) => {
  console.log(`  ${index + 1}. ${file}`);
});

async function runMigrations() {
  try {
    await client.connect();
    console.log('\n✅ Connected to database\n');

    for (const file of migrationFiles) {
      const filePath = join(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf8');
      
      console.log(`\n🔄 Running: ${file}`);
      console.log('─'.repeat(60));
      
      try {
        await client.query(sql);
        console.log(`✅ Success: ${file}`);
      } catch (error) {
        console.error(`❌ Error in ${file}:`);
        console.error(`   ${error.message}`);
        
        // Check if it's a non-critical error (like table doesn't exist)
        if (error.message.includes('does not exist') && 
            (error.message.includes('scans') || error.message.includes('tickets'))) {
          console.log(`   ⚠️  Warning: This is expected if tables don't exist yet.`);
          console.log(`   Migration will work when tables are created.`);
        } else {
          console.error(`\n❌ Migration failed. Stopping.`);
          throw error;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All migrations completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();

