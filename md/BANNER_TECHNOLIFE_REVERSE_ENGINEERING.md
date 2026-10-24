# مهندسی معکوس بنر اصلی Technolife و نقشهٔ پیاده‌سازی در EKG Kala

> ⚠️ **این سند تاریخی است.** مکانیزم موبایل فروشگاه در ۱۴۰۵/۰۸/۰۱ بازطراحی شد و
> جای آن را الگوی موبایل دیجی‌کالا گرفت: اسلاید ۳۸۸×۱۸۰ با پیک ۲۰px، ارتفاع ثابت
> ۱۸۰px، فاصلهٔ ۸px و چرخش ۵ ثانیه‌ای. برای مرجع فعلی،
> `BANNER_ADMIN_GUIDE.md` و `BANNER_DIGIKALA_MOBILE_MECHANISM.md` را ببینید.
> اعداد ۳۶۰×۲۶۰ و `aspect-[360/260]` دیگر در فروشگاه استفاده نمی‌شوند.
>
> سند مرجع برای بازطراحی «اسلایدر اصلی» در پنل ادمین و فروشگاه.
> تاریخ بررسی: ۱۴۰۵/۰۸/۰۱ (2026-10-23)
> دامنه: `www.technolife.com` — فقط بنر اصلی (Hero / SlideBanner) و نه بنرهای میانی.

---

## ۱) روش بررسی و شواهد

بررسی با چهار منبع مستقل انجام شد تا نتیجه به یک اسکرین‌شات یا حدس وابسته نباشد:

1. **کپچر مرورگر با ابزار `rea`**
   - `rea capture-browser-scenario` در ویوپورت `1907×649` (نسبت تصویر ارسالی کاربر)، با `locale=fa-IR` و `timezone=Asia/Tehran`.
   - شاهد: `_re/capture-desktop.json` و اسکرین‌شات `_re/technolife-desktop.png` (SHA-256: `ce7aeb49…f254ae3129`).
2. **HTML سرور برای دسکتاپ و موبایل**
   - دسکتاپ: `_re/technolife-home.html` (User-Agent معمولی).
   - موبایل: `_re/technolife-mobile.html` (User-Agent آیفون).
   - نکتهٔ کلیدی: سرور برای موبایل، HTML و **فایل تصویر متفاوتی** برمی‌گرداند؛ این یک نسخهٔ CSS-crop ساده نیست.
3. **CSSهای هر دو نسخه**
   - `_re/css1.css`، `_re/css2.css`، `_re/css-mobile.css` — قاعدهٔ مشترک:
     `.responsive-image { width:100%; height:100%; position:relative }`.
4. **باندل‌های React/Next.js**
   - `_re/chunks/*` (نسخهٔ دسکتاپ) و `_re/index-mobile-chunk.js` (نسخهٔ موبایل).
   - کامپوننت‌های کلیدی: ماژول `45907` (AspectRatio)، `47602` (ResponsiveImage)، `22717` (Hero Slider)، و صفحهٔ `pages/index` که `width/height` را پاس می‌دهد.

---

## ۲) مشخصات قطعی بنر اصلی

| ویژگی | دسکتاپ | موبایل |
|---|---|---|
| اندازهٔ هنری (Creative) | **1911 × 430 px** | **360 × 260 px** |
| نسبت تصویر | **4.4444 : 1** (تقریباً 40:9) | **1.3846 : 1** (تقریباً 18:13) |
| درصد ارتفاع نسبت به عرض | **22.5013%** | **72.2222%** |
| فایل تصویر | `banner_SlideBanner_*` | `banner_SlideBannerMobile_*` |
| رفتار تصویر | `object-fit: contain` | `object-fit: contain` |
| بارگذاری اول | `loading="eager"` + `fetchpriority="high"` + `<link rel="preload" as="image">` | همان |
| بقیهٔ اسلایدها | `loading="lazy"` + `fetchpriority="auto"` | همان |

اعداد از HTML واقعی استخراج شده‌اند؛ مثلاً در دسکتاپ:

```html
<div class="w-full relative overflow-hidden" style="padding-top:22.50130821559393%">
  <div class="absolute inset-0 w-full h-full">
    <a href="...">
      <div class="w-full relative" style="padding-top:22.50130821559393%">
        <div class="absolute inset-0 w-full h-full">
          <img class="responsive-image object-contain" width="1911" height="430" ... />
        </div>
      </div>
    </a>
  </div>
</div>
```

