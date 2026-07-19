import * as Notifications from 'expo-notifications';
import {
  getTaskWithItems,
  createScheduledNotification,
  getScheduledNotifications,
  deleteScheduledNotifications,
} from '../database/db';

// Escalation schedule based on PRD
// >24h to deadline → 1x/day
// 2–24h → every 2–3h
// <2h → every 30 min
// Overdue → every 15 min

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Calculate notification times for a given deadline
 * Returns array of Date objects when notifications should fire
 */
function calculateNotificationTimes(deadline) {
  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();
  const times = [];

  // Don't schedule notifications for past deadlines
  if (deadlineTime < now) {
    return times;
  }

  const timeUntilDeadline = deadlineTime - now;

  // More than 24 hours away: 1x per day
  if (timeUntilDeadline > DAY) {
    const daysAway = Math.floor(timeUntilDeadline / DAY);
    for (let i = daysAway; i > 1; i--) {
      times.push(new Date(deadlineTime - i * DAY));
    }
    // Add one notification 24h before
    times.push(new Date(deadlineTime - DAY));
  }

  // 2-24 hours away: every 2-3 hours
  if (timeUntilDeadline <= DAY && timeUntilDeadline > 2 * HOUR) {
    const hoursAway = Math.floor(timeUntilDeadline / HOUR);
    for (let i = hoursAway; i > 2; i -= 2.5) {
      times.push(new Date(deadlineTime - i * HOUR));
    }
  }

  // Less than 2 hours: every 30 minutes
  if (timeUntilDeadline <= 2 * HOUR && timeUntilDeadline > 0) {
    const intervalsAway = Math.floor(timeUntilDeadline / (30 * MINUTE));
    for (let i = intervalsAway; i > 0; i--) {
      times.push(new Date(deadlineTime - i * 30 * MINUTE));
    }
  }

  // At deadline
  times.push(new Date(deadlineTime));

  // Filter out times in the past
  return times.filter(time => time.getTime() > now);
}

/**
 * Schedule notifications for a task and its checklist items
 */
export async function scheduleTaskNotifications(taskId) {
  try {
    const task = await getTaskWithItems(taskId);
    if (!task) {
      console.error('Task not found:', taskId);
      return;
    }

    // Only schedule for deadline tasks
    if (task.type !== 'deadline') {
      return;
    }

    // Define notification category with actions
    await Notifications.setNotificationCategoryAsync('task-reminder', [
      {
        identifier: 'mark-done',
        buttonTitle: 'Mark Done',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze 1h',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    const scheduledNotifications = [];

    // If task has checklist items, schedule per item
    if (task.items && task.items.length > 0) {
      for (const item of task.items) {
        if (item.done) continue; // Skip completed items

        const itemDeadline = item.deadline || task.default_deadline;
        if (!itemDeadline) continue;

        const notificationTimes = calculateNotificationTimes(itemDeadline);

        for (const fireTime of notificationTimes) {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: task.title,
              body: `${item.text} - due ${formatDeadlineForNotification(itemDeadline)}`,
              data: {
                taskId: task.id,
                checklistItemId: item.id,
                type: 'deadline',
              },
              categoryIdentifier: 'task-reminder',
              // Use task ID as thread identifier for grouping
              threadIdentifier: `task-${task.id}`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: fireTime,
            },
          });

          scheduledNotifications.push({
            task_id: task.id,
            checklist_item_id: item.id,
            expo_notification_id: notificationId,
            fire_at: fireTime.toISOString(),
          });
        }
      }
    } else {
      // No checklist items, schedule for the task itself
      if (task.default_deadline) {
        const notificationTimes = calculateNotificationTimes(task.default_deadline);

        for (const fireTime of notificationTimes) {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: task.title,
              body: `Due ${formatDeadlineForNotification(task.default_deadline)}`,
              data: {
                taskId: task.id,
                checklistItemId: null,
                type: 'deadline',
              },
              categoryIdentifier: 'task-reminder',
              threadIdentifier: `task-${task.id}`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: fireTime,
            },
          });

          scheduledNotifications.push({
            task_id: task.id,
            checklist_item_id: null,
            expo_notification_id: notificationId,
            fire_at: fireTime.toISOString(),
          });
        }
      }
    }

    // Save scheduled notifications to database
    for (const notification of scheduledNotifications) {
      await createScheduledNotification(notification);
    }

    console.log(`Scheduled ${scheduledNotifications.length} notifications for task ${taskId}`);
  } catch (error) {
    console.error('Error scheduling task notifications:', error);
    throw error;
  }
}

