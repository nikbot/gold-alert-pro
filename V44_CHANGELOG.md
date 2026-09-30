# Gold Alert Pro v44

## Persistent in-app Smart Alert
- Adds an idempotent default alert for 18-karat gold: notify when price is at or above 15,000,000 IRR.
- Stores alert rules in the existing persistent JSON data store (`personal-price-alerts.json`).
- On trigger, writes an in-app notification to `notifications.json` and marks the rule as triggered to prevent duplicate notifications.
- Exposes device-scoped notification retrieval and read APIs for price-alert notifications.
- Notification center now polls device-scoped price alerts even when the user is not signed in.

## Important
- The current project uses file-based JSON persistence, not PostgreSQL or another SQL database. Configure a persistent `DATA_DIR` volume on the hosting platform; ephemeral filesystems may lose alert records on redeploy.
- Existing deviceId-based price-alert ownership is not equivalent to authenticated account-level authorization. Do not treat deviceId as a strong identity for sensitive data.
- The alert is evaluated when the backend market polling obtains a valid Iran 18k price. Delivery therefore depends on market data availability and a running backend.
