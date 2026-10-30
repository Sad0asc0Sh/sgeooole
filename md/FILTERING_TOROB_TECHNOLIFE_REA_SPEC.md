# سند شواهد REA — موتور فیلترینگ ترب و تکنولایف
## و نگاشت آن به معماری `sgeooole` (EKG Kala)

> **وضعیت سند:** شواهد-محور. هر ادعا با شناسه‌ی Evidence، فایل خام، یا هش SHA-256 قابل ردیابی است.
> هر چیزی که مشاهده نشد، صریحاً «مشاهده‌نشده» علامت خورده و حدس زده نشده است.

- **تاریخ اجرا:** 2026-10-30 (America/Los_Angeles)
- **ابزار:** REA `rea-agents@6.8.0` (`capture-browser-scenario`), Playwright/Chromium 156.0.4314.50 (Microsoft Edge)
- **محیط هر کپچر:** `locale=fa-IR`, `timezone=Asia/Tehran`, `color_scheme=light`, `reduced_motion=reduce`, `service_workers=block`
- **پوشه‌ی شواهد:** `_re/filtering/`
- **مخزن ابزار:** `https://github.com/Sad0asc0Sh/rea.git` (فورک فعال؛ نسخه‌ی نصب‌شده ۶.۸.۰)

---

## ۱) فهرست شواهد خام

| # | فایل | توضیح | اندازه |
|---|---|---|---|
| E1 | `technolife-category-desktop.capture.stdout.json` | کپچر کامل دسکتاپ ۱۴۴۰×۹۰۰ صفحه‌ی لیست تکنولایف + بدنه‌ی پاسخ‌های شبکه | 8.5 MB |
| E2 | `technolife-category-desktop.dom.html` | DOM نهایی دسکتاپ (SHA-256 `b4e1970f…6ceb4`) | 1.52 MB |
| E3 | `technolife-category-desktop.a11y.txt` | درخت Accessibility دسکتاپ | 100 KB |
| E4 | `technolife-category-mobile.capture.stdout.json` | کپچر موبایل ۴۲۸×۹۳۲ (DSF 2) | 3.4 MB |
| E5 | `technolife-category-mobile.dom.html` | DOM نهایی موبایل (SHA-256 `10078112…3f14`) | 1.52 MB |
| E6 | `technolife-desktop-nextdata.json` | استخراج `__NEXT_DATA__` | 2.08 MB |
| E7 | `tl-q2-*.json` | پاسخ GraphQL `get_menu_filters` (منبع فست‌ها) | 42 KB |
| E8 | `torob-browse.capture.stdout.json` | کپچر ترب — **مسدود** | 603 KB |
| E9 | `torob-browse.dom.html` | صفحه‌ی چالش ربات ترب | 277 KB |
| E10 | `technolife-category-desktop.body.png` | اسکرین‌شات ۱۴۴۰×۹۰۰ (SHA-256 `e97cb74d…3ad9`) | 281 KB |
| E11 | `technolife-category-mobile.body.png` | اسکرین‌شات ۴۲۸×۹۳۲ | 8.5 KB |
| E12 | `technolife-category-desktop.network.json` | ۱۱۰ تراکنش شبکه‌ی دسکتاپ | 54 KB |
| E13 | `torob-search-sample.json` | پاسخ واقعی `api.torob.com/v4/base-product/search/` (HTTP 200) | 60 KB |
| E14 | `torob-cctv.json` | جستجوی «دوربین مداربسته» با فست برند + `attributes` | 64 KB |
| E15 | `torob-cat94.json` | جستجوی `category_id=94` — پارامتر نادیده گرفته شد | 75 KB |
| E16 | `torob-api-retry.scenario.json` | سناریوی بازتولید کپچر API ترب | — |
| E17 | `torob-cctv-query.scenario.json` | سناریوی جستجوی متنی ترب | — |
| E18 | `torob-extract.cjs` / `torob-json.cjs` | ابزار استخراج و خلاصه‌سازی JSON ترب | — |
| E19 | `torob-cctv-leaf.json` / `torob-cctv-slug.json` | تلاش `category_id=1105` و `category_slug` — هر دو نادیده گرفته شدند | 75 KB |

**Evidence ID های REA:**
- تکنولایف دسکتاپ: `ev_8b3b8257468a70740273283e1792b9d68329c9a5cc199827425f6cbe82c18d13`
- ترب (سند مسدود): `ev_239af6b51f338f6dd435586965d494b8abd17440edf8f4402a741ed0a1ba6ad0`
- ترب (API، موفق): کپچرهای `torob-*` در همین پوشه

---

