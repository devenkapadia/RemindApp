# Testing Guide — RemindApp

This document explains every type of test in this project, what each test covers, and **exactly how to run it yourself**. No prior testing experience required.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Jest Unit & Component Tests](#3-jest-unit--component-tests)
   - [Install dependencies](#31-install-dependencies)
   - [Run all tests](#32-run-all-tests)
   - [Run a single test file](#33-run-a-single-test-file)
   - [Watch mode](#34-watch-mode)
   - [Coverage report](#35-coverage-report)
   - [What each test file covers](#36-what-each-test-file-covers)
4. [Maestro E2E Tests](#4-maestro-e2e-tests)
   - [Install Maestro](#41-install-maestro)
   - [Start the app](#42-start-the-app)
   - [Run a single flow](#43-run-a-single-flow)
   - [Run all flows in order](#44-run-all-flows-in-order)
   - [What each flow does](#45-what-each-flow-does)
5. [Manual Testing Checklist](#5-manual-testing-checklist)
6. [Test File Structure](#6-test-file-structure)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Overview

| Layer | Tool | What it tests | Needs device? |
|---|---|---|---|
| Unit — business logic | Jest | Auth rules, DB queries, notification scheduling | ❌ No |
| Unit — components | Jest + React Testing Library | Login form renders & responds to input | ❌ No |
| E2E — real user flows | Maestro | Sign up, create task, verify, mark done | ✅ Yes |

---

## 2. Prerequisites

| Tool | Install command | Check version |
|---|---|---|
| Node.js ≥ 18 | [nodejs.org](https://nodejs.org) | `node -v` |
| npm ≥ 9 | comes with Node | `npm -v` |
| Maestro (E2E only) | see §4.1 | `maestro --version` |
| Android emulator **or** physical device (E2E only) | Android Studio / Expo Go dev build | `adb devices` |

---

## 3. Jest Unit & Component Tests

These run entirely on your computer — no phone needed.

### 3.1 Install dependencies

```bash
npm install
```

This installs everything in `package.json` including:
- `jest` — test runner
- `jest-expo` — Expo-aware Jest preset
- `@testing-library/react-native` — component rendering helpers
- `@testing-library/jest-native` — extra matchers (`toBeVisible`, `toHaveText`, etc.)

### 3.2 Run all tests

```bash
npm test
```

Expected output:
```
PASS  src/__tests__/unit/authLogic.test.js
PASS  src/__tests__/unit/database.test.js
PASS  src/__tests__/unit/notificationScheduler.test.js
PASS  src/__tests__/components/LoginScreen.test.js

Test Suites: 4 passed, 4 total
Tests:       XX passed, XX total
```

### 3.3 Run a single test file

```bash
npx jest src/__tests__/unit/database.test.js
npx jest src/__tests__/unit/authLogic.test.js
npx jest src/__tests__/unit/notificationScheduler.test.js
npx jest src/__tests__/components/LoginScreen.test.js
```

### 3.4 Watch mode

Reruns tests automatically whenever you save a file:

```bash
npm run test:watch
```

Press `a` to run all, `f` to run only failing tests, `q` to quit.

### 3.5 Coverage report

```bash
npm run test:coverage
```

Opens a summary in the terminal. A full HTML report is written to `coverage/lcov-report/index.html` — open it in a browser to see line-by-line coverage.

### 3.6 What each test file covers

#### `src/__tests__/unit/authLogic.test.js`

Tests the sign-up and sign-in business rules in isolation (no UI).

| Test | What it checks |
|---|---|
| Creates a new user | `signUp('alice', 'password123')` stores user in DB and AsyncStorage |
| Trims and lowercases username | `'  BOB  '` is stored as `'bob'` |
| Rejects username < 3 chars | Returns `{ success: false, error: '...' }` |
| Rejects password < 6 chars | Returns `{ success: false, error: '...' }` |
| Rejects duplicate username | Second sign-up with same username fails |
| Sign in with correct password | Returns `{ success: true }` |
| Sign in is case-insensitive | `'DAVE'` matches user `'dave'` |
| Sign in rejects wrong password | Returns `{ success: false, error: 'Incorrect password' }` |
| Sign in rejects unknown user | Returns `{ success: false, error: 'No account found' }` |

#### `src/__tests__/unit/database.test.js`

Tests every database function against an in-memory SQLite mock — no real database file is created.

| Group | Tests |
|---|---|
| **User CRUD** | create, lookup by username, update display name |
| **Task CRUD** | create, fetch by id, filter by user/status/group, update, delete |
| **Task + Items** | `getTaskWithItems` returns items array |
| **Checklist Items** | create multiple items, mark done, delete |
| **Task Groups** | create group (auto-adds owner), get user's groups |
| **Group Members** | add member, list members, remove member |

#### `src/__tests__/unit/notificationScheduler.test.js`

Tests the escalating notification logic.

| Test | What it checks |
|---|---|
| 3-hour deadline | At least one notification is scheduled (2–24h bracket) |
| 30-minute deadline | At least one notification is scheduled (<2h bracket) |
| Past deadline | **No** notifications scheduled |
| Someday task | **No** notifications scheduled |
| Daily recurring | `scheduleNotificationAsync` called with `trigger.type = 'daily'` |
| Weekly recurring (Mon+Wed) | Called exactly twice with correct `weekday` values (2 and 4) |
| Cancel notifications | `cancelScheduledNotificationAsync` called with the right ID |
| Snooze action | New notification scheduled ~1 hour from now |
| Mark-done action | Task status updated to `'done'` in DB |

#### `src/__tests__/components/LoginScreen.test.js`

Renders the real `LoginScreen` component and simulates user interactions.

| Test | What it checks |
|---|---|
| Default render | Username and password fields visible, "Log In" button present |
| Switch to sign-up | Tapping "Sign Up" shows "Display Name" field and "Create Account" button |
| Empty submit | Submitting empty form does not crash |
| Field input | Typing in username/password updates the field values |
| Sign-up flow | Filling all fields and submitting "Create Account" runs without error |

---

## 4. Maestro E2E Tests

These simulate a real human using the app. They run against a live build on a device or emulator.

### 4.1 Install Maestro

**macOS / Linux:**
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

**Windows:**
```powershell
iwr "https://get.maestro.mobile.dev/install.ps1" -useb | iex
```

Verify:
```bash
maestro --version
# Maestro 1.x.x
```

### 4.2 Start the app

You need a **development build** running on a device or emulator (Expo Go does not support all native modules):

```bash
# Start Android emulator first, then:
npx expo run:android

# Or on a physical Android device connected via USB:
adb devices          # confirm device is listed
npx expo run:android
```

Leave the Metro bundler running. Open a second terminal for Maestro commands.

### 4.3 Run a single flow

```bash
maestro test .maestro/01_signup.yaml
```

Maestro will:
1. Launch the app
2. Execute each step in the YAML
3. Print `✅ PASS` or `❌ FAIL` with a screenshot on failure

### 4.4 Run all flows in order

```bash
# Run each flow in sequence (each builds on the previous)
maestro test .maestro/01_signup.yaml
maestro test .maestro/02_create_personal_task.yaml
maestro test .maestro/03_verify_task_exists.yaml
maestro test .maestro/04_create_group_task.yaml

# Or run the full smoke test (standalone — clears state first):
maestro test .maestro/05_smoke_test.yaml
```

> ⚠️ Flows 01–04 are **sequential** — each assumes the previous ran successfully (same app state). Flow 05 is **standalone** — it clears app state and runs everything itself.

### 4.5 What each flow does

#### `01_signup.yaml` — Create account
```
Open app (clear state) → tap "Sign Up" → enter name/username/password → tap "Create Account" → verify "Today" screen appears
```

#### `02_create_personal_task.yaml` — Create a reminder
```
Tap + button → fill "Buy groceries" → select Deadline type → tap "Create Task" → verify modal closes
```

#### `03_verify_task_exists.yaml` — Verify task is saved
```
Tap "All Tasks" tab → assert "Buy groceries" is visible → tap it → verify detail screen shows "deadline" and "pending"
```

#### `04_create_group_task.yaml` — Group task with assignment
```
Tap "Groups" tab → tap FAB → enter "Work Sprint" → tap "Create Group" → tap "Add Task" → fill title → assign to self → tap "Create Task" → verify task appears with assignee name
```

#### `05_smoke_test.yaml` — Full end-to-end smoke (standalone)
```
Clear state → sign up → create Someday task → navigate to Someday → promote to deadline → open task → mark done → verify task disappears
```

---

## 5. Manual Testing Checklist

Use this when you want to test by hand on your device. Go through it after any significant change.

### Authentication
- [ ] Open app fresh — see Login screen
- [ ] Try signing up with a username shorter than 3 characters — see error
- [ ] Try signing up with a password shorter than 6 characters — see error
- [ ] Sign up with valid credentials — land on Today screen
- [ ] Close and reopen the app — still logged in (persisted)
- [ ] Go to Profile → Sign Out — return to Login screen
- [ ] Sign in with correct credentials — land on Today screen
- [ ] Sign in with wrong password — see "Incorrect password" error

### Personal Tasks
- [ ] Tap `+` in header → Add Task screen opens
- [ ] Create a **Deadline** task with a future date — appears in Today
- [ ] Create a **Recurring** task (daily, 09:00) — appears in Today
- [ ] Create a **Someday** task — appears in Someday screen, not Today
- [ ] Tap a task → Task Detail screen opens with correct info
- [ ] Edit a task (pencil icon) → change title → save → title updates
- [ ] Mark all checklist items done → task moves to done
- [ ] Delete a task → it disappears from the list
- [ ] Pull-to-refresh on any list screen — data reloads

### Task Groups
- [ ] Go to Groups tab — see empty state
- [ ] Tap `+` FAB → enter group name → Create Group — group detail screen opens
- [ ] Go back — group appears in the list
- [ ] Create a second group — **both** groups visible in the list
- [ ] Open a group → tap "Add Task" → fill title → select **Assign To** member → Create Task
- [ ] Group task appears in group detail with `→ username` label
- [ ] Open the task from group detail → shows "Assigned to: username" in detail screen
- [ ] Invite a friend: their username must exist in the system
- [ ] Remove a member (owner only) — they disappear from the list
- [ ] Delete a group (owner only) — disappears from Groups list

### Notifications (requires physical device)
- [ ] Create a deadline task 2 minutes from now
- [ ] Lock phone / minimize app — notification appears within 2 minutes
- [ ] Tap **Mark Done** action on notification — task status becomes done without opening app
- [ ] Tap **Snooze 1h** action — a new notification fires ~1 hour later

---

## 6. Test File Structure

```
remind-app/
├── src/
│   └── __tests__/
│       ├── setup.js                        ← runs before every test file
│       ├── __mocks__/
│       │   ├── async-storage.js            ← in-memory key/value mock
│       │   ├── expo-sqlite.js              ← in-memory SQL engine mock
│       │   └── expo-notifications.js       ← notification API mock
│       ├── unit/
│       │   ├── authLogic.test.js           ← sign up / sign in rules
│       │   ├── database.test.js            ← all CRUD operations
│       │   └── notificationScheduler.test.js ← scheduling & action handlers
│       └── components/
│           └── LoginScreen.test.js         ← UI render & interaction
└── .maestro/
    ├── 01_signup.yaml                      ← E2E: create account
    ├── 02_create_personal_task.yaml        ← E2E: create reminder
    ├── 03_verify_task_exists.yaml          ← E2E: verify task saved
    ├── 04_create_group_task.yaml           ← E2E: group + assignment
    └── 05_smoke_test.yaml                  ← E2E: full standalone flow
```

---

## 7. Troubleshooting

### Jest: `Cannot find module 'expo-sqlite'`
The mock is auto-loaded by Jest's `moduleNameMapper`. If it's missing, check that `src/__tests__/__mocks__/expo-sqlite.js` exists.

### Jest: `SyntaxError: Cannot use import statement`
Make sure `babel-preset-expo` is in `devDependencies` and `babel.config.js` contains `presets: ['babel-preset-expo']`.

### Jest: tests pass but coverage is 0%
Run `npm run test:coverage` instead of `npm test`. The `--coverage` flag is required.

### Maestro: `App not found` / `No devices`
- Confirm the app is built and running: `npx expo run:android`
- Confirm the app ID in each YAML matches `app.json` → `"package": "remind.app"`
- Confirm device is connected: `adb devices` (Android) or Simulator is open (iOS)

### Maestro: `Element not found`
- The app may be loading slowly — add `- waitForAnimationToEnd` before the failing step
- A screen name may have changed — check the YAML text matches what's on screen exactly

### Maestro: flows 02–04 fail immediately
Run `01_signup.yaml` first — the subsequent flows depend on a logged-in user from that flow.
