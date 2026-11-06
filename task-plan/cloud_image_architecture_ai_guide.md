# دستورالعمل پیاده‌سازی بهینه‌سازی سرعت و UX بنرهای صفحه اصلی و تصاویر دسته‌بندی (فاز ۲ — ParsPack S3)

این سند شامل عیب‌یابی ریشه‌ای و دستورالعمل اجرایی گام‌به‌گام برای هوش مصنوعی فول‌اکسس جهت رفع کامل کندی لود و تأخیر نمایش **بنرهای صفحه اصلی** و **تصاویر دسته‌بندی‌ها** با حفظ کیفیت بصری بالا (Retina / HD WebP) و بارگذاری ۱۰۰٪ مستقیم از سرور ابری پارس‌پک است.

## ۱. عیب‌یابی ریشه‌ای: چرا بنرها و دسته‌بندی‌های صفحه اصلی کند دیده می‌شدند؟

1. **مخفی ماندن بنر اصلی پشت `opacity-0` تا پایان Hydration جاوااسکریپت (`HeroBannerImage.tsx`):**
   - در کد فعلی `HeroBannerImage.tsx` (خط ۱۴۹)، تگ `<img>` بنر با کلاس `loaded ? "opacity-100" : "opacity-0"` رندر می‌شود و یک لایه اسکلتون روی آن قرار دارد.
   - چون در رندر سمت سرور (SSR) مقدار اولیه `loaded` برابر `false` است، حتی اگر مرورگر عکس بنر را در ۱۰۰ میلی‌ثانیه اول دانلود کند، تا زمانی که کل باندل‌های جاوااسکریپت صفحه دانلود و Hydrate نشوند و `useEffect` (یا تایمر ۱۲۰۰ میلی‌ثانیه‌ای خط ۷۲!) اجرا نشود، تصویر بنر مخفی (`opacity-0`) می‌ماند و بعد تازه یک انیمیشن ۵۰۰ میلی‌ثانیه‌ای شروع می‌شود.
2. **مخفی ماندن دایره‌های دسته‌بندی پشت `opacity: 0` و درخواست تکراری شبکه (`HomeCategoryShowcase.tsx`):**
   - در کامپوننت `CircleImage` (خط ۴۰)، تگ `<img>` دارای `style={{ opacity: phase === "loaded" ? 1 : 0 }}` است. در SSR مقدار اولیه `phase` برابر `"skeleton"` است؛ بنابراین تمام تصاویر دسته‌بندی در HTML اولیه با `opacity: 0` (سفید خالی) به مرورگر فرستاده می‌شوند و فاقد `loading="eager"` و `fetchPriority="high"` هستند.
   - همچنین در خط ۶۰، گزینه `revalidateOnMount: true` در `useSWR` باعث می‌شود با وجود اینکه سرور لیست دسته‌بندی‌ها را در SSR فرستاده، مرورگر در لحظه ورود دوباره درخواست `/api/categories/homepage` بزند.
3. **رقابت ۹ تا ۱۰ اسلاید کلون در `SwiperSlider.tsx` روی پهنای باند بنر اول و نبود `<link rel="preload">` در `page.tsx`:**
   - در `SwiperSlider.tsx` برای ساختن حلقه بی‌نهایت، ۳ تا ۵ نسخه کپی از تمام بنرها (۹ تا ۱۰ اسلاید) هم‌زمان در DOM قرار می‌گیرند و مرورگر در لحظه ورود هم‌زمان شروع به دانلود چند بنر سنگین می‌کند که سرعت دانلود **بنر اول** را به‌شدت کاهش می‌دهد.
   - همچنین در `page.tsx` هیچ تگ `<link rel="preload" as="image" fetchPriority="high">` برای بنر اول و دسته‌بندی‌های بالای صفحه در خروجی سرور وجود نداشت.
4. **حجم بسیار بالای فایل‌های بنر و دسته‌بندی در پارس‌پک (`BannersPage.jsx`، `CategoriesPage.jsx` و فایل‌های قدیمی):**
   - در `admin/src/pages/content/BannersPage.jsx` (خط ۲۰۶ و ۴۰۶)، سقف بهینه‌سازی روی **۲ مگابایت (`RECOMMENDED_BANNER_UPLOAD_SIZE_MB = 2`)** تنظیم شده بود؛ یعنی بنرهای ۱ تا ۱.۹ مگابایتی بدون هیچ فشرده‌سازی آپلود می‌شدند!
   - در `admin/src/pages/products/CategoriesPage.jsx`، تصاویر و آیکون‌های دسته‌بندی بدون فشرده‌سازی کلاینت ارسال می‌شدند و در بک‌اند (`categoryController.js`) هم به جای ابعاد واقعی رتینای دایره دسته‌بندی (`320x320` برای تصویر و `160x160` برای آیکون)، با سقف ۱۲۰۰×۱۲۰۰ ذخیره می‌شدند.
   - اسکریپت `optimize-existing-s3-images.js` در فاز قبل فقط جدول `Product` را بهینه کرده بود و جداول `Banner`، `Category` و `Brand` موجود در پارس‌پک هنوز با همان حجم‌های سنگین قبلی باقی مانده بودند.