## ۲) ترب: سند مسدود، اما API باز شد

### ۲.۱. آنچه مسدود است

صفحه‌های **سند** (`www.torob.com`) پشت کپچای Arcaptcha هستند و با مرورگر واقعی هم ۴۹۰ می‌دهند:

| تلاش | نتیجه |
|---|---|
| `Invoke-WebRequest` → `https://www.torob.com/` | HTTP **490** |
| `Invoke-WebRequest` → `https://www.torob.com/browse/` | HTTP **490** |
| Chromium واقعی (REA) → `https://www.torob.com/browse/` | `request-1` = **HTTP 490** |

شاهد قاطع (E9): `<title>آیا شما یک ربات هستید؟ | ترب</title>` — نشانگرهای `arcaptcha` ×۱۵ و `ربات` ×۵، منابع `widget.arcaptcha.ir` و `bowman.arcaptcha.ir`.

### ۲.۲. آنچه باز شد — و چطور

**میزبان API (`api.torob.com`) مسدود نیست.** وقتی مرورگر واقعی مستقیماً روی خودِ اندپوینت API می‌نشیند، پاسخ **HTTP 200** با JSON کامل برمی‌گردد:

```
start_url = https://api.torob.com/v4/base-product/search/?page=0&size=2&source=next_desktop
→ 200 OK, 13 KB JSON, count=1200
```

نکته‌ی روشی: با `Invoke-WebRequest` همین URL هم ۴۹۰ می‌دهد؛ فقط مرورگر واقعی (Chromium 156 با TLS/UA کامل) عبور می‌کند. پس «مسدود بودن ترب» یک حکم کلی نبود و اصلاح شد.

### ۲.۳. Schema واقعی پاسخ جستجو (E13، E14)

```jsonc
{
  "results": [ { "name1": "...", "name2": "...", "price": 0, "stock_status": "موجود", "has_variant": true, "more_info_url": "..." } ],
  "count": 1200,
  "min_price": 63,
  "max_price": 2373964000,

  "filters1": [
    { "title": "قیمت", "slug": "price", "type": "price",
      "items": [ { "value": 270000, "slug": "price__gt" }, { "value": 1049375000, "slug": "price__lt" } ] },
    { "title": "انتخاب برند", "slug": "brand", "type": "brand",
      "items": [ { "id": 2661, "slug": "dahua-داهوا", "name1": "داهوا", "name2": "Dahua" },
                 { "id": 1101, "slug": "hikvision-هایک-ویژن", "name1": "هایک ویژن", "name2": "Hikvision" } ] },
    { "title": "دسته‌بندی", "slug": "category", "type": "category", "items": [] },
    { "title": "جستجو در نتایج", "slug": "q", "type": "query" }
  ],

  "filters2": [
    { "title": "خرید قسطی ترب‌پی", "slug": "torobpay", "type": "toggle" },
    { "title": "امکان خرید حضوری", "slug": "shop_type", "type": "shop_type",
      "items": [ { "name": "محصولات دارای فروشنده حضوری", "value": "offline" } ] },
    { "title": "وضعیت کارکرد", "slug": "stock_status", "type": "single_choice",
      "items": [ { "name": "نو", "value": "new" }, { "name": "کارکرده", "value": "stock" } ] },
    { "title": "فقط موجودها", "slug": "available", "type": "toggle" },
    { "title": "مرتب‌سازی", "slug": "sort", "type": "dropdown",
      "items": [ { "name": "محبوب‌ترین", "value": "" }, { "name": "ارزان‌ترین", "value": "price" },
                 { "name": "گران‌ترین", "value": "-price" }, { "name": "جدیدترین", "value": "-date" },
                 { "name": "بیشترین فروشنده", "value": "-supply" } ] }
  ],

  "attributes": [
    { "title": "انتخاب برند", "slug": "brand", "type": "brand", "items": [ /* 51 برند */ ] },
    { "title": "امکان خرید حضوری", "slug": "shop_type", "type": "shop_type", "items": [ /* 1 */ ] },
    { "title": "وضعیت کارکرد", "slug": "stock_status", "type": "single_choice", "items": [ /* 2 */ ] }
  ],

  "categories": [
    { "title": "دوربین مدار بسته", "cat_id": 1105, "cat_slug": "دوربین-مدار-بسته",
      "brand_id": null, "brand_slug": null, "id": "1105", "slug": "دوربین-مدار-بسته" }
  ],
  "parent_categories": [ /* ... */ ],
  "available_filters": [],
  "category_is_leaf": false,
  "filter_by_category_title": "...",
  "spellcheck": { "is_spellchecked": false, "initial_query": "...", "corrected_query": null },
  "canonical_url": "...", "seo_title": "...", "seo_description": "..."
}
```

