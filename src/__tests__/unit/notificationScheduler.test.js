/**
 * Unit tests for the pure business logic in notificationScheduler.js
 *
 * We test `calculateNotificationTimes` indirectly via the exported functions,
 * but the key things to test are the interval thresholds.
 *
 * Because calculateNotificationTimes is not exported we test it through
 * the observable side-effect: how many notifications are scheduled.
 */

import * as Notifications from 'expo-notifications';
import { mockDb } from '../__mocks__/expo-sqlite';
import { initDatabase } from '../../database/db';
import {
  scheduleTaskNotifications,
  cancelTaskNotifications,
  scheduleRecurringTaskNotification,
  handleNotificationResponse,
} from '../../utils/notificationScheduler';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Helper to insert a task row directly into the mock DB
async function seedTask(overrides = {}) {
  const defaults = {
    id: 1,
    title: 'Test Task',
    type: 'deadline',
    default_deadline: new Date(Date.now() + 3 * HOUR).toISOString(),
    recurrence_freq: null,
    recurrence_time: null,
    recurrence_days: null,
    status: 'pending',
    user_id: 1,
    group_id: null,
    assigned_to: null,
  };
  const task = { ...defaults, ...overrides };
  mockDb._reset();
  // Seed via initDatabase then manually push
  await initDatabase();
  const { getTable } = require('../__mocks__/expo-sqlite');
  // Use the tables exposed via the module to seed directly
  mockDb.runAsync(`INSERT INTO tasks (title, type, default_deadline, recurrence_freq, recurrence_time, recurrence_days, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    task.title, task.type, task.default_deadline,
    task.recurrence_freq, task.recurrence_time, task.recurrence_days,
    task.status, task.user_id, task.group_id, task.assigned_to,
  ]);
  return task;
}

beforeEach(() => {
  mockDb._reset();
  jest.clearAllMocks();
});

describe('calculateNotificationTimes (via scheduleTaskNotifications)', () => {
  test('schedules notifications for a deadline ~3 hours away (<24h bracket)', async () => {
    await initDatabase();
    // Insert a task 3 hours from now
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Task A', 'deadline', new Date(Date.now() + 3 * HOUR).toISOString(), 'pending', 1, null, null]
    );

    await scheduleTaskNotifications(1);

    // 3h window → every ~2.5h → at least 1 notification + the deadline itself
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  test('schedules notifications for a deadline ~30 min away (<2h bracket)', async () => {
    await initDatabase();
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Task B', 'deadline', new Date(Date.now() + 30 * 60 * 1000).toISOString(), 'pending', 1, null, null]
    );

    await scheduleTaskNotifications(1);

    // 30 min window → 1 interval + deadline = at least 1 call
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  test('schedules daily notification for recurring task', async () => {
    await initDatabase();
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, recurrence_freq, recurrence_time, recurrence_days, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Daily Task', 'recurring', null, 'daily', '09:00', null, 'pending', 1, null, null]
    );
    // Also seed scheduled_notifications table for cancel step inside
    await scheduleRecurringTaskNotification(1);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ type: 'daily', hour: 9, minute: 0 }),
      })
    );
  });

  test('schedules weekly notification for each selected day', async () => {
    await initDatabase();
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, recurrence_freq, recurrence_time, recurrence_days, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Weekly Task', 'recurring', null, 'weekly', '10:00',
        JSON.stringify(['Mon', 'Wed']), 'pending', 1, null, null]
    );

    await scheduleRecurringTaskNotification(1);

    // Mon + Wed = 2 calls
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ type: 'weekly', weekday: 2 }), // Mon
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ type: 'weekly', weekday: 4 }), // Wed
      })
    );
  });

  test('does not schedule for past deadlines', async () => {
    await initDatabase();
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Old Task', 'deadline', new Date(Date.now() - HOUR).toISOString(), 'pending', 1, null, null]
    );

    await scheduleTaskNotifications(1);

    // Only the "at deadline" time fires, but it's in the past so filtered out
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('does not schedule for non-deadline task type', async () => {
    await initDatabase();
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Someday', 'someday', null, 'pending', 1, null, null]
    );

    await scheduleTaskNotifications(1);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelTaskNotifications', () => {
  test('cancels all scheduled notifications for a task', async () => {
    await initDatabase();
    // Seed a scheduled notification record
    await mockDb.runAsync(
      `INSERT INTO scheduled_notifications (task_id, checklist_item_id, expo_notification_id, fire_at) VALUES (?, ?, ?, ?)`,
      [1, null, 'notif-abc', new Date().toISOString()]
    );

    await cancelTaskNotifications(1);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-abc');
  });
});

describe('handleNotificationResponse', () => {
  test('marks task done on mark-done action', async () => {
    await initDatabase();
    await mockDb.runAsync(
      `INSERT INTO tasks (title, type, default_deadline, status, user_id, group_id, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Task', 'deadline', new Date(Date.now() + HOUR).toISOString(), 'pending', 1, null, null]
    );

    const response = {
      actionIdentifier: 'mark-done',
      notification: {
        request: { content: { data: { taskId: 1, checklistItemId: null } } },
      },
    };

    await handleNotificationResponse(response);

    const rows = await mockDb.getAllAsync('SELECT * FROM tasks WHERE id = ?', [1]);
    expect(rows[0]?.status).toBe('done');
  });

  test('snoozes notification by 1 hour on snooze action', async () => {
    const before = Date.now();
    const response = {
      actionIdentifier: 'snooze',
      notification: {
        request: {
          content: {
            title: 'Task',
            body: 'body',
            data: { taskId: 1, checklistItemId: null },
          },
        },
      },
    };

    await handleNotificationResponse(response);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({
          date: expect.any(Date),
        }),
      })
    );
    const call = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    const snoozedAt = call.trigger.date.getTime();
    expect(snoozedAt).toBeGreaterThanOrEqual(before + HOUR - 100);
    expect(snoozedAt).toBeLessThanOrEqual(before + HOUR + 5000);
  });
});
