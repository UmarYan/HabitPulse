HabitPulse v1.0
===============

A lightweight, offline-first habit tracker PWA.

Included:
- Daily habit check-ins
- Islamic, Health, Productivity, Personal and Learning categories
- Daily / weekdays / flexible frequencies
- Streaks and 7-day insights
- Add, edit and delete habits
- Dark and light themes
- JSON backup and restore
- Local browser storage
- Service worker offline cache

Run locally:
1. Extract the ZIP.
2. Serve the folder from a local web server (service workers require localhost or HTTPS).
3. Open index.html. For offline PWA installation, use localhost or deploy to an HTTPS host.

Deployment:
Upload index.html, manifest.json and sw.js to the root of a static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages, etc.).

Important:
- Data is stored in this browser's localStorage. Clearing browser/site data can erase it.
- Export backups regularly, especially before changing devices or browsers.
- Notifications and cloud sync are not included in this first MVP.
