-- =============================================================================
-- RLS Policies for Remind App
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- Since this app uses custom username/password auth (not Supabase Auth),
-- we grant full access to the anon role and rely on app-level filtering
-- (user_id columns) for data isolation between users.
-- =============================================================================

-- users
CREATE POLICY "anon full access" ON public.users
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- task_groups
CREATE POLICY "anon full access" ON public.task_groups
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- group_members
CREATE POLICY "anon full access" ON public.group_members
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- tasks
CREATE POLICY "anon full access" ON public.tasks
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- checklist_items
CREATE POLICY "anon full access" ON public.checklist_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- scheduled_notifications
CREATE POLICY "anon full access" ON public.scheduled_notifications
  FOR ALL TO anon USING (true) WITH CHECK (true);
