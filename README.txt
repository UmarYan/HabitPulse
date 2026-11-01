HabitPulse V8.0 — Routine-First Redesign

Base
- Built from the user's supplied HabitPulse V7.6 — Loop Inspired Tracking ZIP.
- Preserves the existing V7.x localStorage key and habit/log record model.
- Adds a backward-compatible routines collection and schema normalization (schema version 21).

Product changes
- Reworked the app's information architecture around a Home dashboard, Today tracker, Routines, Insights and More.
- Home dashboard gives a concise daily completion summary, quick actions, routine progress, upcoming habits and weekly-goal progress.
- Daily completion is separated from weekly-target habits so weekly goals are not incorrectly presented as daily due items.
- Routines group existing habits; a habit may belong to multiple routines without duplicating its tracking history.
- Added a dedicated routine create/edit form, preset starting points, member assignment, progress display and safe routine deletion.
- Routine deletion never deletes habits or their logs.
- Insights includes 14-day and monthly trends, annual activity map, 30-day history, habit scores and streaks.
- Nested Habit Library and Life Review routes correctly highlight More in the bottom navigation.
- Updated service-worker cache to V8.0 so installed PWAs refresh the app shell.

Data safety
- Existing V7.x storage key retained.
- Existing habit IDs, schedules, logs, notes, reviews, categories and settings are normalized and retained.
- Older data without routines migrates to an empty routines list.
- JSON backup/restore includes routines through the existing state export mechanism.

Validation performed
- JavaScript syntax checked with Node.js.
- Service-worker syntax checked with Node.js.
- Manifest JSON validated.
- HTML parsed; duplicate element IDs checked (none found).
- ZIP integrity checked after packaging.
- Headless Chromium interaction checks performed for habit creation, completion entry, routine creation/editing, habit assignment, weekly-goal display, Insights activity map, theme switching, backup action and routine deletion preserving habits.
- Simulated V7.6-compatible stored data migration checked: existing habit and log retained, routines initialized, theme retained.
- Real Android-device testing and testing against the user's actual installed local database were not performed.

Before installing
- Export a JSON backup from the current HabitPulse app first.
- Replace/redeploy the PWA files together (index.html, manifest.webmanifest, sw.js and icons).
- Open the app online once so the V8.0 service worker can refresh its cache.
