# Gold2 Pro 83.0.0

- Start the initial market quote without waiting for historical-price seeding and nonessential startup tasks.
- Merge a late history response safely so it cannot replace a newer live quote.
- Keep server-sent market updates as the primary client refresh path and slow the fallback polling cadence.
- Pause the V72 dashboard polling when its panel is off-screen; reduce the countdown repaint rate.
- Replace the dark dashboard with a high-contrast light theme across the terminal, cards, forms, navigation, and sign-in panel.
- Update app/service-worker versions and make the first quote loading state explicit.

Live prices still depend on the configured market-data providers and may be temporarily stale when sources are unavailable.