### ۲.۴. یافته‌های کلیدی ترب

1. **تاکسونومی نوع فست صریح است:** `price` | `brand` | `category` | `query` | `toggle` | `shop_type` | `single_choice` | `dropdown`. این دقیقاً همان «نوع»ی است که موتور فست ما باید حمل کند (ما `range|brand|attribute` را پشتیبانی می‌کنیم).

2. **قرارداد URL فست قیمت:** `slug` هر آیتم `price__gt` و `price__lt` است ⇒ دو پارامتر مستقل، نه یک بازه‌ی ترکیبی.

3. **فست برند دو‌زبانه است:** `{ id, slug, name1 (فارسی), name2 (لاتین) }` — و `slug` شامل هر دو است (`dahua-داهوا`، `hikvision-هایک-ویژن`). این الگو برای SEO و تطبیق چندمنبعی بسیار مهم است.

4. **`attributes` = فیلترهای سریع بالای لیست (Quick Filter Pills).** آرایه‌ی `attributes` زیرمجموعه‌ای از فست‌هاست (برند، خرید حضوری، وضعیت کارکرد) که ترب بالای نتایج نمایش می‌دهد؛ در حالی که `filters1/filters2` کل سایدبار است. **این همان تفکیک «پین‌شده» از «کامل» است** که در `sgeooole` با `isPinned` پیاده شد.

5. **«فقط موجودها» یک `toggle` مستقل است** (`available`)، نه گزینه‌ی یک فست — همان الگویی که در تکنولایف هم دیدیم (E10) و در `sgeooole` با `inStock` پیاده شده.

6. **`single_choice` برای وضعیت کارکرد** (نو/کارکرده) ⇒ فست تک‌انتخابی هم وجود دارد، نه فقط چندانتخابی.

7. **مرتب‌سازی شامل «بیشترین فروشنده» (`-supply`)** است — یک معیار مستقل از محبوبیت، مشابه «پرفروش‌ترین» که ما اصلاح کردیم.

8. **هیچ `count` به ازای گزینه‌ی فست در پاسخ نیست** (نه در `filters1/filters2`، نه در `categories`، نه در `attributes`). `available_filters` در این جستجو خالی بود. ⇒ برخلاف فرض اولیه، ترب هم شمارشگر گزینه‌ها را در این پاسخ نمی‌دهد. **مزیت ما:** پیاده‌سازی `count` واقعی روی هر گزینه.

9. **`category_id` و `category_slug` در این اندپوینت نادیده گرفته می‌شوند** (پاسخ بدون تغییر ماند)؛ فقط `q` اثر دارد. فیلتر دسته در ترب از مسیر `www.torob.com/browse/...` می‌آید که مسدود است.

> **صداقت روشی:** فست‌های **ویژگی‌محور** ترب (مثل «دید در شب»، «رزولوشن» در دسته‌ی دوربین) در این اجرا دیده نشد، چون فیلتر دسته در API پارامتری نداشت و صفحه‌ی browse مسدود است. آنچه اثبات شد: schema، نوع‌ها، قرارداد URL قیمت/برند، تفکیک quick-filter، و اینکه شمارشگر گزینه در پاسخ نیست.

---

## ۳) تکنولایف — یافته‌های مشاهده‌شده

### ۳.۱. مسیر صفحه و قرارداد URL

صفحه‌ی فهرست تکنولایف **مسیر-محور** است، نه کوئری-محور:

```
/category/mobile/mobile-phone                                 ← دسته
/category/mobile/mobile-phone/brand-apple                     ← فست برند
/category/mobile/mobile-phone/brand-apple/series-iphone-18    ← فست برند + فست سری
/category/mobile/mobile-phone?page=9                          ← صفحه‌بندی (تنها کوئری)
```

شواهد: E2 — `href="/category/mobile/mobile-phone/brand-apple/series-iphone-18"`، `href="/category/mobile/mobile-phone?page=9"`.

**درس معماری:** فست‌ها به‌صورت سگمنت مسیر (`{slug}-{value}`) کدگذاری می‌شوند تا خزش‌پذیر و SEO-friendly باشند؛ فقط `page` در Query String است. صفحه‌بندی همیشه با پارامتر `page` و از ۱ شروع می‌شود (در `sgeooole` هم همین است).

### ۳.۲. Schema فست‌ها در پاسخ API (`get_menu_filters`)

منبع فست‌ها یک کوئری GraphQL جداگانه است که در `__NEXT_DATA__` و به‌صورت SSR دفن شده (React Query dehydrated state). کوئری:

```json
["content", {
  "query": {
    "__name": "get_menu_filters",
    "__variables": { "url": "String", "filterObj": "filter_obj" },
    "get_menu_filters": {
      "page_filters": {
        "title": true,
        "price_range": { "min": true, "max": true },
        "items": { "name": true, "code": true, "enName": true }
      },
      "show_compare": true,
      "landing_carousel": { ... },
      "content": { "meta_title": true, "page_title": true, ... }
    }
  }
}, { "url": "category/mobile/mobile-phone", "filterObj": { "page_type": "dynamic", "limit": 30 } }]
```

شکل پاسخ (E7):

```jsonc
{
  "page_filters": [
    {
      "title": "فیلتر براساس قیمت",
      "price_range": { "min": 0, "max": 676806000 },
      "items": null
    },
    {
      "title": "برندها",
      "price_range": null,
      "items": [
        { "name": "بلک بری", "code": "09", "enName": "Blackberry" },
        { "name": "کاترپیلار", "code": "10", "enName": "Caterpillar" }
      ]
    },
    {
      "title": "تعداد هسته پردازشگر",
      "price_range": null,
      "items": [
        { "name": "کمتر از دو هسته", "code": "452", "enName": null },
        { "name": "دو هسته", "code": "453", "enName": null }
      ]
    }
  ],
  "show_compare": true,
  "landing_carousel": null,
  "content": { "meta_title": "...", "canonical": "...", "no_index": false }
}
```

**مشخصات کلیدی:**
- `items[]` تنها سه کلید دارد: `name`, `code`, `enName`. **هیچ شمارشگری (`count`) برای گزینه‌ها در پاسخ نیست.**
- `code` یک شناسه‌ی عددی سرور-ساید برای هر مقدار ویژگی است (رجیستری ویژگی‌ها)، نه اسلاگ.
- `enName` فقط برای برندها پر است (پایه‌ی ساخت سگمنت مسیر `brand-{enName|slug}`).
- فست قیمت یک شیء `price_range: {min,max}` است، نه گزینه.

### ۳.۳. فهرست کامل ۲۶ گروه فست (دسته‌ی «گوشی موبایل»)

| # | عنوان | تعداد گزینه | نمونه مقادیر |
|---|---|---|---|
| 0 | فیلتر براساس قیمت | — (range 0..676,806,000) | — |
| 1 | برندها | 66 | بلک بری، کاترپیلار، جی ال ایکس |
| 2 | تعداد هسته پردازشگر | 7 | کمتر از دو هسته، دو هسته، چهار هسته |
| 3 | قلم | 2 | دارد، ندارد |
| 4 | رده بندی | 4 | پرچمدار، قاتل پرچمدار، میان رده |
| 5 | تاشو | 2 | هست، نیست |
| 6 | سیستم عامل | 2 | Android، iOS |
| 7 | حافظه داخلی (Storage) | 14 | 8 گیگابایت … |
| 8 | حافظه RAM | 16 | تا 2 گیگابایت، 2 گیگابایت، 3 گیگابایت |
| 9 | سایز صفحه نمایش | 5 | تا 2.9 اینچ، از 3 تا 4 اینچ، از 4.1 تا 5 اینچ |
| 10 | دوربین جلو | 7 | تا 5 مگاپیکسل، از 5.1 تا 8 مگاپیکسل |
| 11 | کیفیت دوربین اصلی | 10 | 12 مگاپیکسل، 48 مگاپیکسل |
| 12 | کیفیت دوربین سلفی | 12 | 2 مگاپیکسل، 5 مگاپیکسل |
| 13 | شبکه اینترنت | 6 | 5G، 4.5G، 4G |
| 14 | مناسب برای | 2 | گیمینگ، دانش آموز |
| 15 | ضد آب | 2 | هست، نیست |
| 16 | سری آیفون | 32 | 13 Pro Max، 13 Pro، 13 |
| 17 | سری سامسونگ | 7 | S، A، Z |
| 18 | سری شیائومی | 5 | ردمی، بلک شارک |
| 19 | ریجن | 8 | گلوبال، چین، اندونزی |
| 20 | همراه با شارژر | 2 | باندل، داخل جعبه گوشی |
| 21 | ظرفیت باتری | 7 | کمتر از 2500 میلی‌آمپرساعت، از 2500 تا 2999… |
| 22 | شارژ سریع | 2 | دارد، ندارد |
| 23 | شارژ بی‌ سیم | 2 | دارد، ندارد |
| 24 | شارژ معکوس | 2 | دارد، ندارد |
| 25 | رنگ ها | 43 | صورتی روشن، مشکی تیتانیوم، خاکستری |