## ۲. لیست ۱۶ فایل تغییریافته در این فاز

| ردیف | بخش | مسیر فایل | اقدام انجام‌شده |
| :--- | :--- | :--- | :--- |
| ۱ | فرانت‌اند | `frontend/src/components/home/HeroBannerImage.tsx` | حذف `opacity-0` در SSR (نمایش آنی Progressive به محض رسیدن اولین بایت‌ها از پارس‌پک)، انتقال اسکلتون به لایه زیرین (`z-0`) و تنظیم `decoding="sync"` برای بنر اول. |
| ۲ | فرانت‌اند | `frontend/src/components/home/SwiperSlider.tsx` | اولویت‌دهی ۱۰۰٪ پهنای باند به اسلاید اول (`isPrimarySlide`) در لحظه ورود و بارگذاری سایر اسلایدها بلافاصله پس از لود اسلاید اول + پشتیبانی از `cardUrl` به‌عنوان نسخه موبایل خودکار در صورت نبود `mobileImage`. |
| ۳ | فرانت‌اند | `frontend/src/components/home/HomeCategoryShowcase.tsx` | حذف `opacity: 0` در SSR از `CircleImage`، افزودن `loading="eager"` و `fetchPriority="high"` برای ۸ دسته‌بندی اول و حذف درخواست تکراری `revalidateOnMount` زمانی که داده از SSR آمده است. |
| ۴ | فرانت‌اند | `frontend/src/app/page.tsx` | افزودن تگ‌های `<link rel="preload" as="image" fetchPriority="high" />` در خروجی سرور برای اولین بنر اسلایدر اصلی (نسخه موبایل و دسکتاپ) و ۶ دسته‌بندی اول. |
| ۵ | فرانت‌اند | `frontend/src/components/home/HeroSection.tsx` | پشتیبانی از `cardUrl` به‌عنوان fallback موبایل در حالت تک‌بنر. |
| ۶ | فرانت‌اند | `frontend/src/components/home/MiddleBannerRail.tsx` | استفاده از نسخه بهینه `cardUrl` (`960x480` با کیفیت `84`) به همراه `backupSrc` برای ۳ بنر تبلیغاتی میانی. |
| ۷ | فرانت‌اند | `frontend/src/components/home/BannerStack.tsx` | استفاده از `cardUrl` با `backupSrc` برای بنرهای میانی. |
| ۸ | فرانت‌اند | `frontend/src/services/bannerService.ts` | افزودن فیلد `cardUrl?: string` به `BannerImage`. |
| ۹ | فرانت‌اند | `frontend/src/services/categoryService.ts` | افزودن فیلد `cardUrl?: string` به `CategoryImage`. |
| ۱۰ | پنل ادمین | `admin/src/pages/content/BannersPage.jsx` | کاهش هدف حجمی بنر از `2MB` به `220KB` (دسکتاپ)، `130KB` (بنر میانی) و `95KB` (موبایل) با حفظ کیفیت بالای WebP (`0.88` تا `0.72`). |
| ۱۱ | پنل ادمین | `admin/src/pages/products/CategoriesPage.jsx` | بهینه‌سازی خودکار تصویر دسته‌بندی (`320x320`، هدف `35KB`) و آیکون دسته‌بندی (`160x160`، هدف `20KB`) در مرورگر ادمین پیش از ارسال. |
| ۱۲ | بک‌اند | `ekgkala-backend/controllers/bannerController.js` | ساخت خودکار نسخه `cardUrl` (`960x480` با کیفیت `84`) در کنار نسخه دسکتاپ (`1920x600` با کیفیت `85`) هنگام آپلود بنر و حفظ `cardUrl` در دیتابیس. |
| ۱۳ | بک‌اند | `ekgkala-backend/routes/uploads.js` | فعال‌سازی `generateCard: true` (`960x480` با کیفیت `84`) در اندپوینت `POST /api/uploads/banner` و بازگرداندن `cardUrl`. |
| ۱۴ | بک‌اند | `ekgkala-backend/controllers/categoryController.js` | تنظیم ابعاد استاندارد رتینا در پارس‌پک برای دسته‌بندی‌ها (`320x320` با کیفیت بالای `86` برای `image` و `160x160` با کیفیت `86` برای `icon`). |
| ۱۵ | بک‌اند | `ekgkala-backend/controllers/brandController.js` | تنظیم ابعاد استاندارد رتینا (`320x160` با کیفیت `86`) برای لوگوی برندها. |
| ۱۶ | بک‌اند | `ekgkala-backend/scripts/optimize-existing-s3-images.js` | ارتقای اسکریپت مهاجرت برای فشرده‌سازی درجا (In-Place) تمامی **بنرها (`Banner`)**، **تصاویر و آیکون‌های دسته‌بندی (`Category`)** و **لوگوهای برند (`Brand`)** موجود در پارس‌پک بدون افت کیفیت بصری. |

