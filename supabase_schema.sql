-- =============================================================================
-- Remind App — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- =============================================================================

-- Users (custom auth — stores hashed passwords)
CREATE TABLE IF NOT EXISTS public.users (
  id           BIGSERIAL PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  password     TEXT NOT NULL,           -- store a bcrypt/argon2 hash, NOT plaintext
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- Task groups
CREATE TABLE IF NOT EXISTS public.task_groups (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_id   BIGINT NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Group members
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

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id               BIGSERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('deadline', 'recurring', 'someday')),
  default_deadline TIMESTAMPTZ,
  recurrence_freq  TEXT,
  recurrence_time  TEXT,
  recurrence_days  TEXT,               -- JSON array stored as text
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'archived')),
  user_id          BIGINT NOT NULL REFERENCES public.users (id)        ON DELETE CASCADE,
  group_id         BIGINT          REFERENCES public.task_groups (id)  ON DELETE CASCADE,
  assigned_to      BIGINT          REFERENCES public.users (id)        ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_user  ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group ON public.tasks (group_id);

-- Checklist items
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id         BIGSERIAL PRIMARY KEY,
  task_id    BIGINT NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT FALSE,
  deadline   TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_checklist_task ON public.checklist_items (task_id);

-- Scheduled notifications
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id                   BIGSERIAL PRIMARY KEY,
  task_id              BIGINT NOT NULL REFERENCES public.tasks (id)          ON DELETE CASCADE,
  checklist_item_id    BIGINT          REFERENCES public.checklist_items (id) ON DELETE CASCADE,
  expo_notification_id TEXT NOT NULL,
  fire_at              TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_task ON public.scheduled_notifications (task_id);


-- =============================================================================
-- Row-Level Security (RLS)
-- Prevents users from reading/writing each other's data even though they
-- share the same database.  Enable after you confirm the schema is working.
-- =============================================================================

-- Enable RLS on every table
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- NOTE: Because this app uses custom username/password auth (not Supabase Auth),
-- RLS policies based on auth.uid() won't work directly.
-- Two options:
--   A) Migrate to Supabase Auth (recommended) — then use auth.uid() in policies.
--   B) Pass user_id via a custom JWT claim — ask your backend engineer.
-- For now, RLS is enabled but no policies are added, which means all access
-- goes through the service role key only (use from a secure server, not the app).
-- Using the anon key with no policies will block all access — add policies first.
