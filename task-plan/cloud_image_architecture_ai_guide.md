# دستورالعمل پیاده‌سازی سئو تصاویر محصولات در Google Images و رندر SSR کارت‌های محصول (فاز ۳)

این سند بر پایه **آخرین فایل زیپ ارسالی شما (`sgeooole-main.zip`)** تنظیم شده است. در بررسی فایل زیپ جدید شما مشخص شد که:
- **تغییرات فاز ۱ (حذف کش سرور و اتصال مستقیم به پارس‌پک S3)** و **تمام ۱۶ فایل تغییرات فاز ۲ (رفع کندی UX بنرها و دسته‌بندی‌های صفحه اصلی)** به‌طور کامل و دقیق روی پروژه شما اعمال شده‌اند.
- اما **تغییرات سئو تصاویر محصولات برای Google Images (فاز ۳)** هنوز در کد اعمال نشده بود؛ به همین دلیل بنرها در Google Images دیده می‌شدند ولی تصاویر محصولات به ندرت ایندکس می‌شدند.

پکیج `sgeooole-google-images-seo-fix.zip` دقیقاً بر روی آخرین نسخه کد شما ساخته شده و شامل **۱۶ فایل اصلاح‌شده** برای حل قطعی مشکل ایندکس تصاویر محصولات در Google Images است.

---

## ۱. کالبدشکافی فنی: چرا بنرها در Google Images نمایش داده می‌شدند اما تصاویر محصولات به ندرت ایندکس می‌شدند؟

مقایسه خط‌به‌خط معماری **بنرها و دسته‌بندی‌ها** با معماری **کارت‌ها و صفحات محصولات** در کد شما نشان داد که **۷ مانع فنی** باعث شده بود ربات `Googlebot` و `Googlebot-Image` بنرها را ایندکس کند اما تصاویر محصولات را نبیند:

| ردیف | لایه فنی در کد پروژه | وضعیت بنرها (موفق در Google Images) | وضعیت تصاویر محصولات در کد قبلی (ناموفق در Google Images) | اصلاحیه اعمال‌شده در `sgeooole-google-images-seo-fix.zip` |
| :--- | :--- | :--- | :--- | :--- |
| **۱** | **رندر SSR کارت‌ها در صفحه اصلی (`/`)** | بنرها در `app/page.tsx` روی سرور واکشی شده و با `initialBanners={banners}` به `<HeroSection>` و `<MiddleBannerRail>` پاس داده می‌شدند؛ بنابراین تگ `<img src="...">` آن‌ها در HTML اولیه صفحه اول وجود داشت. | کامپوننت‌های `<ProductRailContainer>` («پرفروش‌ترین‌ها» و «جدیدترین‌ها») هیچ پراپ `initialProducts` از سرور نمی‌گرفتند و در HTML اولیه فقط باکس خالی اسکلتون (`animate-pulse`) بدون هیچ تگ `<img>` رندر می‌شد! | واکشی سرور در `app/page.tsx` اکنون با `mapBackendProduct` مپ شده و با پراپ `initialProducts` به `<ProductRailContainer>` و `fallbackData` در `useProducts.ts` داده می‌شود تا تمام کارت‌ها و تگ‌های `<img>` محصولات در HTML اولیه صفحه اصلی رندر شوند. |
| **۲** | **رندر SSR گرید محصولات در `/products` و صفحات دسته‌بندی** | هدر، فوتر و لوگو به‌صورت SSR رندر می‌شدند. | در `app/products/page.tsx` سرور لیست محصولات را با `fetchServerListing` می‌گرفت اما **آن را به `<ProductsPageClient />` پاس نمی‌داد**! در نتیجه در HTML اولیه `/products` فقط `<ProductListingSkeleton />` (صفر تگ `<img>`) و کارت‌های با `initial={{ opacity: 0 }}` رندر می‌شد. | پاس دادن `initialListing={listing}` از `app/products/page.tsx` به `<ProductsPageClient />` و `useProductListing.ts` (`fallbackData`) + حذف `initial={{ opacity: 0 }}` در `ProductsPageClient.tsx` و افزودن تگ `<img>` و فیلد `image` به اسکیمای `ItemList`. |
| **۳** | **خطای شبکه کلاینت در رندرر گوگل (`lib/api.ts`)** | دسته‌بندی‌ها و بنرها داده اولیه SSR داشتند. | در `lib/api.ts` در نبود متغیر محیطی، آدرس کلاینت روی `http://127.0.0.1:5000/api` می‌افتاد و در رندرر گوگل (WRS) پیام **«بارگذاری محصولات انجام نشد»** جایگزین لیست محصولات می‌شد. | تغییر Fallback سمت مرورگر در `frontend/src/lib/api.ts` از `http://127.0.0.1:5000/api` به مسیر نسبی `"/api"` و حفظ داده SSR در `fallbackData`. |
| **۴** | **مخفی بودن اولین گالری محصول در موبایل (`ProductDetailClient.tsx`)** | بنرها فقط یک بار و در контейنر مرئی رندر می‌شدند. | در `ProductDetailClient.tsx` ابتدا چیدمان دسکتاپ (`<div className="hidden lg:block">`) و سپس چیدمان موبایل (`<div className="lg:hidden">`) در DOM قرار داشت. چون `Googlebot Smartphone` با ویوپورت موبایل خزش می‌کند، اولین `<ProductGallery>` و اولین `<h1>` در DOM دارای `display: none` (ابعاد `0x0`) بودند! | جابه‌جایی ترتیب DOM در `ProductDetailClient.tsx` به صورت **Mobile-First** (قرار گرفتن بلوک موبایل قبل از دسکتاپ) تا اولین `<ProductGallery>` و اولین `<h1>` در خزنده موبایل گوگل کاملاً مرئی باشند. |
| **۵** | **حذف تصاویر محصولات متغیر (`variants[].images`)** | بنرها تک‌تصویری بودند. | در محصولات متغیری که تصاویرشان در `variants[].images` ذخیره شده بود، فایل‌های `sitemap.ts`، `productData.ts`، `productService.ts` و `ProductStructuredData.tsx` فقط `product.images` را می‌خواندند و برای آن‌ها `/placeholder.svg` یا آرایه خالی ثبت می‌کردند. | استخراج خودکار تصاویر از `product.images`، `product.image` و `product.variants[].images` در `sitemap.ts`، `productData.ts`، `productService.ts`، `ProductStructuredData.tsx` و `product/[...segments]/page.tsx`. |
| **۶** | **تزریق استایل SVG Base64 روی تگ `<img>` محصولات (`ResilientImage.tsx`)** | کامپوننت `HeroBannerImage.tsx` بدون `placeholder="blur"` تگ `<img>` تمیز تولید می‌کرد. | کامپوننت `ResilientImage.tsx` به صورت پیش‌فرض `placeholder="blur"` با SVG خاکستری Base64 به `next/image` می‌داد که در HTML سرور استایل `background-image:url(data:image/svg+xml;base64,...)` را روی عکس‌های محصول تزریق می‌کرد. | تنظیم `placeholder="empty"` هنگام فعال بودن `unoptimized: true` در `ResilientImage.tsx` (در حالی که اسکلتون `<span>` پشت تصویر حفظ شده است) + غنی‌سازی متن `alt` در `ProductCard.tsx` و `HomeProductCard.tsx`. |
| **۷** | **دسترسی عمومی باکت پارس‌پک (`Public-Read`)** | بنرهای کش‌شده موقتاً دیده می‌شدند. | ربات `Googlebot-Image` برای ایندکس کردن تصاویر **الزاماً به دسترسی عمومی (`Public-Read` / HTTP 200)** نیاز دارد و با Private کردن باکت در پارس‌پک، خطای `403 Forbidden` دریافت کرده و تصاویر را از Google Images حذف می‌کند. | باکت پارس‌پک باید حتماً روی حالت **Public** باقی بماند. |

---

## ۲. فهرست ۱۶ فایل موجود در `sgeooole-google-images-seo-fix.zip`