و در موبایل همان ساختار با `padding-top:72.22222222222221%` و `width="360" height="260"`.

---

## ۳) سازوکار ریسپانسیو: Art Direction، نه فقط Resize

Technolife سه کار را هم‌زمان انجام می‌دهد:

1. **تشخیص دستگاه در سرور**: با User-Agent، دو نسخهٔ صفحه (و در عمل دو باندل) سرو می‌شود. موبایل به‌جای تصویر ۱۹۱۱×۴۳۰، تصویر ۳۶۰×۲۶۰ با ترکیب‌بندی مستقل می‌گیرد.
2. **نسبت تصویر متفاوت در CSS**: نسبت با یک wrapper و `padding-top` درصدی تعریف می‌شود. چون درصد `padding-top` نسبت به **عرض** محاسبه می‌شود، ارتفاع همیشه با عرض تغییر می‌کند و هیچ `height` ثابتی وجود ندارد.
3. **جلوگیری از اعوجاج**: تصویر با `object-fit: contain` داخل کادری با همان نسبت قرار می‌گیرد. بنابراین نه کشیده می‌شود و نه بخشی از آن به‌خاطر نسبت اشتباه بریده می‌شود.

فرمول عمومی:

```text
padding-top (%) = (ارتفاع طراحی ÷ عرض طراحی) × 100

دسکتاپ: 430 / 1911 × 100 = 22.5013%
موبایل: 260 / 360  × 100 = 72.2222%
```

### چرا این روش از `height: 360px` بهتر است؟

- هیچ **CLS** (پرش چیدمان) رخ نمی‌دهد؛ مرورگر قبل از دانلود تصویر فضای دقیق را رزرو می‌کند.
- در هر عرضی (۳۲۰ تا ۲۵۶۰ پیکسل) نسبت حفظ می‌شود.
- با تغییر breakpoint، نسبت و منبع تصویر با هم عوض می‌شوند؛ نه اینکه یک تصویر بزرگ در موبایل کوچک شود.

---

## ۴) معماری کامپوننت در React

صفحهٔ اصلی، دادهٔ بنر را از CMS/GraphQL می‌گیرد و به کامپوننت `SlideBanner` می‌دهد:

```jsx
// دسکتاپ
<HomePageSlider width={1911} height={430} images={slideBanner} id="home_page_slider" />

// موبایل
<HomePageSlider width={360} height={260} images={slideBannerMobile} id="home_page_slider" />
```

کامپوننت سه لایه دارد:

### ۴-۱) `AspectRatio` (ماژول 45907)

```jsx
const padding = Math.max(0, aspect) * 100; // aspect = height / width
<div className="w-full relative" style={{ paddingTop: `${padding}%` }}>
  <div className="absolute inset-0 w-full h-full">{children}</div>
</div>
```

### ۴-۲) `ResponsiveImage` (ماژول 47602)

```jsx
<AspectRatio aspect={height / width}>
  <img
    width={width}
    height={height}
    loading={priority ? "eager" : "lazy"}
    fetchpriority={priority ? "high" : "auto"}
    className="responsive-image object-contain"
    src={src}
  />
</AspectRatio>
```

### ۴-۳) اسلایدر و SSR

- در HTML اولیه (SSR)، **همهٔ اسلایدها** به‌صورت استک‌شده رندر می‌شوند تا حتی بدون جاوااسکریپت، اولین تصویر LCP در HTML باشد.
- بعد از hydration، `Swiper` جایگزین نسخهٔ استاتیک می‌شود.
- برای اولین تصویر، تگ `<link rel="preload" as="image" href={firstImage}>` در `<head>` تزریق می‌شود.
- هر اسلاید غیرفعال هنگام رندر `height: 0` می‌گیرد تا فقط اسلاید فعال در ارتفاع شرکت کند.

---

## ۵) تنظیمات اسلایدر (Swiper)

از باندل استخراج شد:

```js
{
  modules: [Autoplay, Pagination, Navigation, Lazy],
  slidesPerView: "auto",
  loop: true,
  lazy: true,
  autoplay: {
    delay: 6000,
    disableOnInteraction: false,
    pauseOnMouseEnter: true
  },
  pagination: {
    clickable: true,
    bulletClass: "bullet-slider",
    bulletActiveClass: "active-bullet-slider"
  }
}
```

