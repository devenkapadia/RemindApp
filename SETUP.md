# RemindApp Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- For iOS: macOS with Xcode
- For Android: Android Studio with Android SDK

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Add Asset Images

Before running the app, you need to add the following image files to the `assets/` directory:

- `icon.png` (1024x1024) - Main app icon
- `splash.png` (1284x2778) - Splash screen image
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `favicon.png` (48x48) - Web favicon
- `notification-icon.png` (96x96) - Notification icon (white on transparent)

You can use placeholder images initially or create your own. For quick testing, you can generate simple colored squares using any image editor.

### 3. Start Development Server

```bash
npm start
```

This will start the Expo development server and show a QR code.

### 4. Run on Device/Emulator

**Option A: Physical Device (Recommended for testing notifications)**
1. Install "Expo Go" app from App Store (iOS) or Play Store (Android)
2. Scan the QR code from the terminal
3. The app will load on your device

**Option B: iOS Simulator (macOS only)**
```bash
npm run ios
```

**Option C: Android Emulator**
```bash
npm run android
```

## Testing Notifications

⚠️ **Important**: Notifications work best on physical devices. Simulators/emulators have limited notification support.

### On Physical Device:
1. Grant notification permissions when prompted
2. Create a deadline task with a deadline in the near future (e.g., 5 minutes from now)
3. Lock your device or put the app in background
4. Wait for the notification to appear
5. Test the "Mark Done" and "Snooze" actions directly from the notification

### Notification Permissions:
- **iOS**: Permissions are requested on first launch
- **Android**: Permissions are requested on first launch. On Android 12+, you may need to grant "Alarms & reminders" permission in settings

## Database

The app uses SQLite for local storage. The database file is created automatically on first launch at:
- iOS: `~/Library/Application Support/Expo/remindapp.db`
- Android: `/data/data/com.remindapp/databases/remindapp.db`

To reset the database during development:
1. Uninstall the app
2. Reinstall and restart

## Troubleshooting

### "Module not found" errors
```bash
npm install
expo start -c
```

### Notifications not working
1. Check device notification settings
2. Ensure notification permissions are granted
3. Verify the deadline is in the future
4. Test on a physical device (not simulator)

### Database errors
```bash
# Clear Expo cache
expo start -c

# Or uninstall and reinstall the app
```

### Build errors
```bash
# Clear node modules and reinstall
rm -rf node_modules
npm install

# Clear Expo cache
expo start -c
```

## Building for Production

### Android APK

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure build:
```bash
eas build:configure
```

4. Build APK:
```bash
eas build --platform android --profile preview
```

5. Download and install the APK on your device

### iOS IPA

1. Follow steps 1-3 above
2. Build IPA:
```bash
eas build --platform ios --profile preview
```

3. Install via TestFlight or direct installation

## Development Tips

### Hot Reload
The app supports hot reload. Changes to most files will automatically refresh the app.

### Debugging
- Shake your device to open the developer menu
- Enable "Debug Remote JS" to use Chrome DevTools
- Use `console.log()` statements - they appear in the terminal

### Testing Different Scenarios

**Test Escalating Notifications:**
1. Create a task with deadline 25 hours away (should get 1 notification per day)
2. Create a task with deadline 3 hours away (should get notifications every 2-3 hours)
3. Create a task with deadline 1 hour away (should get notifications every 30 minutes)

**Test Recurring Tasks:**
1. Create a daily recurring task
2. Set the time to 1 minute from now
3. Wait for the notification
4. Mark it done
5. It should reappear the next day

**Test Checklist Items:**
1. Create a task with multiple checklist items
2. Set different deadlines for different items
3. Verify each item gets its own notification schedule

**Test Notification Actions:**
1. Receive a notification
2. Swipe or long-press to see actions
3. Test "Mark Done" - should complete the task
4. Test "Snooze 1h" - should reschedule for 1 hour later

## Project Structure

```
remind-app/
├── App.js                          # Entry point, notification listeners
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── src/
│   ├── database/
│   │   └── db.js                   # SQLite operations
│   ├── navigation/
│   │   └── AppNavigator.js         # Navigation setup
│   ├── screens/
│   │   ├── TodayScreen.js          # Today's tasks
│   │   ├── AllTasksScreen.js       # All tasks with filters
│   │   ├── SomedayScreen.js        # Backlog tasks
│   │   ├── TaskDetailScreen.js     # Task details
│   │   └── AddEditTaskScreen.js    # Create/edit form
│   └── utils/
│       └── notificationScheduler.js # Notification logic
└── assets/                         # Images and icons
```

## Next Steps

1. Install dependencies: `npm install`
2. Add asset images to `assets/` directory
3. Start the dev server: `npm start`
4. Test on a physical device for best results
5. Create some tasks and test the notification flow

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the main README.md
3. Check Expo documentation: https://docs.expo.dev/

## License

Personal use only.