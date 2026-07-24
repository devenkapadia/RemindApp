/**
 * supabaseDb.js
 *
 * Drop-in replacement for db.js using Supabase (PostgreSQL) instead of
 * local SQLite.  Every exported function has the same signature as the
 * original so screens / contexts need zero changes — just swap the import.
 *
 * HOW TO SWITCH:
 *   In every file that currently imports from '../database/db', change:
 *     import { ... } from '../database/db';
 *   to:
 *     import { ... } from '../database/supabaseDb';
 *
 *   Also update App.js:
 *     - Remove the `await initDatabase()` call (not needed for Supabase).
 *     - Remove the import of `initDatabase` from db.js.
 */

import { supabase } from '../config/supabase';

// ---------------------------------------------------------------------------
// initDatabase — no-op for Supabase (tables are created in the dashboard).
// Kept so App.js doesn't need an immediate change.
// ---------------------------------------------------------------------------
export async function initDatabase() {
  // Nothing to do — Supabase tables are managed via the dashboard / migrations.
  console.log('Supabase client ready (no local init required).');
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function createUser(user) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      username: user.username,
      password: user.password,          // NOTE: hash passwords before storing
      display_name: user.display_name || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function getUser(id) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getUserByUsername(username) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateUser(id, updates) {
  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title,
      type: task.type,
      default_deadline: task.default_deadline || null,
      recurrence_freq: task.recurrence_freq || null,
      recurrence_time: task.recurrence_time || null,
      recurrence_days: task.recurrence_days ? JSON.stringify(task.recurrence_days) : null,
      status: task.status || 'pending',
      user_id: task.user_id,
      group_id: task.group_id || null,
      assigned_to: task.assigned_to || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function getTask(id) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.recurrence_days) data.recurrence_days = JSON.parse(data.recurrence_days);
  return data;
}

