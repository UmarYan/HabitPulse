# HabitHarbor V1.2 — Stable Audit Update

## Based on V1.1 Refinement
- Corrected flexible weekly targets (3x/week and 5x/week): they are evaluated as weekly goals rather than incorrectly treating every calendar day as a scheduled opportunity.
- Added weekly streak semantics for flexible weekly targets; the habit row now labels these as week streaks.
- Unified local-calendar date helpers for schedule/history calculations, avoiding UTC date drift in streak and best-streak paths.
- Hardened JSON restore validation for habit frequency, weekday values, targets, entry values, routine steps, and reasonable collection bounds.
- Kept the existing localStorage key and data shape compatible with V1.1; no automatic destructive migration.
- Service worker cache version bumped so V1.2 assets refresh.

## Validation
- JavaScript syntax check: passed.
- ZIP integrity: passed after packaging.
- Source-level review: performed for date handling, weekly-target calculations and import validation.
- Not performed: real browser/device QA, Android compilation, notification delivery tests, exhaustive algorithm verification.

## Known limitations
- Reminder time is stored but notification scheduling is not implemented.
- Flexible weekly goals use completed count per Monday–Sunday week; a week is considered achieved once target count is reached.
- Routine steps are tracked by local calendar date; no cross-device synchronization.
- This package contains Capacitor wrapper configuration, not a compiled APK.
