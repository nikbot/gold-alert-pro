# Gold Alert Pro v30 — Login + User Registration + Support Tickets

## ورود کاربران
- صفحه اول سامانه همیشه Login است.
- نام کاربری کاربر = شماره موبایل 11 رقمی با فرمت 09xxxxxxxxx
- کاربر در ثبت‌نام رمز عبور تعیین می‌کند.
- پس از ورود، نشست کاربر روی دستگاه ذخیره می‌شود و در ورود بعدی در صورت معتبر بودن نشست، داشبورد نمایش داده می‌شود.
- خروج از حساب، کاربر را به صفحه Login برمی‌گرداند.

## پشتیبانی / تیکت
- کاربر می‌تواند تیکت جدید ثبت کند و داخل همان تیکت پاسخ بدهد.
- مدیر می‌تواند همه تیکت‌ها را ببیند، پاسخ بدهد و وضعیت را به باز / در حال بررسی / پاسخ داده شد / بسته تغییر دهد.

## مدیریت کاربران
- مدیر اصلی: `admin` / `20058`
- مدیر می‌تواند کاربر، سطح دسترسی، فعال/غیرفعال، تاریخ انقضا و رمز جدید را مدیریت کند.
- رمز عبور کاربران به‌صورت هش‌شده ذخیره می‌شود و عمداً در پنل به شکل متن ساده نمایش داده نمی‌شود؛ مدیر می‌تواند رمز جدید تعیین کند.
- برای اعتبار زمانی، تاریخ انقضا برای هر کاربر قابل تعیین است.

## Deplexo
Install: `npm install --omit=dev --no-audit --no-fund`
Build: `npm run check`
Start: `node backend/server.js`
Port: `3000`

متغیرهای قبلی GapGPT، IPPanel، Push، SMS و هشدارها را حفظ کنید.

## In-app update system (v33)
Set these Deplexo environment variables to enable one-click updates:
- `UPDATE_MANIFEST_URL` = URL of a JSON manifest
- optional `UPDATE_PACKAGE_URL` = fallback ZIP URL

Manifest example:
```json
{"version":"37.0.0","packageUrl":"https://example.com/Gold-Alert-Pro-v34.zip","sha256":"...","mandatory":false,"notes":"بهبود نمودار و رفع خطاها"}
```
The updater downloads to the persistent data directory, verifies SHA-256 when provided, extracts to a staging directory, preserves `.env`/`node_modules` and all persistent `/data/gold-alert-pro` user data, then replaces application files and restarts the process. Do not expose a package URL that is not trusted.


## v37 additions
- Professional AI endpoint using market + portfolio + investor profile.
- Persistent investor profile, storage locations and household portfolio settings.
- Professional tools: ladder simulation, invoice record, account security shortcuts.
- Admin overview dashboard with operational status.
- Admin login no longer defaults to a username/password in the browser.


## v39 changes
- AI core access for registered users; robust GapGPT model fallback and real connection diagnostic endpoint.
- Desktop browser notifications + Web Push integration; server notifications attempt direct push to the user's registered device.
- Admin health/AI diagnostic controls.
- Persistent data path /data/gold-alert-pro is preserved.

## GitHub + Deplexo

This project is prepared for repository-based deployment. See `GITHUB_DEPLOY.md` for the exact GitHub/Deplexo flow.

Secrets must stay in Deplexo Environment Variables; never commit a real `.env` file or API key.


## Admin subscription and SMS payment settings (v48)

The admin panel includes editable card number, card holder, SMS subscription price (IRR), and duration. These values are stored under `DATA_DIR/commerce-settings.json` and survive redeploys when `DATA_DIR` is persistent. Customers see the public payment instructions in the SMS Premium section. SMS access continues to require the account `sms` permission and a manually reviewed payment request/activation code. Configure IPPanel credentials and approved pattern IDs as server-side environment variables only.


## v52 professional expansion
- Historical five-day outlook endpoint: `GET /api/market-outlook`. It reports historical up/down frequency and a volatility-based illustrative range; it is not a calibrated forward probability.
- Daily AI market report button in the AI section; requires `GAPGPT_API_KEY` configured as a server secret and user AI access.
- Existing modules already cover portions of alerts, push/SMS, portfolio, technical indicators, admin, subscriptions, news/calendar and PWA. Features requiring third-party credentials (SMS, Telegram, payment gateway, live macro/news feeds) are not active until configured.


## Administrator Login

For the packaged V60 build:
- Username: `admin`
- Password: `Gold@2026`

These credentials are intended for the packaged/demo build. Change them before production deployment.


## V60 FULL ADMIN CONTROL CENTER
- Dedicated admin route: `/admin`
- Super Admin secure HttpOnly session cookie with persistent server-side session.
- SaaS-style responsive dashboard with sidebar, live system status, users, revenue, reports, security, preview and settings.
- Role model: `SUPER_ADMIN`, `ADMIN`, `MODERATOR`, `PREMIUM_USER`, `USER`.
- Standard admin APIs: `/api/admin/dashboard`, `/api/admin/users`, `/api/admin/payments`, `/api/admin/reports`, `/api/admin/security`, `/api/admin/settings`, `/api/admin/live-status`.
- Data persists under `DATA_DIR`; see `database/SCHEMA.md`.
- Deployment checklist: `DEPLOY_CHECKLIST.md`.



## v61.0.0
AI Decision Room, Smart Alerts ترکیبی و Portfolio Guard اضافه شدند.

## V78
Professional Financial Terminal, Watchlist, Alerts, Developer API, subscriptions, market health and admin Pro Center.

## V79
Responsive sign-in and admin entry, clearer account sign-out, password visibility controls, and searchable dashboard navigation. See `V79_UI_REFRESH.md`.

## V80
Live gold/crypto signal workspace, exchange-sourced candles and crypto trade-side volume, Persian beginner explanations, and persistent paper-trade results. See `V80_SIGNAL_SIMULATOR.md`.
