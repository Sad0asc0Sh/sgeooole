# مهندسی معکوس بنر اصلی دیجی‌کالا (نسخهٔ موبایل) و نگاشت آن به فروشگاه

> سند مرجع فنی برای مکانیزم اسلایدر موبایل.
> تاریخ بررسی: ۱۴۰۵/۰۸/۰۱ (2026-10-23)
> دامنه: فقط بنر اصلی صفحهٔ اصلی `www.digikala.com` در ویوپورت موبایل.
> ابزار: `rea` (کپچر مرورگر) + Playwright برای اندازه‌گیری computed layout.

---

## ۱) روش بررسی و شواهد

| مرحله | ابزار | خروجی |
|---|---|---|
| کپچر صفحهٔ موبایل با بستن مودال آنبوردینگ | `rea capture-browser-scenario` | `../../_re/dk-mobile2-capture.json` |
| استخراج PNG و DOM | اسکریپت محلی | `../../_re/dk2-settle2.png`، `../../_re/dk2-settle2.html` |
| اندازه‌گیری هندسه و پارامترهای Swiper | Playwright + Evaluate | `../../_re/probe-dk-mobile.json`، `../../_re/probe-dk-params.js` |
| بررسی دسکتاپ برای هماهنگی | Playwright در 1440×900 | `../../_re/probe-dk-swipers-desktop.js` |

تنظیمات کپچر:

```json
{
  "viewport": { "width": 428, "height": 932, "device_scale_factor": 2 },
  "locale": "fa-IR",
  "timezone": "Asia/Tehran",
  "service_workers": "allow"
}
```

نکته: صفحهٔ دیجی‌کالا یک مودال تبلیغاتی (`onboarding-modal`) روی محتوا نشان می‌داد؛ پیش از اندازه‌گیری، با کلیک روی «متوجه شدم» بسته شد. بدون این کار، بنر زیر مودال پنهان می‌ماند.

---

## ۲) ساختار DOM

بنر در `<main>` صفحه و بلافاصله زیر هدر قرار دارد:

```html
<div class="flex overflow-hidden relative styles-module-scss-module__MZfnkG__MainHomeTopSlider mt-2 mb-3">
  <div class="relative relative w-full dk-main-slider">
    <div class="swiper swiper-initialized swiper-horizontal swiper-rtl">
      <div class="swiper-wrapper" style="transform: translate3d(...)">
        <div class="swiper-slide swiper-slide-active" style="width: 388.364px; margin-left: 8px;">
          <a class="block h-full w-full h-[180px]" href="/landing/...">
            <div class="w-full ... rounded-md">
              <div role="img" aria-label="..." style="border-radius: 8px; line-height: 0;">
                <picture>
                  <source type="image/webp" srcset="..." sizes="91vw">
                  <source type="image/jpeg" srcset="...">
                  <img ... style="object-fit: cover; border-radius: 8px;">
                </picture>
              </div>
            </div>
          </a>
        </div>
        ...
      </div>
    </div>
  </div>
</div>
```

- کلاس‌ها CSS Module هستند؛ نام‌ها در هر build تغییر می‌کنند. برای شناسایی از `.dk-main-slider` و `.swiper` استفاده کنید.
- تصاویر از `dkstatics-public.digikala.com/digikala-adservice-banners/...` و به‌صورت `<picture>` با WebP و `sizes="91vw"` ارائه می‌شوند.
- ارتفاع اسلاید در HTML با کلاس `h-[180px]` و گردی با `border-radius: 8px` اعمال می‌شود.
- اسلایدهای واقعی دارای `data-swiper-slide-index` هستند و در RTL ترتیب معکوس می‌شوند.

---

## ۳) اندازه‌های مشاهده‌شده (viewport 428×932)

| عنصر | مقدار |
|---|---|
| عرض Swiper | **428px** (تمام عرض) |
| ارتفاع Swiper | **180px** |
| عرض اسلاید فعال | **388.36px** |
| موقعیت x اسلاید فعال | **19.85px** (یعنی ۲۰px از هر طرف) |
| فاصلهٔ بین اسلایدها | **8px** (`margin-left: 8px` در RTL) |
| گوشهٔ گوشه | **8px** |
| object-fit تصویر | `cover` |
| نقطه‌های صفحه‌بندی | **وجود ندارد** (`.swiper-pagination` در DOM نیست) |
| فلش‌ها | **مخفی** (`display: none` روی دکمه‌های selector) |
| ارتفاع اسلاید فعلی | 180px ثابت؛ نه نسبت تصویر |

فرمول عرض اسلاید:

```text
عرض اسلاید = عرض viewport ÷ slidesPerView
388.36 ≈ 428 ÷ 1.1
```

