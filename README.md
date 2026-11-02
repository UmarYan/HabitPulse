# HabitHarbor V1.2 — Stable Audit Update

HabitHarbor is an original, Loop-inspired habits and routines tracker. It follows minimalist habit-tracking principles without copying Loop's branding, assets, or exact UI.

## V1.2 highlights
- Fixes weekly-target interpretation for 3 times/week and 5 times/week habits.
- Weekly streaks are shown as week streaks for flexible weekly targets.
- Local date helpers are consistently used for history and streak calculations.
- More defensive JSON backup restore validation.
- Existing V1.1 storage key and data shape retained.

## Included
- Installable offline PWA
- Habits: Yes/No and measurable target types; daily, 3x/week, 5x/week and specific weekdays
- Indicative EMA strength, current/best streak, recent activity
- Routines with editable steps, per-day progress and continue flow
- JSON export/import, dark/light theme, local storage
- Capacitor Android wrapper source configuration

## Run PWA
Serve the `www` directory from a static server. Example: `python -m http.server 8080` inside `www`, then visit `http://localhost:8080`. HTTPS is required for installability outside localhost.

## Build Android APK (not included)
Prerequisites: Node.js, Android Studio, Android SDK, and a JDK compatible with Android Gradle Plugin.
From `android-wrapper`:
1. `npm install`
2. `npx cap add android` (one time; creates Android project)
3. `npm run sync`
4. `npx cap open android`
5. Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).

The ZIP includes PWA and Capacitor wrapper source configuration, not a compiled/signed APK.

## Limitations
- Reminder time is stored but notification scheduling is not implemented.
- Weekly targets are flexible goal counts in the Monday–Sunday calendar week.
- Routine progress is per local calendar day.
- Data stays in this device/browser profile; export backup before clearing storage.
- Validation: JavaScript syntax and ZIP integrity passed. No real-device/browser QA or Android build is claimed.
