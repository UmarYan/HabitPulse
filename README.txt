HabitPulse V9.2 — Complete App Audit

Built on V9.1. This is an audit and regression-check release, not a feature expansion.

Audit coverage
- Core date validation and calendar boundaries.
- Daily, weekday, weekend, custom weekday, interval and monthly schedules.
- Habit creation-date and configured schedule-window boundaries.
- Backup validation guards for duplicate IDs, malformed dates, invalid log references and invalid numeric values.
- Routine execution membership and shared habit-log write path.
- Backup wrapper and validate-before-restore flow.
- JavaScript syntax, service-worker syntax, HTML parsing, manifest JSON and ZIP integrity.

Regression test suite
- Run `node audit-tests.js` from this folder.
- The suite extracts and executes the actual date-validation and schedule functions from app.js, and checks critical backup/routine safeguards against the shipped source.
- Eight focused regression checks pass in the release environment.

Compatibility and safety
- No LocalStorage key or schema changes.
- No data migration and no new persistent fields.
- Existing habit logs, routines, reminders, schedules, analytics, execution mode and backup format are retained.
- The service-worker cache is bumped to `habitpulse-v9-2`.

Validation results
- app.js Node syntax check: PASS.
- sw.js Node syntax check: PASS.
- Focused regression suite: 8/8 PASS.
- HTML parser check: PASS.
- Manifest JSON parse: PASS.
- Duplicate HTML ID check: PASS.
- ZIP integrity check: PASS.

Not performed
- Real browser interaction testing.
- Physical Android-device testing.
- Cross-browser notification delivery testing.

Update
1. Export a backup before replacing hosted files.
2. Extract all ZIP contents to the existing hosting location, replacing prior app files.
3. Open online once so the V9.2 service worker installs; reopen the PWA if cached content persists.
