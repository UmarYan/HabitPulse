# Habit Track — Minimum PWA

A small local-first habit tracking PWA scaffold with an interface direction inspired by Loop Habit Tracker.

## Included
- Dashboard with week selector and daily habit checkmarks
- Add/Edit habit page (name, description, frequency, color, boolean/measurable type, reminder time setting)
- Statistics page (score estimate, streak counters, completion rate, calendar heatmap)
- History page
- Settings page with JSON export/import and reset
- localStorage persistence
- PWA manifest, service worker, SVG icon

## Run
Open `index.html` in a browser. For installable PWA/service-worker support, serve the folder from a local or static HTTP server (for example, a simple static host) and use the browser's Install app option.

## Prototype limitations
- This is a minimum prototype, not a pixel-verified copy of the Android Loop app.
- Reminder time is saved as habit metadata; native Android scheduled notifications are not implemented in this web prototype.
- Score and streak calculations are simplified approximations and are not verified as Loop's exact algorithm.
- Weekly and alternate-day frequency logic is demonstrative.
- Native Android widgets, SQLite schema parity, import compatibility with Loop backup files, and full accessibility review are not included.

## Attribution / naming
This is an independent prototype and does not use Loop Habit Tracker's trademark or official branding. The official Loop project is open source under GPL-3.0; if you use or adapt official source code, retain its license, copyright and notice obligations. Official repository: https://github.com/iSoron/uhabits