export async function getAllTasks(filters = {}) {
  let query = supabase
    .from('tasks')
    .select('*, assigned_user:users!assigned_to(username, display_name)')
    .order('created_at', { ascending: false });

  if (filters.user_id)   query = query.eq('user_id', filters.user_id);
  if (filters.type)      query = query.eq('type', filters.type);
  if (filters.status)    query = query.eq('status', filters.status);

  if (filters.group_id !== undefined) {
    if (filters.group_id === null) query = query.is('group_id', null);
    else                           query = query.eq('group_id', filters.group_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map(task => {
    if (task.recurrence_days) task.recurrence_days = JSON.parse(task.recurrence_days);
    // Flatten joined user columns to match SQLite shape
    task.assigned_to_username     = task.assigned_user?.username     || null;
    task.assigned_to_display_name = task.assigned_user?.display_name || null;
    delete task.assigned_user;
    return task;
  });
}

export async function updateTask(id, updates) {
  const payload = { ...updates };
  if (payload.recurrence_days) payload.recurrence_days = JSON.stringify(payload.recurrence_days);

  const { error } = await supabase
    .from('tasks')
    .update(payload)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Checklist Items
// ---------------------------------------------------------------------------

export async function createChecklistItem(item) {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({
      task_id:    item.task_id,
      text:       item.text,
      done:       item.done ? true : false,
      deadline:   item.deadline || null,
      sort_order: item.sort_order || 0,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function getChecklistItems(taskId) {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('task_id', taskId)
    .order('sort_order', { ascending: true })
    .order('id',         { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(item => ({ ...item, done: !!item.done }));
}

export async function updateChecklistItem(id, updates) {
  const { error } = await supabase
    .from('checklist_items')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteChecklistItem(id) {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Scheduled Notifications
// ---------------------------------------------------------------------------

export async function createScheduledNotification(notification) {
  const { data, error } = await supabase
    .from('scheduled_notifications')
    .insert({
      task_id:              notification.task_id,
      checklist_item_id:    notification.checklist_item_id || null,
      expo_notification_id: notification.expo_notification_id,
      fire_at:              notification.fire_at,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function getScheduledNotifications(taskId, checklistItemId = null) {
  let query = supabase
    .from('scheduled_notifications')
    .select('*')
    .eq('task_id', taskId);

  if (checklistItemId !== null) query = query.eq('checklist_item_id', checklistItemId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function deleteScheduledNotifications(taskId, checklistItemId = null) {
  let query = supabase
    .from('scheduled_notifications')
    .delete()
    .eq('task_id', taskId);

  if (checklistItemId !== null) query = query.eq('checklist_item_id', checklistItemId);

  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function deleteScheduledNotification(id) {
  const { error } = await supabase.from('scheduled_notifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Helper: task with checklist items
// ---------------------------------------------------------------------------

export async function getTaskWithItems(taskId) {
  const task = await getTask(taskId);
  if (!task) return null;

  // Fetch assignee display name separately
  if (task.assigned_to) {
    const assignee = await getUser(task.assigned_to);
    task.assigned_to_username     = assignee?.username     || null;
    task.assigned_to_display_name = assignee?.display_name || null;
  }

  const items = await getChecklistItems(taskId);
  return { ...task, items };
}

// ---------------------------------------------------------------------------
// Today's tasks
// ---------------------------------------------------------------------------

export async function getTodayTasks(userId) {
  const now      = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const { data: deadlineTasks, error: e1 } = await supabase
    .from('tasks')
    .select('*')
    .eq('type', 'deadline')
    .eq('status', 'pending')
    .lte('default_deadline', todayEnd)
    .eq('user_id', userId)
    .order('default_deadline', { ascending: true });
  if (e1) throw new Error(e1.message);

  const { data: recurringTasks, error: e2 } = await supabase
    .from('tasks')
    .select('*')
    .eq('type', 'recurring')
    .eq('status', 'pending')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (e2) throw new Error(e2.message);

  const parse = task => {
    if (task.recurrence_days) task.recurrence_days = JSON.parse(task.recurrence_days);
    return task;
  };

  return {
    deadline:  (deadlineTasks  || []).map(parse),
    recurring: (recurringTasks || []).map(parse),
  };
}

// ---------------------------------------------------------------------------
// User-accessible tasks (personal + group)
// ---------------------------------------------------------------------------

export async function getUserAccessibleTasks(userId, filters = {}) {
  // Personal tasks
  let personalQuery = supabase
    .from('tasks')
    .select('*, task_groups(name)')
    .eq('user_id', userId);

  // Group tasks the user is a member of
  let groupQuery = supabase
    .from('tasks')
    .select('*, task_groups(name), group_members!inner(user_id)')
    .eq('group_members.user_id', userId)
    .not('group_id', 'is', null);

  // Apply shared filters
  const applyFilters = q => {
    if (filters.type)   q = q.eq('type', filters.type);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.group_id !== undefined) {
      if (filters.group_id === null) q = q.is('group_id', null);
      else                           q = q.eq('group_id', filters.group_id);
    }
    return q;
  };

  personalQuery = applyFilters(personalQuery);
  groupQuery    = applyFilters(groupQuery);

  const [{ data: personal, error: e1 }, { data: group, error: e2 }] = await Promise.all([
    personalQuery.order('created_at', { ascending: false }),
    groupQuery.order('created_at',    { ascending: false }),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  // Merge + deduplicate by id
  const seen = new Set();
  return [...(personal || []), ...(group || [])]
    .filter(task => { if (seen.has(task.id)) return false; seen.add(task.id); return true; })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(task => {
      if (task.recurrence_days) task.recurrence_days = JSON.parse(task.recurrence_days);
      task.group_name = task.task_groups?.name || null;
      delete task.task_groups;
      delete task.group_members;
      return task;
    });
}

// ---------------------------------------------------------------------------
// Task Groups
// ---------------------------------------------------------------------------

export async function createTaskGroup(group) {
  const { data, error } = await supabase
    .from('task_groups')
    .insert({ name: group.name, owner_id: group.owner_id })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const groupId = data.id;
  await addGroupMember(groupId, group.owner_id, 'owner');
  return groupId;
}

export async function getTaskGroup(id) {
  const { data, error } = await supabase
    .from('task_groups')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getUserTaskGroups(userId) {
  const { data, error } = await supabase
    .from('task_groups')
    .select('*, group_members!inner(role, user_id)')
    .eq('group_members.user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(g => ({ ...g, role: g.group_members?.[0]?.role, group_members: undefined }));
}

export async function updateTaskGroup(id, updates) {
  const { error } = await supabase.from('task_groups').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTaskGroup(id) {
  const { error } = await supabase.from('task_groups').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Group Members
// ---------------------------------------------------------------------------

export async function addGroupMember(groupId, userId, role = 'member') {
  const { data, error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: userId, role })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function getGroupMembers(groupId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('*, users(username, display_name)')
    .eq('group_id', groupId)
    .order('role',     { ascending: false })
    .order('added_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map(m => ({
    ...m,
    username:     m.users?.username     || null,
    display_name: m.users?.display_name || null,
    users:        undefined,
  }));
}

export async function removeGroupMember(groupId, userId) {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function isUserInGroup(groupId, userId) {
  const { data, error } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

// Kept for backwards-compatibility (App.js calls this)
export function getDatabase() {
  return supabase;
}
