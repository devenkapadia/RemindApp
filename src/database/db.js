import * as SQLite from 'expo-sqlite';

let db = null;

export async function initDatabase() {
  try {
    db = await SQLite.openDatabaseAsync('remindapp.db');
    
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS task_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('deadline','recurring','someday')),
        default_deadline TEXT,
        recurrence_freq TEXT,
        recurrence_time TEXT,
        recurrence_days TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','archived')),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_id INTEGER REFERENCES task_groups(id) ON DELETE CASCADE,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS checklist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        deadline TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS scheduled_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        checklist_item_id INTEGER REFERENCES checklist_items(id) ON DELETE CASCADE,
        expo_notification_id TEXT NOT NULL,
        fire_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_checklist_task ON checklist_items(task_id);
      CREATE INDEX IF NOT EXISTS idx_notif_task ON scheduled_notifications(task_id);
    `);

    // Migrations — safely add columns that may not exist in older installs
    await runMigrations();

    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

async function runMigrations() {
  // Add assigned_to to tasks if missing
  const cols = await db.getAllAsync(`PRAGMA table_info(tasks)`);
  const hasAssignedTo = cols.some(c => c.name === 'assigned_to');
  if (!hasAssignedTo) {
    await db.execAsync(
      `ALTER TABLE tasks ADD COLUMN assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL`
    );
    console.log('Migration: added assigned_to column to tasks');
  }
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// Task CRUD operations
export async function createTask(task) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO tasks (title, type, default_deadline, recurrence_freq, recurrence_time, recurrence_days, status, user_id, group_id, assigned_to)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      task.title,
      task.type,
      task.default_deadline || null,
      task.recurrence_freq || null,
      task.recurrence_time || null,
      task.recurrence_days ? JSON.stringify(task.recurrence_days) : null,
      task.status || 'pending',
      task.user_id,
      task.group_id || null,
      task.assigned_to || null
    ]
  );
  return result.lastInsertRowId;
}

export async function getTask(id) {
  const db = getDatabase();
  const result = await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', [id]);
  if (result && result.recurrence_days) {
    result.recurrence_days = JSON.parse(result.recurrence_days);
  }
  return result;
}

export async function getAllTasks(filters = {}) {
  const db = getDatabase();
  let query = `
    SELECT t.*, u.username as assigned_to_username, u.display_name as assigned_to_display_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE 1=1`;
  const params = [];
  
  if (filters.user_id) {
    query += ' AND t.user_id = ?';
    params.push(filters.user_id);
  }
  
  if (filters.group_id !== undefined) {
    if (filters.group_id === null) {
      query += ' AND t.group_id IS NULL';
    } else {
      query += ' AND t.group_id = ?';
      params.push(filters.group_id);
    }
  }
  
  if (filters.type) {
    query += ' AND t.type = ?';
    params.push(filters.type);
  }
  
  if (filters.status) {
    query += ' AND t.status = ?';
    params.push(filters.status);
  }
  
  query += ' ORDER BY t.created_at DESC';
  
  const results = await db.getAllAsync(query, params);
  return results.map(task => {
    if (task.recurrence_days) {
      task.recurrence_days = JSON.parse(task.recurrence_days);
    }
    return task;
  });
}

export async function updateTask(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    if (key === 'recurrence_days' && updates[key]) {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(updates[key]));
    } else {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });
  
  values.push(id);
  
  await db.runAsync(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTask(id) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [id]);
}

// Checklist item CRUD operations
export async function createChecklistItem(item) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO checklist_items (task_id, text, done, deadline, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [
      item.task_id,
      item.text,
      item.done ? 1 : 0,
      item.deadline || null,
      item.sort_order || 0
    ]
  );
  return result.lastInsertRowId;
}

export async function getChecklistItems(taskId) {
  const db = getDatabase();
  const results = await db.getAllAsync(
    'SELECT * FROM checklist_items WHERE task_id = ? ORDER BY sort_order, id',
    [taskId]
  );
  return results.map(item => ({
    ...item,
    done: item.done === 1
  }));
}

export async function updateChecklistItem(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    if (key === 'done') {
      fields.push(`${key} = ?`);
      values.push(updates[key] ? 1 : 0);
    } else {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });
  
  values.push(id);
  
  await db.runAsync(
    `UPDATE checklist_items SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteChecklistItem(id) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM checklist_items WHERE id = ?', [id]);
}

