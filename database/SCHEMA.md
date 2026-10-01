# Gold2 Pro V60 Data Schema

The application keeps persistent production data under `DATA_DIR` so it survives redeploys on Deplexo.

| Logical table | Runtime file | Purpose |
|---|---|---|
| users | accounts.json | User accounts, roles, plan, status, last activity |
| sessions | admin-sessions.json | Secure server-side admin sessions |
| payments | payments.json | Payment/transaction records |
| login_logs | login-logs.json | Successful/failed admin logins, IP and device info |
| activity_logs | audit-log.json | Administrative activity feed |
| settings | admin-settings.json | Site/admin/security settings |
| permissions | database/permissions.json + role rules | Role-to-permission matrix |
| tickets | tickets.json | Support tickets |
| profiles | profiles.json | Investor/user profiles |
| portfolios | portfolios.json | User portfolios |

All runtime files are JSON-backed for compatibility with the existing Gold2 deployment. The schema is intentionally simple so the persistent directory can later be migrated to SQLite/PostgreSQL without changing the API contract.
