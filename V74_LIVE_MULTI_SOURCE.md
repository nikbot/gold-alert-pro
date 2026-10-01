# Gold2 Pro V74 — Live Multi-Source Market Data

## تغییرات
- رفع باگ توقف بروزرسانی سایر بازارها هنگام قطع یا cached شدن طلای ۱۸.
- حذف وابستگی داشبورد به `window.latest` قدیمی؛ ترمینال همیشه `/api/state` تازه را با cache-buster می‌خواند.
- بروزرسانی UI هر 2.5 ثانیه و حلقه بازار بین 2.5 تا 5 ثانیه.
- Failover سریع و hedged requests با timeout کوتاه.
- طلای ۱۸: Forgod (در صورت تنظیم) + چند مسیر TGJU + TGJU widget + Servix/Tindex در صورت تنظیم.
- دلار: Forgod + چند مسیر TGJU + widget/world-market.
- اونس جهانی: Gold API + goldprice.dev + TGJU world-market + Yahoo GC=F fallback.
- Bitcoin: Forgod + Coinbase + Kraken + Binance.
- سکه: صفحه TGJU + TGJU widget.
- هر بازار مستقل به state نوشته می‌شود؛ خرابی یک بازار، نمایش بقیه را متوقف نمی‌کند.
- نمایش نام منبع فعال کنار قیمت در Watchlist.
- `.env` و Secrets بدون تغییر.

## بررسی
- 35 فایل JavaScript با `node --check`: بدون خطای syntax.
- تست mock موفق برای منبع اصلی و failover منبع دوم.