## ۳. خلاصه تغییرات کلیدی کدها برای اعمال توسط هوش مصنوعی

### ۳.۱. اصلاح `frontend/src/components/home/HeroBannerImage.tsx`
- تگ `<picture>` را در لایه `z-10` و اسکلتون `animate-pulse` را در لایه `z-0` قرار بده.
- روی تگ `<img>` کلاس `opacity-100` ثابت قرار بده (هرگز از `loaded ? "opacity-100" : "opacity-0"` استفاده نکن تا تصویر در لحظه رسیدن از شبکه بدون منتظر ماندن برای Hydration ری‌اکت دیده شود).
- پراپ `decoding={priority ? "sync" : "async"}` و `fetchPriority={priority ? "high" : "low"}` را تنظیم کن و در `onLoad` علاوه بر `setLoaded(true)`، کال‌بک اختیاری `onBannerLoad?.()` را صدا بزن.

### ۳.۲. اصلاح `frontend/src/components/home/SwiperSlider.tsx`
- یک استیت `const [hydrateSecondarySlides, setHydrateSecondarySlides] = useState(false)` تعریف کن که یا با لود شدن اسلاید اول (`onBannerLoad`)، یا با تغییر اسلاید، و یا حداکثر ۴۵۰ میلی‌ثانیه پس از mount برابر `true` شود.
- در حلقه `ring.map`، متغیر `const isPrimarySlide = !isClone && realIndex === 0` را تعریف کن و تا قبل از `hydrateSecondarySlides === true`، فقط برای `isPrimarySlide` کامپوننت `<HeroBannerImage />` را رندر کن تا در لحظه ورود کاربر، ۱۰۰٪ پهنای باند به بنر اول اختصاص یابد.
- برای `mobileSrc`، در صورتی که `banner.mobileImage` خالی است، از `(banner.image as any)?.cardUrl` استفاده کن.

### ۳.۳. اصلاح `frontend/src/components/home/HomeCategoryShowcase.tsx`
- در کامپوننت `CircleImage`، استایل را روی `style={{ opacity: 1 }}` بگذار و پراپ‌های `loading={priority ? "eager" : "lazy"}`، `fetchPriority={priority ? "high" : "auto"}` و `decoding="async"` را اضافه کن (برای ۸ دسته‌بندی اول `priority={index < 8}`).
- در `useSWR("homepage-categories", ...)`، مقدار `revalidateOnMount: !Array.isArray(categories) || categories.length === 0` و `revalidateOnFocus: false` را تنظیم کن.

### ۳.۴. اصلاح `frontend/src/app/page.tsx`
در ابتدای خروجی JSX کامپوننت `Home()`، تگ‌های `<link rel="preload" as="image" ... fetchPriority="high" />` را برای اولین بنر `main-slider` (موبایل و دسکتاپ) و ۶ تصویر اول `homepageCats` قرار بده تا مرورگر بلافاصله پس از دریافت HTML اولیه، دانلود آن‌ها را از پارس‌پک آغاز کند.

### ۳.۵. اجرای اسکریپت بهینه‌سازی روی بنرها و دسته‌بندی‌های فعلی در پارس‌پک
فایل `ekgkala-backend/scripts/optimize-existing-s3-images.js` اکنون علاوه بر محصولات، جداول `Banner`، `Category` و `Brand` را نیز پیمایش می‌کند و فایل‌های حجیم فعلی در پارس‌پک را با حفظ کیفیت بالا (`quality: 85–86`) در همان آدرس قبلی (In-Place) بهینه می‌سازد.

## ۴. دستورات اجرایی در ترمینال سرور (توسط هوش مصنوعی فول‌اکسس)

پس از جایگزینی فایل‌های موجود در `sgeooole-banner-category-speed-fix.zip` در ریشه پروژه، دستورات زیر را به ترتیب اجرا کن:

```bash
# ۱. اجرای اسکریپت بهینه‌سازی روی بنرها، دسته‌بندی‌ها، برندها و محصولات موجود در پارس‌پک
cd /var/www/ekgkala/ekgkala-backend
node scripts/optimize-existing-s3-images.js

# ۲. بیلد مجدد پنل ادمین و فرانت‌اند
cd /var/www/ekgkala/admin && pnpm run build
cd /var/www/ekgkala/frontend && pnpm run build

# ۳. ری‌استارت سرویس‌ها در PM2
cd /var/www/ekgkala
pm2 reload ecosystem.config.js --env production
```