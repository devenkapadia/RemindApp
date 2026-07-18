# Personal Reminder App — PRD/TRD

## Problem
You forget tasks — especially multi-item ones (groceries) — and want reminder
urgency to scale with how close a deadline is. Different items within the same
task can have different deadlines (e.g. milk today, toothpaste this weekend).

## Data Model

```
Task
  id
  title
  type: "deadline" | "recurring" | "someday"
  default_deadline: datetime | null
  recurrence_rule: null | { freq: "daily"|"weekly", time: "09:00", days?: [...] }
  status: "pending" | "done" | "archived"
  created_at

ChecklistItem
  id
  task_id
  text
  done: bool
  deadline: datetime | null   // overrides task.default_deadline if set
```

A task with **zero checklist items** is just a single-action task (e.g. "finish
project") — no separate code path needed. Internally it behaves as a task with
one implicit item, so the same scheduling/escalation logic applies uniformly.

## Task Types & Lifecycle

| Type | Deadline? | Reminder behavior |
|---|---|---|
| **Deadline task** | Yes (task-level and/or per-item) | Escalating frequency as deadline approaches (see below) |
| **Recurring task** | No hard deadline, has a cadence (daily/weekly) | Fires once per cadence period until marked done for that period; resets next period |
| **Someday/no-deadline** | None | No scheduled reminders; shows in a backlog list, surfaced only if you open the app |

## Escalation Schedule (deadline tasks)

Computed per-item using `item.deadline ?? task.default_deadline`:

- `>24h` to deadline → 1x/day
- `2–24h` → every 2–3h
- `<2h` → every 30 min
- Overdue → every 15 min, capped (see caps below)

**Spam caps:** max 1 notification per 10 minutes across *all* tasks combined —
if multiple items are due at once, they get grouped into a single notification
instead of firing separately.

## Notification Grouping
All reminders belonging to the same parent task share a `threadIdentifier`
(iOS) / notification group (Android), so "Groceries" reminders stack as one
collapsible group rather than flooding the tray.

## Edge Cases Handled

- **Partial checklist completion** — task isn't "done" until all items are
  checked; you can also force-complete the whole task early.
- **Early completion** — marking an item/task done cancels its remaining
  scheduled notifications immediately.
- **Editing a deadline** — cancels old scheduled notifications for that
  item/task and re-schedules from scratch.
- **Deleting a task** — cancels all associated scheduled notifications.
- **App closed for days** — Expo's local notifications are OS-scheduled, so
  they still fire even if the app was never reopened; on next app open we
  reconcile any missed/overdue state.
- **Item deadline earlier than task creation time** — rejected at input with a
  validation message (can't schedule a reminder in the past).
- **Recurring task, cadence after completion** — marking it done today doesn't
  delete it; it just goes quiet until the next cadence period, then resets to
  pending.
- **Notification actions** — "Mark done" / "Snooze 1h" available directly on
  the notification (via `expo-notifications` categories), no need to open the
  app for quick tasks.
- **Timezone/DST** — deadlines stored as UTC timestamps, scheduling done in
  device-local time at schedule time to avoid drift.

## Tech Stack (TRD)

- **Framework:** React Native + Expo
- **Notifications:** `expo-notifications` (local scheduling, notification
  categories for actions, grouping)
- **Storage:** `expo-sqlite` (relational — task → checklist items)
- **No backend/server** — fully on-device for v1 (single user, single device)

## Out of Scope (v1)
- Multi-device sync
- Sharing tasks with others
- Calendar integration