### ۳.۴. ارث‌بری سلسله‌مراتبی ویژگی‌ها (پاسخ به پرسش ۱.۲.۱)

شواهد مستقیم:
- Breadcrumb سه‌سطحی (E2): `تکنولایف → گوشی موبایل و تجهیزات (/category/mobile) → گوشی موبایل (/category/mobile/mobile-phone)`.
- `page_filters` **فقط برای گره‌ی برگ** برگردانده می‌شود، اما شامل ویژگی‌های سطح والد نیز هست: «برندها»، «سیستم عامل»، «حافظه داخلی» مشترک‌اند؛ در حالی که «سری آیفون/سامسونگ/شیائومی» و «ریجن» و «همراه با شارژر» مختص همین برگ‌اند.
- شاهد ساختاری بر ارث‌بری: وجود فست‌های «سری {برند}» که *به ازای برند* تفکیک شده‌اند و در مسیر به‌صورت `brand-apple/series-iphone-18` ترکیب می‌شوند ⇒ ویژگی‌ها در یک رجیستری سلسله‌مراتبی با دامنه‌ی برند تعریف شده‌اند، نه به‌صورت لیست ثابت هر صفحه.
- `getSubBreadCrumbProductList` برای همین URL آرایه‌ای با **۹۵** گره برمی‌گرداند (زیردسته‌ها/سری‌ها) ⇒ صفحه‌ی مادر می‌تواند همه‌ی زیرشاخه‌ها را با URL بشمارد.

**تفکیک ویژگی «سطح متغیر» از «فنی» (شاهد):**
- **متغیر/تجاری:** «رنگ ها» (۴۳ مقدار)، «همراه با شارژر» (باندل / داخل جعبه)، «ریجن» (گلوبال/چین/اندونزی)، «گارانتی» — این‌ها به کالای فیزیکیِ تحویلی وابسته‌اند.
- **فنی:** «تعداد هسته»، «حافظه داخلی»، «رم»، «سایز صفحه»، «دوربین‌ها»، «ظرفیت باتری»، «شبکه اینترنت».
- **کوپل با «فقط کالاهای موجود»:** در payload فیلترها هیچ فیلد موجودی نیست؛ فهرست محصولات `get_menu_products` یک فیلد `available: true` به ازای هر کالا دارد ⇒ موجودی در سطح *محصول/متغیر* است و فست‌ها آن را حمل نمی‌کنند. یعنی تکنولایف شمارشگر را با موجودی کوپل نمی‌کند (برخلاف ترب که شمارشگر فست را با موجودی می‌سازد). این یک **شکاف قابل بهبود** برای ما است، نه الگوی قابل کپی.

### ۳.۵. تجربه‌ی کاربری سایدبار/مودال (پاسخ به پرسش ۱.۲.۲)

شواهد از DOM (E2):
- فیلترها در یک **پنل مودال/کشویی** رندر می‌شوند، نه سایدبار همیشه‌باز:
  ```
  <p class="text-sm font-semiBold ...">فیلترها</p> <svg class="icon-closeNoColor ...">
  ```
  و هر گروه یک آکاردئون است:
  ```
  <p class="...">فیلتر براساس قیمت</p> <svg class="icon-arrow-bottom ...">
  ```
- در درخت Accessibility دسکتاپ (E3) هیچ عنوان فیلتری دیده نمی‌شود؛ فقط `heading "گوشی موبایل" [level=1]`، دکمه‌های مرتب‌سازی (`پرفروش ترین`، `بیشترین قیمت`، `کمترین قیمت`، `جدیدترین`، `بیشترین تخفیف`، `مقایسه`) و عنوان محصولات. ⇒ پنل فیلتر در حالت بسته از درخت دسترس‌پذیری خارج است.
- DOM دسکتاپ و موبایل تقریباً هم‌اندازه‌اند (1,468,469 و 1,468,575 بایت) و ۲۶ گروه فست یکسانی دارند ⇒ **یک مارک‌آپ، دو تجربه با CSS**؛ محتوای فیلتر برای موبایل دوباره واکشی نمی‌شود.
- مرتب‌سازی شامل «پرفروش ترین» است ⇒ مرتب‌سازی فروش، گزینه‌ی مستقل و انتظار کاربر است (مبنای اصلاح `bestSelling` در `sgeooole`).

**مشاهده‌نشده:** حفظ اسکرول هنگام تغییر فیلتر، اسکلتون/لودینگ نرم، و جستجوی داخلی در گزینه‌های طولانی، چون تغییر فیلتر در این کپچر انجام نشد (پنل بسته بود و انتخابگر پایدار در دسترس نبود). این‌ها از این کپچر **قابل اثبات نیستند**.