// Scheduled notification operations
export async function createScheduledNotification(notification) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO scheduled_notifications (task_id, checklist_item_id, expo_notification_id, fire_at)
     VALUES (?, ?, ?, ?)`,
    [
      notification.task_id,
      notification.checklist_item_id || null,
      notification.expo_notification_id,
      notification.fire_at
    ]
  );
  return result.lastInsertRowId;
}

export async function getScheduledNotifications(taskId, checklistItemId = null) {
  const db = getDatabase();
  let query = 'SELECT * FROM scheduled_notifications WHERE task_id = ?';
  const params = [taskId];
  
  if (checklistItemId !== null) {
    query += ' AND checklist_item_id = ?';
    params.push(checklistItemId);
  }
  
  return await db.getAllAsync(query, params);
}

export async function deleteScheduledNotifications(taskId, checklistItemId = null) {
  const db = getDatabase();
  let query = 'DELETE FROM scheduled_notifications WHERE task_id = ?';
  const params = [taskId];
  
  if (checklistItemId !== null) {
    query += ' AND checklist_item_id = ?';
    params.push(checklistItemId);
  }
  
  await db.runAsync(query, params);
}

export async function deleteScheduledNotification(id) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM scheduled_notifications WHERE id = ?', [id]);
}

// Helper function to get tasks with their checklist items (+ assignee display name)
export async function getTaskWithItems(taskId) {
  const db = getDatabase();
  const task = await db.getFirstAsync(
    `SELECT t.*, u.username as assigned_to_username, u.display_name as assigned_to_display_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE t.id = ?`,
    [taskId]
  );
  if (!task) return null;
  if (task.recurrence_days) task.recurrence_days = JSON.parse(task.recurrence_days);

  const items = await getChecklistItems(taskId);
  return { ...task, items };
}

// Get today's tasks (deadline and recurring)
export async function getTodayTasks(userId) {
  const db = getDatabase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  
  // Get deadline tasks due today or overdue
  const deadlineTasks = await db.getAllAsync(
    `SELECT * FROM tasks
     WHERE type = 'deadline'
     AND status = 'pending'
     AND default_deadline <= ?
     AND user_id = ?
     ORDER BY default_deadline ASC`,
    [todayEnd, userId]
  );
  
  // Get recurring tasks that are pending
  const recurringTasks = await db.getAllAsync(
    `SELECT * FROM tasks
     WHERE type = 'recurring'
     AND status = 'pending'
     AND user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  
  return {
    deadline: deadlineTasks.map(task => {
      if (task.recurrence_days) {
        task.recurrence_days = JSON.parse(task.recurrence_days);
      }
      return task;
    }),
    recurring: recurringTasks.map(task => {
      if (task.recurrence_days) {
        task.recurrence_days = JSON.parse(task.recurrence_days);
      }
      return task;
    })
  };
}

// Get tasks accessible by user (personal + group tasks)
export async function getUserAccessibleTasks(userId, filters = {}) {
  const db = getDatabase();
  let query = `
    SELECT DISTINCT t.*, tg.name as group_name
    FROM tasks t
    LEFT JOIN task_groups tg ON t.group_id = tg.id
    LEFT JOIN group_members gm ON t.group_id = gm.group_id
    WHERE (t.user_id = ? OR gm.user_id = ?)
  `;
  const params = [userId, userId];
  
  if (filters.type) {
    query += ' AND t.type = ?';
    params.push(filters.type);
  }
  
  if (filters.status) {
    query += ' AND t.status = ?';
    params.push(filters.status);
  }
  
  if (filters.group_id !== undefined) {
    if (filters.group_id === null) {
      query += ' AND t.group_id IS NULL';
    } else {
      query += ' AND t.group_id = ?';
      params.push(filters.group_id);
    }
  }
  
  query += ' ORDER BY t.created_at DESC';
  
  const results = await db.getAllAsync(query, params);
  return results.map(task => {
    if (task.recurrence_days) {
      task.recurrence_days = JSON.parse(task.recurrence_days);
    }
    return task;
  });
}

// Made with Bob


// User CRUD operations
export async function createUser(user) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO users (username, password, display_name)
     VALUES (?, ?, ?)`,
    [user.username, user.password, user.display_name || null]
  );
  return result.lastInsertRowId;
}

export async function getUser(id) {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM users WHERE id = ?', [id]);
}

export async function getUserByUsername(username) {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM users WHERE username = ?', [username]);
}

export async function updateUser(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  });
  
  values.push(id);
  
  await db.runAsync(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// Task Group CRUD operations
export async function createTaskGroup(group) {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO task_groups (name, owner_id)
     VALUES (?, ?)`,
    [group.name, group.owner_id]
  );
  const groupId = result.lastInsertRowId;
  
  // Add owner as a member
  await db.runAsync(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES (?, ?, 'owner')`,
    [groupId, group.owner_id]
  );
  
  return groupId;
}

export async function getTaskGroup(id) {
  const db = getDatabase();
  return await db.getFirstAsync('SELECT * FROM task_groups WHERE id = ?', [id]);
}

export async function getUserTaskGroups(userId) {
  const db = getDatabase();
  return await db.getAllAsync(
    `SELECT tg.*, gm.role 
     FROM task_groups tg
     JOIN group_members gm ON tg.id = gm.group_id
     WHERE gm.user_id = ?
     ORDER BY tg.created_at DESC`,
    [userId]
  );
}

export async function updateTaskGroup(id, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];
  
  Object.keys(updates).forEach(key => {
    fields.push(`${key} = ?`);
    values.push(updates[key]);
  });
  
  values.push(id);
  
  await db.runAsync(
    `UPDATE task_groups SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteTaskGroup(id) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM task_groups WHERE id = ?', [id]);
}

// Group Member operations
export async function addGroupMember(groupId, userId, role = 'member') {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO group_members (group_id, user_id, role)
     VALUES (?, ?, ?)`,
    [groupId, userId, role]
  );
  return result.lastInsertRowId;
}

export async function getGroupMembers(groupId) {
  const db = getDatabase();
  return await db.getAllAsync(
    `SELECT gm.*, u.username, u.display_name
     FROM group_members gm
     JOIN users u ON gm.user_id = u.id
     WHERE gm.group_id = ?
     ORDER BY gm.role DESC, gm.added_at ASC`,
    [groupId]
  );
}

export async function removeGroupMember(groupId, userId) {
  const db = getDatabase();
  await db.runAsync(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
}

export async function isUserInGroup(groupId, userId) {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  return !!result;
}
