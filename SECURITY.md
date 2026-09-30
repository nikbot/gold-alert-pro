# Security

- Never commit `.env` or real API keys/passwords.
- Keep GapGPT, IPPanel, Push/VAPID and admin secrets in Deplexo Environment Variables.
- Keep user data on the persistent `/data` volume, not in Git.
- If a secret is accidentally committed, rotate/revoke it immediately and remove it from repository history.


## v42 baseline
- Admin login no longer accepts hard-coded fallback credentials; configure `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` (minimum 14 characters) as deployment secrets.
- CORS is same-origin by default; configure explicit trusted origins only when cross-origin access is required.
- The state reset endpoint requires a valid admin session and is audit-logged.
- Existing deviceId-based user data endpoints remain in this release and still require a dedicated account-ownership migration before multi-user production use.