بنابراین ۲۰px از هر طرف بیرون می‌ماند و ۲۰px از اسلایدهای قبلی/بعدی در لبه‌ها دیده می‌شود.

---

## ۴) پارامترهای واقعی Swiper

از `element.swiper.params` در صفحهٔ زنده:

```js
{
  slidesPerView: 1.1,
  spaceBetween: 8,
  centeredSlides: true,
  loop: true,
  speed: 500,
  autoplay: {
    enabled: true,
    delay: 5000,
    waitForTransition: true,
    disableOnInteraction: false,
    pauseOnMouseEnter: false,
    stopOnLastSlide: false
  },
  grabCursor: false,
  effect: 'fade',        // در عمل با slidesPerView 1.1 به‌صورت افقی رندر می‌شود
  initialSlide: 0,
  pagination: false,
  navigation: false
}
```

مشاهدهٔ زمان‌بندی: تغییر اسلاید در بازه‌های حدوداً ۵ ثانیه‌ای رخ می‌داد و انیمیشن ۵۰۰ms بود.

### دسکتاپ (برای هماهنگی)

در viewport 1440×900:

| ویژگی | مقدار |
|---|---|
| عرض Swiper | 1440px (تمام عرض) |
| ارتفاع | 400px |
| slidesPerView | 1 |
| centeredSlides | true |
| spaceBetween | 0 |
| loop | true |
| autoplay delay | 5000ms |
| speed | 500ms |
| pagination / navigation | هر دو فعال |

یعنی مکانیزم پایه (۵ ثانیه، ۵۰۰ms، loop) بین موبایل و دسکتاپ مشترک است؛ فقط تعداد اسلایدهای هم‌زمان، فاصله و کنترل‌ها فرق می‌کند.

---

## ۵) نگاشت به پیاده‌سازی فروشگاه

| ویژگی | دیجی‌کالا (موبایل) | فروشگاه EKG Kala |
|---|---|---|
| فریم | 428×180 تمام عرض | 428×180 تمام عرض |
| اسلاید | 388 با ۲۰px حاشیه | 388.36 با ۱۹.8px حاشیه |
| slidesPerView | 1.1 | 1.1 |
| centeredSlides | true | true |
| فاصله | 8px | 8px |
| ارتفاع | 180px ثابت | 180px ثابت |
| گردی | 8px | 8px |
| چرخش | 5000ms / 500ms | 5000ms / 700ms |
| حلقه | loop (Swiper) | رینگ چندنسخه‌ای: `[all] × 3` + recenter بی‌درنگ |
| فلش/نقطه موبایل | ندارد | ندارد |
| فلش/نقطه دسکتاپ | دارد | دارد |
| تصویر موبایل | منبع مستقل | `mobileImage` مستقل |

### تفاوت‌های عمدی

1. **حلقهٔ چندنسخه‌ای:** Swiper 12 در حالت `loop` با `centeredSlides` و `slidesPerView: 1.1` در RTL اسلایدها را بازچینش می‌کند؛ در اندازه‌گیری محلی، اسلاید فعال در انتهای رینگ قرار می‌گرفت و پیک سمت چپ حذف می‌شد. یک رینگ تک‌کلونی هم در swipe سریع به انتها می‌رسید و فضای خالی تا پایان ترنزیشن دیده می‌شد. بنابراین فروشگاه همهٔ اسلایدها را ۳ بار (برای ۲ اسلاید ۵ بار) رندر می‌کند، از نسخهٔ میانی شروع می‌کند و پس از هر ترنزیشن به نسخهٔ میانی recenter می‌کند. **قفل ناوبری** (یک اسلاید در هر ۷۰۰ms) اجازه نمی‌دهد اسلاید فعال به لبهٔ مطلق رینگ برسد؛ بنابراین هیچ پرش سریع/فضای خالی در انتها رخ نمی‌دهد. نتیجه: پیک دوطرفه، حلقهٔ بدون پرش و سرعت یکنواخت ۷۰۰ms برای همهٔ اسلایدها. (دیجی‌کالا خودش از loop داخلی Swiper استفاده می‌کند و در نسخه/پیکربندی آن، این مشکل دیده نمی‌شود.)
2. **نسبت دسکتاپ:** دیجی‌کالا 1440×400 (3.6:1) دارد؛ فروشگاه طرح فعلی 1911×430 (4.44:1) را حفظ کرده تا با هویت بصری و دارایی‌های موجود هماهنگ بماند.
3. **تصویر موبایل:** دیجی‌کالا از سرویس adservice خودش تصویر موبایل را جدا می‌گیرد؛ فروشگاه فیلد `mobileImage` را در پنل ادمین دارد و با `<picture>` + `source media` فقط یکی را دانلود می‌کند.

