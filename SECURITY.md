# Security

- Never commit `.env` or real API keys/passwords.
- Keep GapGPT, IPPanel, Push/VAPID and admin secrets in Deplexo Environment Variables.
- Keep user data on the persistent `/data` volume, not in Git.
- If a secret is accidentally committed, rotate/revoke it immediately and remove it from repository history.
