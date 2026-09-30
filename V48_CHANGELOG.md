# Gold Alert Pro v48 — SMS Subscription & Commerce Controls

- Added administrator-editable payment card number, card holder, SMS subscription price, duration and plan label.
- Persisted commerce settings in DATA_DIR/commerce-settings.json using atomic replacement.
- Exposed only public payment instructions to customers; admin mutation routes require an admin session.
- Customer SMS premium screen now loads card and pricing dynamically.
- SMS premium request pricing/duration follows saved admin settings for new requests. Existing activated subscriptions retain their current expiry.
- Existing paid SMS activation and premium alert delivery workflow retained.
