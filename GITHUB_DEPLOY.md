# انتشار Gold Alert Pro v42 با GitHub و Deplexo

## 1) ساخت Repository
در GitHub یک Repository جدید با نامی مثل `gold-alert-pro` بسازید. برای پروژه خصوصی، Repository را Private نگه دارید.

## 2) آپلود سورس
محتویات همین پوشه را در ریشه Repository قرار دهید؛ فایل‌ها را داخل یک پوشه اضافه‌ی دیگر قرار ندهید.

حداقل این‌ها باید در ریشه باشند:
- `package.json`
- `deplexo.yaml`
- `Dockerfile`
- `backend/`
- `public/`
- `.env.example`
- `.gitignore`

## 3) اتصال به Deplexo
در Deplexo گزینه Deploy from GitHub / Connect repository را انتخاب کنید، Repository و branch اصلی را انتخاب کنید. Deplexo با `deplexo.yaml` تنظیمات Node.js و port 3000 را می‌خواند.

## 4) Environment Variables
هیچ Secret واقعی را در GitHub قرار ندهید. این موارد را فقط در Environment/Secrets خود Deplexo تنظیم کنید:

- `GAPGPT_API_KEY`
- `IPPANEL_API_KEY`
- `IPPANEL_FROM`
- `IPPANEL_ADMIN_PHONE`
- `ADMIN_USERNAME` (مثلاً `admin`)
- `ADMIN_PASSWORD` (رمز یکتای حداقل ۱۴ کاراکتری)
- `ADMIN_KEY` فقط برای مسیرهای legacy فعال‌سازی/مدیریت دستی در صورت نیاز
- `VAPID_PRIVATE_KEY` در صورت استفاده از کلید ثابت
- سایر متغیرهای حساس پروژه

`GAPGPT_BASE_URL` و `GAPGPT_MODEL` می‌توانند از `.env.example` الگو بگیرند.

## 5) داده کاربران
داده‌های دائمی برنامه باید در `/data/gold-alert-pro` بمانند. Repository فقط سورس برنامه است؛ اطلاعات کاربران، نشست‌ها، تیکت‌ها و کلیدهای runtime را Commit نکنید.

## 6) انتشار نسخه‌های بعدی
بعد از اتصال اولیه، تغییرات را به branch متصل Push کنید. Deplexo می‌تواند با هر Push ساخت و Deploy جدید را انجام دهد. قبل از تغییرات بزرگ، از داده‌های `/data` نسخه پشتیبان داشته باشید.


در نسخه v42 ورود مدیر بدون تنظیم `ADMIN_USERNAME` و `ADMIN_PASSWORD` انجام نمی‌شود. این مقادیر را فقط در Environment/Secrets سرویس ثبت کنید، نه در GitHub یا فایل ZIP. پس از تنظیم، سرویس را Restart/Deploy کنید.


## v46 — رفع عیب 503 و بررسی سلامت

- مسیر بررسی سلامت فرایند: `GET /healthz` (پاسخ JSON با وضعیت 200 در صورت در دسترس بودن سرور HTTP).
- مسیر `GET /health` جزئیات سرویس‌ها و وضعیت داده بازار را ارائه می‌کند؛ وابستگی API خارجی ممکن است داده بازار را موقتاً غیرفعال کند، اما نباید مانع پاسخ healthz شود.
- پورت را روی `3000` تنظیم کنید یا اجازه دهید هاست مقدار `PORT` را تزریق کند. برنامه روی `0.0.0.0` گوش می‌دهد.
- از Node.js نسخه 20 یا بالاتر استفاده کنید. فرمان شروع: `node backend/server.js`.
- `DATA_DIR` باید مسیر قابل نوشتن و ترجیحاً persistent volume باشد (در Docker این پروژه `/data/gold-alert-pro` است).
- اگر هنوز صفحه 503 نمایش داده می‌شود، در Deplexo بخش Deploy/Runtime Logs را بررسی کنید: خطای نصب dependency، خطای اجرای Node، پورت/health-check ناهماهنگ، یا محدودیت حافظه. مسیر `/healthz` را پس از Deploy باز کنید. این بسته به‌تنهایی نمی‌تواند تنظیمات داشبورد Deplexo یا وضعیت زیرساخت را اصلاح کند.