نکات رفتاری:

- چرخش هر **۶ ثانیه**.
- توقف موقت با ورود ماوس، ادامه با خروج.
- تعامل کاربر (کلیک/سوایپ) autoplay را برای همیشه قطع نمی‌کند.
- فلش‌ها فقط در دسکتاپ و فقط هنگام hover روی بنر دیده می‌شوند (`opacity-0` → `group-hover:opacity-100`).
- نقاط (bullets) همیشه قابل کلیک‌اند.
- کلیک روی اسلاید، کاربر را به لینک می‌برد؛ در دسکتاپ `target="_blank"` و در موبایل `_self`.

---

## ۶) چک‌لیست طراحی و آپلود بنر

### دسکتاپ (1911×430)

- ترکیب‌بندی افقی و ultra-wide.
- متن اصلی در **۸۰٪ مرکزی**؛ در حاشیه‌های چپ/راست متن ریز و کم‌اهمیت نگذارید.
- پس‌زمینهٔ یکدست یا گرادیان ملایم در لبه‌ها.
- فرمت WebP (اولویت) یا JPG با کیفیت ۸۰–۸۵.
- حجم هدف: زیر **۵۰۰KB**؛ سقف عملی: ۲MB.

### موبایل (360×260)

- **تصویر جداگانه** بسازید؛ صرفاً نسخهٔ کوچک‌شدهٔ دسکتاپ نباشد.
- متن و CTA را بزرگ‌تر و در مرکز بگذارید.
- از جزئیات ریز و متن‌های چندخطی پرهیز کنید.
- همان قواعد فرمت و حجم.

### قواعد مشترک

- نسبت تصویر باید دقیقاً مطابق کادر باشد؛ وگرنه یا بریده می‌شود یا حاشیه می‌گیرد.
- برای هر اسلاید، `alt` توصیفی بنویسید (نام محصول/کمپین).
- اولین اسلاید، LCP صفحه است؛ سبک‌ترین و مهم‌ترین بنر را اول بگذارید.
- از انیمیشن‌های سنگین یا ویدیو در اسلاید اول پرهیز کنید.
- لینک مقصد را قبل از فعال‌سازی تست کنید.

---

## ۷) نقشهٔ پیاده‌سازی در EKG Kala

| لایه | تغییر |
|---|---|
| مدل `Banner` | افزودن `mobileImage`، `alt`، `mobileAlt`، `fit`، `openInNewTab` و ابعاد تصویر |
| API بنر | پذیرش هم‌زمان تصویر دسکتاپ و موبایل (JSON یا multipart)، حذف امن هر دو فایل |
| فروشگاه | `<picture>` با `getImageProps` و `source media`؛ نسبت‌های `1911/430` و `360/260`؛ `object-fit` قابل تنظیم |
| اسلایدر | Swiper با autoplay 6s، توقف روی hover، bullets سفارشی، فلش‌های دسکتاپ، A11y |
| پنل ادمین | دو ناحیهٔ آپلود مستقل، پیش‌نمایش زندهٔ دسکتاپ/موبایل، هشدار نسبت تصویر، نمایش ناحیهٔ امن |
| کش | همان کش ۳۰۰ ثانیه‌ای فعلی + پاک‌سازی پس از تغییر |

هدف: تصویر موبایل هرگز از تصویر دسکتاپ بریده نشود، نسبت‌ها ثابت بمانند و تجربهٔ LCP بدون پرش باشد.

---

## ۸) منابع

- `_re/technolife-home.html` — نسخهٔ دسکتاپ، مارک‌آپ بنر و `padding-top:22.5013%`
- `_re/technolife-mobile.html` — نسخهٔ موبایل، `padding-top:72.2222%` و فایل `SlideBannerMobile`
- `_re/css1.css` — قاعدهٔ `.responsive-image`
- `_re/chunks/index-c550214bcbad27c8.js` — فراخوانی `width:1911,height:430`
- `_re/index-mobile-chunk.js` — فراخوانی `width:360,height:260`
- `_re/capture-desktop.json` + `_re/technolife-desktop.png` — شاهد بصری `rea`