### ۳.۵.۱. شواهد تصویری (E10) — چیزهایی که فقط از اسکرین‌شات دیده می‌شوند

اسکرین‌شات ۱۴۴۰×۹۰۰ (`technolife-category-desktop.body.png`) چند واقعیت مهم را آشکار می‌کند که از DOM/JSON به‌سادگی خوانده نمی‌شد:

1. **همه‌ی آکاردئون‌های فیلتر بسته‌اند.** سایدبار فقط عنوان‌ها را نشان می‌دهد:
   «فیلتر براساس قیمت»، «برندها»، «تعداد هسته پردازشگر»، «قلم»، «رده بندی»، «تاشو»، «سیستم عامل»، «حافظه داخلی (Storage)» …
   ⇒ الگوی Progressive Disclosure: گزینه‌ها تا باز شدن آکاردئون رندر/حمل نمی‌شوند.

2. **دو سوییچ مستقل بالای فست‌ها:**
   - «ارسال زیر ۳ ساعت»
   - **«فقط کالاهای موجود»**
   این دقیقاً همان کوپل «فست × موجودی» در پرسش ۱.۲.۱ است: موجودی یک سوییچ سراسری است، نه گزینه‌ی فست.

3. **نوار مرتب‌سازی شامل «پرفروش ترین» است** (اولین گزینه، فعال):
   `مرتب: پرفروش ترین | بیشترین قیمت | کمترین قیمت | جدیدترین | بیشترین تخفیف`
   ⇒ تأیید مستقل اینکه «پرفروش‌ترین» باید یک حالت مرتب‌سازی واقعی و متمایز باشد.

4. **شمارش کل محصولات در دکمه‌ی مرتب‌سازی**: «۲۴۹۹ کالا».

5. **رنگ به‌صورت دایره‌های رنگی روی کارت محصول** دیده می‌شود (سبز/بنفش/مشکی) ⇒ رنگ یک ویژگی سطح **متغیر** است و در کارت به‌صورت swatch نمایش داده می‌شود؛ مبنای طراحی Color Swatch در فاز ۴.

6. **چیپ‌های مشخصات روی کارت محصول**: `64GB`، `6.7`، `50`، `5000`، `۲ گیگابایت` ⇒ مشخصات نرمال‌شده در سطح کارت هم نمایش داده می‌شوند.

7. **پنل فیلتر روی دسکتاپ هم به‌صورت کشویی/مودال با آیکن بستن است** (بالای ستون راست: «فیلترها» + آیکن)، نه سایدبار همیشه‌باز.

### ۳.۶. نرمال‌سازی مقادیر — شاهد قوی (پاسخ به بخش ۱.۱.۲ به‌صورت غیرمستقیم)

مقادیر فست‌ها **از پیش باکت‌بندی‌شده در سرور** می‌آیند، نه خام از فروشنده:

| الگوی مشاهده‌شده | نمونه |
|---|---|
| بازه‌ی کران‌دار | `تا 2.9 اینچ`، `از 3 تا 4 اینچ`، `از 4.1 تا 5 اینچ` |
| بازه‌ی باز | `کمتر از 2500 میلی‌آمپرساعت`، `از 2500 تا 2999 میلی‌آمپرساعت` |
| مقدار واحد-دار استاندارد | `8 گیگابایت`، `12 مگاپیکسل`، `5G` |
| بولی استانداردشده | `دارد/ندارد`، `هست/نیست` (سه گروه مختلف همگی به همین دو باکت نگاشت شده‌اند) |
| نرمال‌سازی واژگانی | `حافظه داخلی (Storage)`, `حافظه RAM` |

- باکت `تا 2.9 اینچ` درست بعد از آن با `از 3 تا 4 اینچ` ادامه می‌یابد ⇒ **بازه‌ها تودرتو نیستند و کران بالا شامل است**. این دقیقاً همان خانواده‌ی باگی است که در `sgeooole` با `if (dist <= 50) return 'تا 40 متر'` بازه‌ی ۴۰ متر را می‌بلعید.
- نگاشت «دارد/ندارد» و «هست/نیست» به یک باکت مشترک، شاهد عملی «مترادف مقدار» است.

---

## ۴) شکاف واقعی: وضعیت `sgeooole` در برابر این اهداف

این بخش مهم‌ترین خروجی فاز ۱ برای تصمیم‌گیری است. **بخش بزرگی از قواعد مأموریت به کدی اشاره می‌کرد که در این مخزن وجود ندارد.**

