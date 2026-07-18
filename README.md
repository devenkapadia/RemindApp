# RemindApp - Personal Reminder Application

A React Native + Expo reminder app with escalating notifications, checklist support, and recurring tasks.

## Features

- **Deadline Tasks**: Tasks with specific deadlines and escalating reminder frequency
  - >24h to deadline → 1x/day
  - 2–24h → every 2–3h
  - <2h → every 30 min
  - Overdue → every 15 min

- **Recurring Tasks**: Daily or weekly tasks with customizable reminder times
  - Daily reminders at a specific time
  - Weekly reminders on selected days

- **Someday/Backlog**: Tasks without deadlines for future planning

- **Checklist Support**: Break down tasks into multiple items, each with optional individual deadlines

- **Notification Actions**: Mark tasks done or snooze directly from notifications without opening the app

- **Grouped Notifications**: All reminders for the same task are grouped together to avoid notification spam

## Tech Stack

- **Framework**: React Native + Expo (managed workflow)
- **Notifications**: expo-notifications (local scheduling with categories and grouping)
- **Storage**: expo-sqlite (local relational database)
- **Navigation**: @react-navigation/native (bottom tabs + stack)

## Project Structure

```
remind-app/
├── App.js                          # Main app entry point
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── src/
│   ├── database/
│   │   └── db.js                   # SQLite database setup and CRUD operations
│   ├── navigation/
│   │   └── AppNavigator.js         # Navigation structure (tabs + stack)
│   ├── screens/
│   │   ├── TodayScreen.js          # Home screen showing today's tasks
│   │   ├── AllTasksScreen.js       # All tasks with filters
│   │   ├── SomedayScreen.js        # Backlog tasks without deadlines
│   │   ├── TaskDetailScreen.js     # Task details with checklist
│   │   └── AddEditTaskScreen.js    # Create/edit task form
│   └── utils/
│       └── notificationScheduler.js # Notification scheduling logic
└── assets/                         # App icons and images
```

## Database Schema

### Tasks Table
- `id`: Primary key
- `title`: Task title
- `type`: 'deadline' | 'recurring' | 'someday'
- `default_deadline`: ISO datetime (nullable)
- `recurrence_freq`: 'daily' | 'weekly' (nullable)
- `recurrence_time`: 'HH:MM' (nullable)
- `recurrence_days`: JSON array for weekly (nullable)
- `status`: 'pending' | 'done' | 'archived'
- `created_at`: Timestamp

### Checklist Items Table
- `id`: Primary key
- `task_id`: Foreign key to tasks
- `text`: Item text
- `done`: Boolean (0/1)
- `deadline`: ISO datetime (nullable, overrides task deadline)
- `sort_order`: Integer for ordering

### Scheduled Notifications Table
- `id`: Primary key
- `task_id`: Foreign key to tasks
- `checklist_item_id`: Foreign key to checklist_items (nullable)
- `expo_notification_id`: Expo notification ID for cancellation
- `fire_at`: ISO datetime

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on your device:
   - Install Expo Go app on your phone
   - Scan the QR code from the terminal
   - Or press `a` for Android emulator, `i` for iOS simulator

## Building for Production

To create a standalone APK/IPA:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
```

## Usage

### Creating a Deadline Task
1. Tap the "+" button in the header
2. Enter task title
3. Select "Deadline" type
4. Set the deadline date and time
5. Optionally add checklist items
6. Tap "Create Task"

### Creating a Recurring Task
1. Tap the "+" button
2. Enter task title
3. Select "Recurring" type
4. Choose frequency (Daily or Weekly)
5. Set the reminder time
6. For weekly, select days of the week
7. Tap "Create Task"

### Creating a Someday Task
1. Tap the "+" button
2. Enter task title
3. Select "Someday" type
4. Optionally add checklist items
5. Tap "Create Task"
6. Later, you can promote it to a deadline task from the Someday screen

### Managing Tasks
- **Today Screen**: View tasks due today, organized by urgency (Overdue, Due Soon, Due Today, Recurring)
- **All Tasks Screen**: Browse all tasks with filters and search
- **Someday Screen**: View backlog tasks and promote them when ready
- **Task Detail**: View full task details, check off items, mark all done, or delete

### Notification Actions
When you receive a notification:
- **Mark Done**: Marks the task/item as complete and cancels remaining notifications
- **Snooze 1h**: Delays the notification by 1 hour

## Key Features Implementation

### Escalating Notifications
The app calculates notification times based on how close the deadline is:
- Far away: Less frequent reminders
- Getting closer: More frequent reminders
- Very close/overdue: Very frequent reminders

### Notification Grouping
All notifications for the same task use the same `threadIdentifier`, so they appear grouped in the notification tray instead of cluttering it.

### Per-Item Deadlines
Each checklist item can have its own deadline that overrides the task's default deadline, allowing for complex multi-deadline tasks (e.g., grocery shopping where milk is needed today but toothpaste can wait until the weekend).

### Recurring Task Logic
Recurring tasks fire notifications at the specified time(s) and reset when marked done, ready to remind you again in the next period.

## Limitations (v1)

- Single device only (no cloud sync)
- No sharing/collaboration features
- No calendar integration
- No quiet hours (notifications can fire at any time based on escalation)

## Future Enhancements

Potential features for future versions:
- Multi-device sync via cloud backend
- Quiet hours configuration
- Calendar integration
- Task sharing and collaboration
- Subtasks and nested checklists
- Task templates
- Statistics and completion tracking
- Dark mode
- Widgets

## Troubleshooting

### Notifications not appearing
1. Check notification permissions in device settings
2. Ensure the app has permission to schedule exact alarms (Android 12+)
3. Check that the deadline is in the future
4. Verify the task type is "deadline" or "recurring"

### Database errors
If you encounter database errors, you may need to reset the database:
1. Uninstall the app
2. Reinstall and restart

### Build errors
Make sure all dependencies are installed:
```bash
npm install
```

Clear cache if needed:
```bash
expo start -c
```

## License

This project is for personal use.

## Contributing

This is a personal project, but suggestions and feedback are welcome!