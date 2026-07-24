/**
 * Creates all Remind App tables in Supabase via the Management API.
 * Requires a service_role key (not the anon key).
 *
 * Run with:  node scripts/run-schema.js <service_role_key>
 *
 * Find the service_role key in:
 *   Supabase Dashboard → Project → Settings → API → service_role (secret) key
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const envPath = path.resolve(__dirname, '../.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL      = envVars['EXPO_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY  = process.argv[2] || envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Usage: node scripts/run-schema.js <service_role_key>');
  console.error('Or add SUPABASE_SERVICE_ROLE_KEY to your .env');
  process.exit(1);
}

// Extract project ref from URL  (https://<ref>.supabase.co)
const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

const SQL = `
CREATE TABLE IF NOT EXISTS public.users (
  id           BIGSERIAL PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

CREATE TABLE IF NOT EXISTS public.task_groups (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id         BIGSERIAL PRIMARY KEY,
  group_id   BIGINT NOT NULL REFERENCES public.task_groups (id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES public.users (id)        ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON public.group_members (user_id);

CREATE TABLE IF NOT EXISTS public.tasks (
  id               BIGSERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('deadline', 'recurring', 'someday')),
  default_deadline TIMESTAMPTZ,
  recurrence_freq  TEXT,
  recurrence_time  TEXT,
  recurrence_days  TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'archived')),
  user_id          BIGINT NOT NULL REFERENCES public.users (id)        ON DELETE CASCADE,
  group_id         BIGINT          REFERENCES public.task_groups (id)  ON DELETE CASCADE,
  assigned_to      BIGINT          REFERENCES public.users (id)        ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user  ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON public.tasks (group_id);

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id         BIGSERIAL PRIMARY KEY,
  task_id    BIGINT NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  deadline   TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checklist_task ON public.checklist_items (task_id);

CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id                   BIGSERIAL PRIMARY KEY,
  task_id              BIGINT NOT NULL REFERENCES public.tasks (id)           ON DELETE CASCADE,
  checklist_item_id    BIGINT          REFERENCES public.checklist_items (id) ON DELETE CASCADE,
  expo_notification_id TEXT NOT NULL,
  fire_at              TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_task ON public.scheduled_notifications (task_id);
`;

function post(url, token, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname,
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log(`\n🔗  Project: ${projectRef}`);
  console.log('📦  Running schema migrations via Management API...\n');

  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  const res = await post(url, SERVICE_ROLE_KEY, { query: SQL });

  if (res.status === 200 || res.status === 201) {
    console.log('✅  Schema created successfully!\n');
    console.log('Now run:  node scripts/test-supabase-connection.js\n');
  } else {
    console.error(`❌  API returned ${res.status}:`);
    console.error(JSON.stringify(res.body, null, 2));
    console.error('\nFallback: paste supabase_schema.sql into Supabase Dashboard → SQL Editor\n');
    process.exit(1);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