| ادعای مأموریت | وضعیت واقعی (بررسی‌شده) |
|---|---|
| `services/specAndDescriptionService.js` با `prepareProductSpecsAndDescription`, `parseAndCleanDescription`, `normalizeBucketValue`, `normalizeFilterFacetPair`, `NON_FILTERABLE_KEYS`, `buildStructuredHtmlDescription`, `stripTagsToText` | **وجود ندارد.** نه روی دیسک، نه در هیچ کامیتی از تاریخچه‌ی گیت (`git log --all -- '*specAndDescriptionService.js'` خالی است). |
| باگ‌های خطوط ۳۳۲/۳۴۶/۴۱۳/۴۲۳/۴۶۱/۵۵۴/۱۰۴۰ همان فایل | **قابل اعمال نیست** (فایل موجود نیست). |
| `rankAndFormatPropertyFacets` | **وجود ندارد.** |
| `facets` در پاسخ `GET /api/products` | **هرگز تولید نمی‌شود.** `$facet` فقط `data`، `total`، `priceRange` دارد. فرانت‌اند اما از قبل `data.facets` را مصرف می‌کند. |
| `categoryFacets` / `facets.categories` | **وجود ندارد.** |
| `category.properties[].isPinned` | **نبود.** مدل `Category` فقط `{name,type,options,isFilterable,unit,order}` دارد. |
| `normCompareKey` / `valueAliases` | **وجود ندارد.** |
| `GET /api/categories/:id/discovered-specs` و `POST .../sync-discovered-properties` | **وجود ندارد.** |
| ایندکس‌های `{isActive,category,brand}` و `{isActive,category,'properties.label','properties.value'}` | **وجود ندارد** (ایندکس‌های متفاوتی موجودند). |
| تکرار `case 'bestSelling'` در `productSorting.js` | **واقعی** — و بدتر: `ALIASES` مقدار `bestSelling` را به `popularity` نگاشت می‌کرد، پس حالت فروش هرگز اجرا نمی‌شد. |
| `nocache=true` در `getProducts` | **واقعی** — در خط ۶۹۹ (نه ۵۳۸). `cacheMiddleware` هم با این پرچم کش را کامل دور می‌زند. |
| `handleProductImport` | **واقعی** — `routes/products.js:2218`. |
| `resolveListingContext` / `buildListingPipeline` | **واقعی** — `productListingService.js:194` و `:363`. |
| `keepPreviousData: false` در `useProductListing` | **واقعی** — خط ۱۱۹. |
| `showSkeleton` کلی | **واقعی** — `productListingState.ts` (۲۶ خط). |
| `humanizeSlug` در H1 سئو | **واقعی** — `products/page.tsx:56,106`. |

**نتیجه:** فازهای ۲ و بخشی از ۳ در واقع «ساخت لایه‌ی ازدست‌رفته» هستند، نه «رفع باگ». این سند و پیاده‌سازی همراه، آن لایه را با قراردادهای صریح می‌سازد.

---

## ۵) جدول نگاشت: رفتار مشاهده‌شده → معماری `sgeooole`

| رفتار هدف | منبع/شاهد | پیاده‌سازی در `sgeooole` |
|---|---|---|
| فست‌های گروه‌بندی‌شده با `{title, price_range, items[]}` | تکنولایف E7 | `$facet` با شاخه‌های `brands`, `categories`, `prop_*` → `rankAndFormatPropertyFacets` |
| فست قیمت به‌صورت بازه‌ی مستقل | تکنولایف E7 (گروه ۰) | `priceRange` موجود حفظ می‌شود؛ فست `properties` قیمت را تکرار نمی‌کند |
| مقادیر از پیش باکت‌بندی‌شده روی سرور | تکنولایف E7 | `services/specNormalization.js` (`normalizeBucketValue`) در زمان نوشتن + `normValue` |
| بازه‌های غیرتودرتو با کران بالا شامل | تکنولایف E7 (`تا 2.9` سپس `از 3 تا 4`) | `bucketizeByThresholds` + رفع `dist <= 50` |
| بولی استانداردشده (`دارد/ندارد`) با نفی | تکنولایف E7 (گروه‌های ۳، ۵، ۲۲–۲۴) | `isNegated` + `normalizeBooleanValue` (چک نفی **قبل** از تطبیق مثبت) |
| فست برند با شناسه + اسلاگ | تکنولایف E7 (`code`, `enName`) | `facets.brands[] = {id, slug, name, count}` |
| ویژگی‌های مختص برند/سری | تکنولایف E7 (گروه‌های ۱۶–۱۸) | `category.properties` با ارث‌بری + فیلترهای سطح متغیر (`variants.options`) |
| قرارداد URL قابل خزش برای فست | تکنولایف E2 (`brand-apple/series-iphone-18`) | مسیر فعلی ما Query String است (`?prop_...`); تغییر مسیر خارج از دامنه‌ی این مأموریت — اما ساختار کلیدها پایدار نگه داشته می‌شود |
| صفحه‌بندی با `?page=` | تکنولایف E2 | از قبل `page` (۱-پایه) |
| مرتب‌سازی «پرفروش‌ترین» مستقل | تکنولایف E3 | رفع `bestSelling` در بک‌اند و افزودن گزینه در فرانت |
| پنل فیلتر به‌صورت آکاردئون/شیت | تکنولایف E2 | `FilterSection` موجود + دراور موبایل موجود |
| شمارشگر گزینه‌های فست | **هر دو ندارند** — ترب در پاسخ `filters1/filters2/attributes/categories` هیچ `count` نمی‌دهد (E13/E14)؛ تکنولایف هم ندارد | ما **اضافه می‌کنیم** (مزیت رقابتی): `count` به ازای هر مقدار و `brand.count` |
| پایداری گزینه‌های انتخاب‌شده هنگام تغییر فست‌ها | الزام مأموریت | `rankAndFormatPropertyFacets` گزینه‌ی `isSelected` را هرگز حذف نمی‌کند |

