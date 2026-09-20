# EaseAT mobile

An offline attendance tracker for college students, built with Expo (React Native).
It is the mobile version of the EaseAT web app, with **no login, no server and no AI features**.
Everything is stored in a SQLite database on the phone and works without internet.

## Run it on your phone

You need Node.js 20 or newer (22 recommended) and the **Expo Go** app on your phone.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). The phone and computer must be on the
same Wi-Fi network. This project uses **Expo SDK 57**, so Expo Go must be a version that supports SDK 57.
If your store version of Expo Go is older, use a development build instead (see below).

There is no backend to start and no `.env` file to fill in.

## Install it as a real app (Android APK)

This uses Expo's build service and needs a free Expo account. `eas.json` is included with a `preview`
profile that produces an installable `.apk`.

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

When the build finishes, open the link it prints on your phone to download and install the APK.
To build on your own machine instead, install Android Studio and run `npx expo run:android`.

## What is in the app

| Screen | What it does |
| --- | --- |
| Dashboard | Overall percentage, today's classes with one-tap Present / Absent / Cancelled, "Mark all present", subjects needing attention, a "how many can you miss?" table, and what is coming up |
| Attendance | Every class in a date range, filters by subject and status, per-subject predictions, add a one-off class, move a class to another time |
| Timetable | Weekly slots by day (the same subject can appear twice in a day), overlap checks, and "Generate" to fill in earlier weeks |
| Calendar | Month grid with a mark per class, holiday and exam markers, day detail, and tap a class to update it |
| Subjects | Name, code, faculty, credits, colour, and an optional per-subject required percentage |
| Academic calendar | Holidays, exams, vacations, working days, semester start and end. Add one date or a range of days |
| Notifications | In-app warnings and reminders (no push notifications) |
| Profile | Name, college, semester, year, default required percentage, and "Erase all data" |

### How attendance is counted

- Only **Present** and **Absent** classes count towards the percentage.
- Cancelled, no-class and not-yet-marked classes never change it.
- Moving a class cancels the original and creates a new, countable class at the new time.
- Holidays, vacations and semester end stop classes being generated. A **Working day** on the same date wins over a holiday.
- Adding a holiday removes the unmarked classes on that date. Classes you already marked, moved or added by hand are kept.


## Your data

Data lives only on the phone, in a database called `easeat.db`. There is no account and nothing is uploaded.
Uninstalling the app deletes it, and there is no sync between devices. There is no export or backup feature yet.

## Project layout

```
App.js                     entry: loads fonts, opens the database, starts navigation
src/
  db/                      SQLite wrapper (with a lock for safe transactions) and the schema
  engine/                  attendance-math.js: the percentage / prediction arithmetic
  services/                all the business rules (sessions, timetable, calendar, notifications...)
  screens/                 the eight screens plus "More"
  components/              buttons, forms, bottom sheet, toast, class row...
  navigation/              bottom tabs plus the pushed screens
  utils/                   dates (plain YYYY-MM-DD strings), validation, errors
tests/                     unit and database tests
```

## Tests

```bash
npm test
```

Runs 45 tests against a real in-memory SQLite database using Node's built-in `node:sqlite`, so it needs
**Node 22.5 or newer**. They cover the attendance math (including the worked example from the original
README), session generation, holidays, rescheduling, overlap rules, notifications and transactions.
The tests do not need a phone.

## Notes

- The app is portrait-only and light-theme only.
- `npx expo export --platform android --platform ios` builds production bundles and is a quick way to check nothing is broken.
- Dates are stored as `YYYY-MM-DD` text and times as `HH:mm` text, so there is no timezone drift.

## LINK to Download
url : https://expo.dev/accounts/maadbohra/projects/easeat/builds/6bdde224-4562-491b-aa9c-6eeea5677f39
## Scan QR to Download
<img width="362" height="442" alt="WhatsApp Image 2026-09-20 at 12 04 33 PM" src="https://github.com/user-attachments/assets/bd536a16-e6c5-498e-bb6e-ab54fe357062" />
