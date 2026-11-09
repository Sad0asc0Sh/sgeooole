# امنیت همگام‌سازی قیمت و پاسخ‌های عمومی (نسخهٔ ۴.۲.۰ — سمت فروشگاه)

> این فایل همراهِ ارتقای «موتور قیمت‌گذاری ۴.۲.۰» است. شرح کامل سمت موتور: `docs/SECURITY_AND_PRIVACY.md` در پروژهٔ موتور.

## ۱. دو مشکلی که برطرف شد

| # | مشکل | اثر |
| :-- | :-- | :-- |
| ۱ | `POST /api/products/pricing-sync` با شرط `if (expectedSecret && incoming !== expectedSecret)` احراز می‌شد: اگر `SGEOOOLE_PRICING_SECRET` تنظیم نبود، شرط **اصلاً بررسی نمی‌شد** (fail-open)؛ مقایسهٔ `!==` هم زمان‌ثابت نبود | هر کسی در اینترنت می‌توانست قیمت فروش، کمپین و تخفیف محصولات را عوض کند |
| ۲ | سند محصول `costPrice`، `hardFloorPrice` و `supplierQuotes` (نام تامین‌کننده + قیمت خرید) دارد و `GET /api/products`، `/api/products/:id`، `/api/products/code/:code` کل سند را برمی‌گرداندند | هر بازدیدکننده یا رقیبی می‌توانست حاشیهٔ سود و تامین‌کنندگان را بخواند |

## ۲. تغییرات (فایل‌ها)

| فایل | تغییر |
| :-- | :-- |
| `utils/pricingSyncAuth.js` (جدید) | احراز **fail-closed**: بدون کلید معتبر (یا مقدار نمونه مثل `CHANGE_ME`) پاسخ `503 PRICING_SYNC_NOT_CONFIGURED`؛ کلید نادرست/ناموجود `401`؛ مقایسهٔ زمان‌ثابت (SHA-256 + `timingSafeEqual`)؛ هشدار برای کلید کوتاه‌تر از ۲۴ نویسه |
| `routes/products.js` | مسیر `pricing-sync` از `authorizePricingSync` استفاده می‌کند |
| `middleware/hideInternalPricingFields.js` (جدید) و `server.js` | روی `res.json` همهٔ مسیرهای `/api` کلیدهای `costPrice`، `hardFloorPrice`، `supplierQuotes`، `replacementCost`، `effectiveCostPrice` را در هر عمقی حذف می‌کند (ورودی دست نمی‌خورد) |
| `models/Product.js` | سه فیلد `costPrice`، `hardFloorPrice`، `supplierQuotes` اکنون `select: false` هستند |
| `services/productListingService.js` | پایپ‌لاین لیست محصولات آن‌ها (و `pricingMeta.hardFloorPrice`) را صریحاً `$project` می‌کند |
| `tests/pricing-sync-auth.test.cjs`، `tests/public-api-secrets.test.cjs` (جدید) | ۱۷ آزمون؛ هر دو در `npm test` ثبت شده‌اند |
| `.env.example`، `package.json` | مستندسازی کلید و ثبت آزمون‌ها |

سه لایهٔ حفاظت عمداً تکراری‌اند (defense in depth): اگر یکی در آینده دور زده شود، دو لایهٔ دیگر می‌مانند. فیلدهای غیرمحرمانهٔ `pricingMeta` (مثل `exactFloorPrice`، `badgeTheme`) که منطق کف قطعی و نمایش به آن‌ها نیاز دارد دست‌نخورده‌اند.

## ۳. اقدام لازم هنگام ارتقا (مهم — وگرنه همگام‌سازی متوقف می‌شود)

۱. یک کلید تصادفی بسازید و **همان مقدار** را در هر دو سرویس بگذارید:

```bash
openssl rand -hex 32
# موتور قیمت‌گذاری (.env):  SGEOOOLE_PRICING_SECRET=<کلید>
# بک‌اند فروشگاه  (.env):  SGEOOOLE_PRICING_SECRET=<کلید>     (یا STORE_WEBHOOK_SECRET)
```

۲. هر دو را ری‌استارت کنید. تا زمانی که کلید در سرور فروشگاه تنظیم نباشد، `pricing-sync` پاسخ `503` می‌دهد: قیمت‌های فعلی فروشگاه **بدون تغییر** می‌مانند (هیچ قیمتی اشتباه نمی‌نشیند) ولی قیمت‌گذاری خودکار متوقف است. در ناهماهنگی کوتاهِ دو سرویس فقط `401` دیده می‌شود.
۳. اگر برای کانکتور فروشگاه در پنل موتور (`store_connectors`) خودِ `apiKey` را ذخیره کرده‌اید، آن مقدار بر `.env` اولویت دارد؛ همزمان به‌روز کنید.
۴. فقط برای توسعهٔ محلی: `NODE_ENV=development` (یا `test`) **و** `PRICING_SYNC_ALLOW_UNAUTHENTICATED=true`. در production هرگز عمل نمی‌کند.
۵. `SGEOOOLE_API_URL` در موتور باید `localhost`/شبکهٔ داخلی یا `https` باشد: بدنهٔ همگام‌سازی خودش `costPrice` و `hardFloorPrice` را برای گارد کف قطعی حمل می‌کند.

## ۴. پس از استقرار

- **افشای پیشین:** سندهای موجود در MongoDB تغییر نکرده‌اند (فقط دیگر برگردانده نمی‌شوند). اگر تا امروز `costPrice`/`supplierQuotes` از طریق API عمومی خوانده شده باشد، آن اطلاعات ممکن است قبلاً جمع‌آوری شده باشد. لاگ دسترسی nginx را برای درخواست‌های گذشته به `/api/products` بررسی و در صورت لزوم قیمت‌های خرید/تامین‌کنندگان را بازنگری کنید.
- **کد دیگری که `costPrice` را از `Product` می‌خواند:** چون `select: false` است، کوئری باید صراحتاً `.select('+costPrice')` بزند (ایمپورترِ موتور این کار را می‌کند؛ آزمون `H4` در موتور آن را نگه می‌دارد). فرانت‌اند و پنل ادمین فروشگاه در این بسته هیچ ارجاعی به این فیلدها ندارند (جست‌وجو انجام شد)؛ اگر شخص ثالثی از آن‌ها استفاده می‌کند، دیگر دریافتشان نمی‌کند.
- **`pricingMeta.confidence`، `decisionId`، رتبه‌ها** هنوز در خروجی عمومی می‌آیند (حساس نیستند ولی «چقدر مطمئنیم» را نشان می‌دهند). اگر نمی‌خواهید، به `SECRET_KEYS` در `middleware/hideInternalPricingFields.js` اضافه کنید.

## ۵. آزمون

```bash
cd ekgkala-backend
node --test tests/pricing-sync-auth.test.cjs tests/public-api-secrets.test.cjs   # ۱۷ آزمون، بدون MongoDB
npm test                                                                          # همهٔ آزمون‌های فروشگاه (برخی به mongoose/MongoDB نیاز دارند)
```

در محیط ساخت این بسته فقط همین دو فایل قابل اجرا بود؛ بقیهٔ آزمون‌های فروشگاه به وابستگی‌های نصب‌شده (mongoose و …) نیاز دارند و اینجا اجرا نشدند.

## ۶. آنچه انجام **نشده**

- رمزنگاری ستونی قیمت خرید در MongoDB (نیازمند مدیریت کلید)؛
- محدودسازی نرخ (rate-limit) روی `pricing-sync` (احراز قوی است، ولی بدون سقف تعداد درخواست)؛
- ثبت/حسابرسی دسترسی به فیلدهای محرمانه.
