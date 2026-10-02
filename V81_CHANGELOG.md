# Gold2 Pro 81.0.0

- Fixed the terminal quote cards by updating them from every successful state poll and live market event.
- Added push alerts for fresh, high-strength one-hour buy/sell signals; stale, incomplete, or anomalous market data is excluded.
- Raised the default gold signal alert threshold to 75/100. `MIN_SIGNAL_SCORE`, `STRONG_SIGNAL_SCORE`, `STRONG_SIGNAL_POLL_MS`, and `STRONG_SIGNAL_COOLDOWN_MIN` can tune the behavior.
- Improved the terminal, sign-in, and mobile color contrast and spacing.
- Push notifications now retain their destination and focus or open the related page when clicked.
- Admin broadcasts are origin-checked, length-limited, and delivered in-app plus by Push to devices that have opted in.
- Demo admin credentials are disabled in production; configure a unique `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Deplexo Secrets.
- The site remains installable as a PWA on supported desktop and mobile browsers. Browser permission and user opt-in are required for Push notifications.

Live market sources continue to use the existing provider fallbacks. Signal alerts are educational and do not guarantee results.