---

## ۶) الزامات طراحی استخراج‌شده (ورودی فازهای ۲ تا ۴)

1. **فست = سه‌گانه‌ی (عنوان، نوع، گزینه‌ها)** با نوع صریح `range | brand | attribute`.
2. **همیشه `count` داشته باشیم** — نه ترب (E13/E14) و نه تکنولایف شمارشگر گزینه نمی‌دهند. برای UX بهتر، شمارشگر اجباری است و یک تمایز واقعی محصول است.
3. **همه‌ی مقادیر باید از یک نرمال‌ساز واحد عبور کنند** (هم در نوشتن، هم در خواندن) تا mismatch صفر-نتیجه رخ ندهد.
4. **بازه‌ها باید صریح، غیرتودرتو و کران-بالا-شامل باشند.**
5. **نفی مقدم است** — «فاقد X» هرگز «X دارد» نیست.
6. **قابلیت فیلتر بودن با ادمین است** — نه با لیست سیاه داخلی.
7. **ویژگی‌های سطح متغیر** (رنگ، گارانتی، ظرفیت) باید با موجودی و قیمت *همان متغیر* کوپل شوند.
8. **پایداری**: ترتیب فست‌ها از `order` دسته، و گزینه‌ی انتخاب‌شده هرگز ناپدید نمی‌شود.
9. **بدون پرش صفحه**: داده‌ی قبلی حفظ شود، اسکلتون فقط در بارگذاری اولیه.
10. **مرتب‌سازی فروش مستقل از محبوبیت.**

---

## ۷) بازتولید شواهد

```powershell
# ابزار
cd D:\project\rea
npm install
npm run compile

# کپچر دسکتاپ تکنولایف
node scripts/rea.mjs capture-browser-scenario `
  'D:\project\sgeooole\_re\filtering\technolife-category-desktop.scenario.json' `
  --format json > out.json

# استخراج آرتیفکت‌ها
cd D:\project\sgeooole\_re\filtering
node extract.cjs out.json technolife-category-desktop
node nextdata.cjs technolife-category-desktop.dom.html technolife-desktop-nextdata
node queries.cjs technolife-desktop-nextdata.json tl
node filters-summary.cjs
```

فایل‌های `.scenario.json` برای دسکتاپ، موبایل و ترب در همان پوشه نگه داشته شده‌اند تا کپچر تکرارپذیر باشد.

### بازتولید کپچر API ترب (میزبان API مسدود نیست)

```powershell
cd D:\project\rea
node scripts/rea.mjs capture-browser-scenario `
  'D:\project\sgeooole\_re\filtering\torob-api-retry.scenario.json' `
  --format json > 'D:\project\sgeooole\_re\filtering\torob-api-retry.capture.stdout.json'

cd D:\project\sgeooole\_re\filtering
node extract.cjs torob-api-retry.capture.stdout.json torob-api-retry
node torob-extract.cjs                      # JSON داخل <pre> را جدا می‌کند
node torob-json.cjs torob-cctv-query.dom.html torob-cctv
```

> نکته: فایل سناریو باید **UTF-8 بدون BOM** ذخیره شود؛ REA ورودی دارای BOM را رد می‌کند
> (`JSON input begins with a UTF-8 byte-order mark`).
