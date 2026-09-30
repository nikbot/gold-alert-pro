# Gold Alert Pro v39

## Changes
- User sessions now expire automatically after `USER_SESSION_HOURS` (default 72 hours).
- Login attempts are rate-limited per IP/account combination to reduce brute-force attempts.
- Admin login attempts are rate-limited.
- Added basic HTTP security headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options`).
- Ticket creation is added to the audit log.
- Existing password hashing remains server-side with `scrypt`; plaintext passwords are not stored or displayed.

## Environment
- `USER_SESSION_HOURS=72` can be changed in Deplexo Environment Variables.
- Existing GapGPT/IPPanel secrets remain outside GitHub and must stay in Deplexo Environment Variables.
