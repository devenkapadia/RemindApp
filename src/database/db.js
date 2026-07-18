import * as SQLite from 'expo-sqlite';

let db = null;

export async function initDatabase() {
  try {
    db = await SQLite.openDatabaseAsync('remindapp.db');
    
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');
    
    // Create tables
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('deadline','recurring','someday')),
        default_deadline TEXT,
        recurrence_freq TEXT,
        recurrence_time TEXT,
        recurrence_days TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','archived')),
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

      CREATE INDEX IF NOT EXISTS idx_checklist_task ON checklist_items(task_id);
      CREATE INDEX IF NOT EXISTS idx_notif_task ON scheduled_notifications(task_id);
    `);
    
    console.log('Database initialized successfully');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
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
    `INSERT INTO tasks (title, type, default_deadline, recurrence_freq, recurrence_time, recurrence_days, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      task.title,
      task.type,
      task.default_deadline || null,
      task.recurrence_freq || null,
      task.recurrence_time || null,
      task.recurrence_days ? JSON.stringify(task.recurrence_days) : null,
      task.status || 'pending'
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
  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  
  if (filters.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  
  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  
  query += ' ORDER BY created_at DESC';
  
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

// Helper function to get tasks with their checklist items
export async function getTaskWithItems(taskId) {
  const task = await getTask(taskId);
  if (!task) return null;
  
  const items = await getChecklistItems(taskId);
  return {
    ...task,
    items
  };
}

// Get today's tasks (deadline and recurring)
export async function getTodayTasks() {
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
     ORDER BY default_deadline ASC`,
    [todayEnd]
  );
  
  // Get recurring tasks that are pending
  const recurringTasks = await db.getAllAsync(
    `SELECT * FROM tasks 
     WHERE type = 'recurring' 
     AND status = 'pending'
     ORDER BY created_at DESC`
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

// Made with Bob