| ردیف | مسیر فایل در پروژه | خلاصه تغییرات اعمال‌شده |
| :--- | :--- | :--- |
| ۱ | `frontend/src/lib/api.ts` | اصلاح Fallback آدرس API سمت مرورگر از `http://127.0.0.1:5000/api` به `"/api"`. |
| ۲ | `frontend/src/lib/productData.ts` | استخراج خودکار تصاویر متغیرها (`variants[].images`) در صورتی که آرایه ریشه `images` خالی باشد. |
| ۳ | `frontend/src/services/productService.ts` | همگام‌سازی مپر کلاینت با `productData.ts` برای پشتیبانی از تصاویر متغیرها. |
| ۴ | `frontend/src/hooks/useProducts.ts` | افزودن پارامتر `initialData?: Product[]` و `fallbackData` به `useNewestProducts` و `useBestSellers`. |
| ۵ | `frontend/src/hooks/useProductListing.ts` | افزودن پارامتر `initialData?: ProductListingResult \| null` و `fallbackData` به `useProductListing`. |
| ۶ | `frontend/src/components/home/ProductRailContainer.tsx` | دریافت پراپ `initialProducts` از سرور و تحویل به هوک‌های SWR جهت رندر SSR کارت‌ها و تصاویر محصولات در صفحه اول. |
| ۷ | `frontend/src/components/home/HomeProductCard.tsx` | ارتقای متن `alt` تصاویر کارت محصولات صفحه اصلی (`خرید {نام} برند {برند} \| ای کا جی کالا`). |
| ۸ | `frontend/src/components/product/ProductCard.tsx` | ارتقای متن `alt` تصاویر کارت محصولات در لیست‌ها و دسته‌بندی‌ها. |
| ۹ | `frontend/src/components/ui/ResilientImage.tsx` | حذف تزریق SVG Base64 (`placeholder="blur"`) روی تگ `<img>` در حالت `unoptimized: true` برای خروجی تمیز SSR. |
| ۱۰ | `frontend/src/app/page.tsx` | پاس دادن `initialProducts` به ریل‌های «پرفروش‌ترین‌ها» و «جدیدترین‌ها» + افزودن تگ `<img>` داخل `<nav className="sr-only">`. |
| ۱۱ | `frontend/src/app/products/page.tsx` | مپ کامل محصولات در `fetchServerListing`، پاس دادن `initialListing` به `<ProductsPageClient />`، افزودن فیلد `image` به اسکیمای `ItemList` و تگ `<img>` به `<nav className="sr-only">`. |
| ۱۲ | `frontend/src/app/products/ProductsPageClient.tsx` | دریافت `initialListing` و حذف `initial={{ opacity: 0 }}` از کارت‌های محصول در SSR. |
| ۱۳ | `frontend/src/app/product/[...segments]/page.tsx` | افزودن `<link rel="preload" as="image" fetchPriority="high">` برای تصویر اصلی محصول و ثبت تمام تصاویر محصول و متغیرها در `openGraph.images` و `twitter.images`. |
| ۱۴ | `frontend/src/app/product/[...segments]/ProductDetailClient.tsx` | چیدمان Mobile-First در DOM (قرار گرفتن بلوک موبایل قبل از بلوک `hidden lg:block`) تا اولین گالری عکس و `<h1>` برای `Googlebot Smartphone` مرئی باشد. |
| ۱۵ | `frontend/src/app/product/[...segments]/ProductStructuredData.tsx` | ثبت تمامی تصاویر اصلی و تصاویر متغیرها (`variants[].images`) در آرایه `image` اسکیمای `Product`. |
| ۱۶ | `frontend/src/app/sitemap.ts` | ثبت تمامی تصاویر اصلی و تصاویر متغیرها (`variants[].images`) در تگ‌های `<image:image>` نقشه سایت (`/sitemap.xml`). |

---

## ۳. دستورات اجرا توسط هوش مصنوعی فول‌اکسس

پس از استخراج و جایگزینی ۱۶ فایل موجود در `sgeooole-google-images-seo-fix.zip` در ریشه پروژه، دستورات زیر را اجرا کنید:

```bash
# ۱. در صورتی که هنوز اسکریپت بهینه‌سازی بنرها، دسته‌بندی‌ها و محصولات روی پارس‌پک را اجرا نکرده‌اید:
cd /var/www/ekgkala/ekgkala-backend
node scripts/optimize-existing-s3-images.js

# ۲. بیلد مجدد فرانت‌اند و ری‌استارت PM2:
cd /var/www/ekgkala/frontend
rm -rf .next
pnpm run build
pm2 reload all --update-env
```