# Gold2 Pro V75.0.1 — Cache Update Fix

- Build cache-buster: `v75.0.1`
- HTML/JS/CSS assets use a new build query so browsers do not reuse old bundles.
- Express static assets are served with `Cache-Control: no-store, max-age=0, must-revalidate`.
- Service Worker uses network-first for HTML/JS/CSS and only falls back to cache when offline.
- Old Service Worker caches are removed on activation.
- API requests remain `cache: no-store`.
- `.env` was not modified.
- JavaScript syntax check: all files passed.