### ۵-۱) مرجع مکمل: مکانیزم ناوبری اسنپ‌شاپ

برای رفتار انتهای حلقه و کنترل نرخ کلیک، `www.snappshop.ir` نیز با `rea`/Playwright بررسی شد:

| ویژگی | اسنپ‌شاپ | پیاده‌سازی فروشگاه |
|---|---|---|
| کتابخانه | **Keen Slider** | Swiper 12 + رینگ چندنسخه‌ای |
| حلقه | `loop: true` (بومی) | رینگ چندنسخه‌ای + recenter |
| مدت انیمیشن | `defaultAnimation: { duration: 2000 }` | `speed: 700` ثابت |
| فلش‌ها | `ArrowControl` با `prev()/next()` | `handlePrev/handleNext` با قفل |
| قفل انیمیشن | ندارد؛ Keen کلیک‌های داخل انیمیشن را coalesce می‌کند | قفل صریح: یک اسلاید در هر ۷۰۰ms |
| کنترل صفحه | dot control با `moveToIdx` | نقطه‌ها + قفل ناوبری |
| RTL | `rtl: true` + `data-keen-slider-reverse` | `dir="rtl"` + `slideNext/slidePrev` |

اندازه‌گیری رفتار اسنپ‌شاپ:

- در viewport 1440×900 بنر 1440×408 است و ۱۱ اسلاید `.keen-slider__slide` دارد.
- ۱۰ کلیک سریع با فاصلهٔ ۱۰۰ms روی فلش، در حدود ۱.۴ ثانیه فقط ۳ اسلاید جابه‌جا کرد (۱۰→۹→۸→۷)؛ یعنی Keen اجازه نمی‌دهد هر کلیک یک اسلاید کامل رد کند.
- انیمیشن هر اسلاید با easing نرم حدود ۲ ثانیه طول می‌کشد و `disabled` فلش‌ها در طول انیمیشن `false` می‌ماند؛ کنترل نرخ از دل خود انیمیشن/کتابخانه می‌آید، نه `disabled`.
- برای فروشگاه، به‌جای افزودن کتابخانهٔ جدید، همان اصول پیاده شد: **۷۰۰ms ثابت برای همهٔ اسلایدها** و **قفل ناوبری ۷۰۰ms** (یک اسلاید در هر ترنزیشن). این باعث می‌شود ۱۰ کلیک سریع حداکثر یک اسلاید را جلو ببرد و اسلاید بعدی فقط پس از پایان انیمیشن پذیرفته شود.

شواهد: `../../_re/snappshop-rapid.json`، `../../_re/snappshop-fiber.json`، `../../_re/probe-snappshop-throttle.js`.

---

## ۶) تأییدیهٔ پیاده‌سازی

پیاده‌سازی با Playwright روی نسخهٔ محلی سنجیده شد:

| viewport | Swiper | اسلاید فعال | ارتفاع | گردی | dots |
|---|---|---|---|---|---|
| 428 | 428×180 | 388.4×180 در x=19.8 | 180 | 8px | مخفی |
| 390 | 390×180 | 353.8×180 در x=18.1 | 180 | 8px | مخفی |
| 360 | 360×180 | 326.5×180 در x=16.8 | 180 | 8px | مخفی |
| 768 | 768×172.8 | 768×172.8 | نسبت 1911/430 | 0 | نمایان |
| 1440 | 1440×324 | 1440×324 | نسبت 1911/430 | 0 | نمایان |

پارامترهای استخراج‌شده از نمونهٔ محلی: `slidesPerView=1.1`، `spaceBetween=8`، `centeredSlides=true`، `loop=false` + رینگ چندنسخه‌ای، `delay=5000`، `speed=700` + قفل ناوبری ۷۰۰ms — سازگار با اصول دیجی‌کالا/اسنپ‌شاپ.

---

## ۷) محدودیت‌ها

- دیجی‌کالا A/B test و کمپین‌های فصلی دارد؛ ممکن است اعداد در زمان دیگری تغییر کنند. این سند snapshot همان روز است.
- `effect: 'fade'` در پارامترها دیده می‌شود اما DOM و ترنسفورم‌ها افقی هستند؛ پیاده‌سازی فروشگاه عمداً از effect پیش‌فرض (slide) استفاده می‌کند.
- تصاویر و متن‌های تبلیغاتی دیجی‌کالا متعلق به آن سایت‌اند و در این پروژه استفاده نمی‌شوند؛ فقط مکانیزم و اندازه‌ها الگو گرفته شده است.
- کپچر با `service_workers=allow` انجام شد چون دیجی‌کالا از service worker استفاده می‌کند.

