# Gold2 Pro V80 Deployment Checklist

## Deplexo
- Install: `npm install --omit=dev --no-audit --no-fund`
- Build/check: `npm run check`
- Start: `node backend/server.js`
- Port: `3000`
- Persistent `DATA_DIR`: recommended `/data/gold-alert-pro`

## Required/important secrets
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `SERVIX_API_KEY`
- `GAPGPT_API_KEY` (optional for external AI)

## Optional
- `TINDEX_API_TOKEN`
- `IPPANEL_API_KEY`
- `IPPANEL_FROM`
- `PAYMENT_URL_TEMPLATE`
- `PUBLIC_BASE_URL`

## Production checks
- `GET /health` returns `ok: true`
- `GET /admin` loads the Admin Control Center
- Admin login sets an HttpOnly `gold_admin_session` cookie
- Refresh keeps the admin session
- `/api/admin/dashboard` is protected
- `/api/admin/users` is protected
- `/api/admin/payments` is protected
- `/api/admin/reports` is protected
- `/api/admin/security` is protected
- `/api/admin/settings` is protected
- `/api/admin/live-status` is protected
- Logout deletes the admin session cookie and server-side session
