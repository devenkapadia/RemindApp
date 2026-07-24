/**
 * Quick connection test — inserts 3 test users into Supabase and reads them back.
 * Run with:  node scripts/test-supabase-connection.js
 *
 * Reads credentials directly from .env (no Expo bundler needed).
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Load .env manually (avoid requiring dotenv as a dependency)
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const match = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    });
}

const SUPABASE_URL      = envVars['EXPO_PUBLIC_SUPABASE_URL'];
const SUPABASE_ANON_KEY = envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌  Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Import Supabase (CommonJS-compatible path)
// ---------------------------------------------------------------------------
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// Test users to insert
// ---------------------------------------------------------------------------
const TEST_USERS = [
  { username: 'alice_test',   password: 'password123', display_name: 'Alice' },
  { username: 'bob_test',     password: 'password123', display_name: 'Bob'   },
  { username: 'charlie_test', password: 'password123', display_name: 'Charlie' },
];

async function run() {
  console.log(`\n🔗  Connecting to: ${SUPABASE_URL}\n`);

  // ── 1. Insert test users ────────────────────────────────────────────────
  console.log('📝  Inserting test users...');
  for (const user of TEST_USERS) {
    const { data, error } = await supabase
      .from('users')
      .insert(user)
      .select('id, username, display_name, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        console.log(`  ⚠️  ${user.username} already exists — skipping`);
      } else {
        console.error(`  ❌  Failed to insert ${user.username}:`, error.message);
      }
    } else {
      console.log(`  ✅  Inserted: id=${data.id}  username=${data.username}  display_name=${data.display_name}  created_at=${data.created_at}`);
    }
  }

  // ── 2. Read all test users back ─────────────────────────────────────────
  console.log('\n📖  Reading back users where username ends with _test...');
  const { data: rows, error: readError } = await supabase
    .from('users')
    .select('id, username, display_name, created_at')
    .like('username', '%_test')
    .order('id', { ascending: true });

  if (readError) {
    console.error('  ❌  Read failed:', readError.message);
  } else {
    console.log(`  Found ${rows.length} user(s):`);
    rows.forEach(u =>
      console.log(`    • id=${u.id}  username=${u.username}  display_name=${u.display_name}`)
    );
  }

  console.log('\n✅  Connection test complete.\n');
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
