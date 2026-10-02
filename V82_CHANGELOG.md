# Gold2 Pro 82.0.0

- Rebuilt the dashboard palette as a high-contrast graphite and teal trading terminal, with distinct positive and negative market colors.
- Reworked the sign-in and registration landing panel for desktop and mobile.
- Added a visible price refresh action and a four-second state-poll fallback when live updates pause; live stream updates continue to take priority.
- Wired every market update into the terminal price cards, status, source, timestamp, and chart.
- Reorganized the mobile workspace into a compact five-destination dock, keeping the full section drawer available from the menu button.
- Bumped asset and service-worker versions so installed browsers fetch the new dashboard instead of reusing older cached UI.

The server still caps market polling at five seconds. Displayed prices are provider data and are not a guarantee of trade execution prices.
