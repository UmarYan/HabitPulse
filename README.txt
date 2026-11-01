HabitPulse V8.1 — Habit Recovery & Consistency Insights

Base
- Built directly on the user's latest HabitPulse V8.0 — Routine-First Redesign ZIP.
- Retains the V8.0 storage key, schema version, habit/log records, routine records, backup/restore format, navigation, and existing score/streak calculations.

Changes
- Adds a per-habit “Getting back on track” insight in Habit Details.
- Shows next-opportunity recovery rate, recovered-after-a-miss count, and last completion date.
- For daily/custom/interval/monthly schedules, a missed scheduled opportunity is considered recovered when the next eligible scheduled opportunity is completed.
- For weekly-target habits, recovery is measured across completed full weeks: after a week misses its target, whether the next full week meets its target.
- Partial first weeks are excluded for weekly-target recovery so a habit is not judged against a target it did not have a full week to achieve.
- Skipped days are excluded from the daily missed-opportunity sequence.
- Recovery is descriptive only: it does not change habit history, score, streak, schedule, or stored data.
- Updates the service-worker cache version to V8.1.

Data safety
- No schema migration or new persisted fields.
- Existing habits, logs, routines, settings, and reviews remain in their existing structures.
- Recovery metrics are calculated from existing history at display time.

Validation performed
- Inline JavaScript syntax checked with Node.js.
- Service-worker syntax checked with Node.js.
- HTML parsed.
- Manifest JSON validated.
- ZIP integrity checked after packaging.
- Existing duplicate static ID “detailTitle” was confirmed to already exist in V8.0 and V7.6; this update did not introduce it.
- Browser interaction testing could not be completed in this environment.
- Real Android-device testing and testing against the user's actual installed local database were not performed.

Install
- Export a JSON backup from the current app before replacing files.
- Deploy index.html, manifest.webmanifest, sw.js, and both icons together.
- Open the app online once so the V8.1 service worker can refresh its cache.
