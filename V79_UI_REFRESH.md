# V79 UI Refresh

## Experience
- Redesigned user sign-in and account controls with a responsive, branded auth gate.
- Added show/hide password controls and Enter-key submission for user/admin sign-in.
- Split manager sign-in into a focused mode; the standalone manager sign-in no longer pre-fills the username.
- Clarified account sign-out and added a confirmation before ending the user session.
- Added a searchable section palette on the main dashboard (Ctrl/Cmd+K).
- Refreshed the main terminal, navigation, mobile controls, and standalone admin center styling.

## Delivery notes
- UI-only changes; existing authentication APIs and session storage are retained.
- No secrets or API keys were changed by this refresh.
- Service-worker build marker advanced to v79.0.0 to pick up the new interface assets.
