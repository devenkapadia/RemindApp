# Personal Reminder App — Implementation Plan

## 1. PRD (Product Requirements)

**Problem:** Tasks get forgotten, especially multi-item ones (groceries), and
reminders don't currently escalate as deadlines approach. Different items
within one task can have different deadlines.

**Users:** Just you, single device, no accounts/login.

**Core features:**
- Deadline tasks with escalating reminder frequency
- Recurring tasks (daily/weekly cadence, no hard deadline)
- Someday/no-deadline backlog
- Checklist items per task, each with an optional own deadline
- Notification actions: mark done / snooze, without opening the app
- Grouped notifications per task to avoid tray spam

**Out of scope (v1):** multi-device sync, sharing, calendar integration, accounts.

---

## 2. TRD (Technical Requirements)

- **Framework:** React Native + Expo (managed workflow)
- **Notifications:** `expo-notifications` — local scheduling, categories for
  actions, `threadIdentifier`/channel grouping
- **Storage:** `expo-sqlite` — relational local DB
- **Navigation:** `@react-navigation/native` (bottom tabs + stack)
- **No backend server** — fully on-device
- **Build/test:** Expo Go during dev, EAS Build for an installable APK later

---

## 3. Database Schema (local SQLite)

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deadline','recurring','someday')),
  default_deadline TEXT,              -- ISO datetime, nullable
  recurrence_freq TEXT,               -- 'daily' | 'weekly', nullable
  recurrence_time TEXT,               -- 'HH:MM', nullable
  recurrence_days TEXT,               -- JSON array for weekly, nullable
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,     -- 0/1
  deadline TEXT,                       -- ISO datetime, nullable, overrides task default
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scheduled_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  checklist_item_id INTEGER REFERENCES checklist_items(id) ON DELETE CASCADE,
  expo_notification_id TEXT NOT NULL,  -- id returned by expo-notifications, needed to cancel
  fire_at TEXT NOT NULL
);

CREATE INDEX idx_checklist_task ON checklist_items(task_id);
CREATE INDEX idx_notif_task ON scheduled_notifications(task_id);
```

`scheduled_notifications` exists so that editing/deleting a task or item can
look up and cancel exactly the right OS-level notifications instead of
guessing.

---

## 4. UI/UX Design

**Navigation:** bottom tab bar with 3 tabs + a floating "+" add button.

```
[ Today ]   [ All Tasks ]   [ Someday ]
```

### Today screen (home)
- Sections, top to bottom: **Overdue** (red) → **Due soon** (orange, <2h) →
  **Due today** (default) → **Recurring — today's nudge**
- Each row: task title, deadline time (or "recurring"), checklist progress
  badge if applicable (e.g. "3/6")
- Tap row → Task Detail. Swipe → quick mark-done.

### All Tasks screen
- Full list, filterable by type (deadline / recurring / someday) and status
- Search bar at top

### Someday screen
- Backlog of no-deadline tasks, no reminders, manual promote-to-deadline
  action available from here

### Add/Edit Task screen
- Title input
- Type selector: Deadline / Recurring / Someday (segmented control)
- If Deadline: date+time picker for default deadline
- If Recurring: frequency (daily/weekly) + time + days-of-week if weekly
- Checklist section: add items inline, each item has an optional "set own
  deadline" toggle → reveals a date+time picker for that item only
- Save button

### Task Detail screen
- Title, deadline info, edit button
- Checklist with checkboxes; tapping an item's deadline chip lets you edit it
- "Mark all done" / "Delete task" actions

### Settings screen
- Notification permission status
- Quiet hours (optional, e.g. no notifications 11pm–7am even if escalation
  says otherwise) — recommended addition, confirm if you want this in v1

---

## 5. App Flow (key user journeys)

**Journey A — Add a deadline task with checklist**
1. Tap "+" → Add/Edit screen → select "Deadline"
2. Enter title "Groceries", set default deadline (e.g. today 6pm)
3. Add items: Milk, Eggs, Bread, Toothpaste (leave default deadline),
   set Toothpaste's own deadline to Saturday
4. Save → app computes escalation schedule per item using
   `item.deadline ?? task.default_deadline`, writes rows to
   `scheduled_notifications`, calls `expo-notifications` to schedule each

**Journey B — Receive and act on a notification**
1. OS fires grouped notification "Groceries: Milk due today"
2. User taps "Mark done" action directly on the notification
3. App (via background notification handler) updates `checklist_items.done`,
   cancels remaining scheduled notifications for that item

**Journey C — Add a recurring task**
1. "+" → select "Recurring" → title "Take vitamins" → daily @ 9am
2. Saved with `recurrence_freq='daily'`; a rolling job (checked on app open
   and via a daily scheduled notification) creates "today's" reminder

**Journey D — Edit a deadline**
1. Open Task Detail → edit deadline
2. App looks up `scheduled_notifications` rows for that task/item, cancels
   them via `expo-notifications.cancelScheduledNotificationAsync`, deletes
   the rows, recomputes and reschedules

**Journey E — Someday task promoted to deadline**
1. From Someday tab, tap "Set deadline" on a task
2. Type changes to 'deadline', deadline picker shown, schedule computed as
   in Journey A

---

## 6. Step-by-Step Implementation Plan

**Phase 0 — Project setup**
- `npx create-expo-app`, install `expo-notifications`, `expo-sqlite`,
  `@react-navigation/native` + stack/tabs, `expo-dev-client` if needed
- Request notification permissions on first launch

**Phase 1 — Data layer**
- Create SQLite schema (above), write a small data-access module
  (CRUD for tasks, checklist_items, scheduled_notifications)

**Phase 2 — Core UI shell**
- Bottom tab navigation, Today/All/Someday screens with static/mock data
  first to validate layout

**Phase 3 — Add/Edit Task flow**
- Build the Add/Edit screen, wire to data layer, support checklist items
  with per-item deadline toggle

**Phase 4 — Notification scheduling engine**
- Function: given a task/item deadline, compute the list of fire times per
  the escalation tiers
- Schedule via `expo-notifications`, store returned ids in
  `scheduled_notifications`
- Implement cancel-and-reschedule on edit/delete/complete

**Phase 5 — Notification actions & grouping**
- Define notification categories (Mark Done / Snooze 1h)
- Handle action responses in a background listener, update DB accordingly
- Set `threadIdentifier`/channel per task for grouping

**Phase 6 — Recurring task logic**
- Daily reset job (runs on app foreground + a daily anchor notification)
  to re-surface recurring tasks

**Phase 7 — Someday backlog + polish**
- Someday screen, promote-to-deadline action
- Empty states, basic theming

**Phase 8 — Test on real device + build**
- Test escalation timing and notification actions on a real phone
  (simulator notification behavior is unreliable)
- EAS Build for a standalone installable APK once stable

---

## Open question
Do you want **quiet hours** (e.g. no notifications overnight regardless of
escalation tier) in v1, or is always-on escalation fine for now?