/**
 * Cancel all notifications for a task
 */
export async function cancelTaskNotifications(taskId, checklistItemId = null) {
  try {
    const notifications = await getScheduledNotifications(taskId, checklistItemId);

    for (const notification of notifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.expo_notification_id);
    }

    await deleteScheduledNotifications(taskId, checklistItemId);

    console.log(`Cancelled ${notifications.length} notifications for task ${taskId}`);
  } catch (error) {
    console.error('Error cancelling task notifications:', error);
    throw error;
  }
}

/**
 * Schedule a recurring task notification
 */
export async function scheduleRecurringTaskNotification(taskId) {
  try {
    const task = await getTaskWithItems(taskId);
    if (!task || task.type !== 'recurring') {
      return;
    }

    // Cancel existing notifications first
    await cancelTaskNotifications(taskId);

    const [hours, minutes] = task.recurrence_time.split(':').map(Number);

    if (task.recurrence_freq === 'daily') {
      // Schedule daily notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: task.title,
          body: 'Daily reminder',
          data: {
            taskId: task.id,
            type: 'recurring',
          },
          categoryIdentifier: 'task-reminder',
          threadIdentifier: `task-${task.id}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });

      await createScheduledNotification({
        task_id: task.id,
        checklist_item_id: null,
        expo_notification_id: notificationId,
        fire_at: new Date().toISOString(), // Placeholder
      });
    } else if (task.recurrence_freq === 'weekly' && task.recurrence_days) {
      // Schedule weekly notifications for each selected day
      const dayMap = {
        'Sun': 1,
        'Mon': 2,
        'Tue': 3,
        'Wed': 4,
        'Thu': 5,
        'Fri': 6,
        'Sat': 7,
      };

      for (const day of task.recurrence_days) {
        const weekday = dayMap[day];
        if (weekday) {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: task.title,
              body: `Weekly reminder - ${day}`,
              data: {
                taskId: task.id,
                type: 'recurring',
              },
              categoryIdentifier: 'task-reminder',
              threadIdentifier: `task-${task.id}`,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: weekday,
              hour: hours,
              minute: minutes,
              repeats: true,
            },
          });

          await createScheduledNotification({
            task_id: task.id,
            checklist_item_id: null,
            expo_notification_id: notificationId,
            fire_at: new Date().toISOString(), // Placeholder
          });
        }
      }
    }

    console.log(`Scheduled recurring notifications for task ${taskId}`);
  } catch (error) {
    console.error('Error scheduling recurring task notification:', error);
    throw error;
  }
}

/**
 * Format deadline for notification body
 */
function formatDeadlineForNotification(deadline) {
  const date = new Date(deadline);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) {
    return 'overdue';
  } else if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

/**
 * Handle notification response (when user taps action button)
 */
export async function handleNotificationResponse(response) {
  const { notification, actionIdentifier } = response;
  const { taskId, checklistItemId } = notification.request.content.data;

  if (actionIdentifier === 'mark-done') {
    // Mark task or checklist item as done
    if (checklistItemId) {
      const { updateChecklistItem } = require('../database/db');
      await updateChecklistItem(checklistItemId, { done: true });
      await cancelTaskNotifications(taskId, checklistItemId);
    } else {
      const { updateTask } = require('../database/db');
      await updateTask(taskId, { status: 'done' });
      await cancelTaskNotifications(taskId);
    }
  } else if (actionIdentifier === 'snooze') {
    // Snooze for 1 hour
    const snoozeTime = new Date(Date.now() + HOUR);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notification.request.content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: snoozeTime,
      },
    });

    await createScheduledNotification({
      task_id: taskId,
      checklist_item_id: checklistItemId || null,
      expo_notification_id: notificationId,
      fire_at: snoozeTime.toISOString(),
    });
  }
}

// Made with Bob
