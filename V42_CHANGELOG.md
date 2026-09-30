# Gold Alert Pro v42

- Removed hard-coded administrator username/password fallback and legacy admin-key login fallback.
- Administrator credentials must be supplied as deployment environment secrets; minimum password length is 14 characters.
- Changed CORS from wildcard-by-default to same-origin by default with explicit origin allowlisting.
- Protected `/api/reset` with an administrator session and added an audit event.
- Updated application version to 42.0.0 and documented deployment setup.

## Known remaining security work
- User data ownership still uses deviceId in several endpoints and needs account-bound authorization.
- This is a staged security baseline, not a full security certification or production penetration test.
