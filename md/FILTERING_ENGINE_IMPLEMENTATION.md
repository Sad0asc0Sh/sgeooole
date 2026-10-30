# موتور فیلترینگ هوشمند `sgeooole` — یادداشت پیاده‌سازی

> این سند «چه چیزی ساخته شد و چرا» را ثبت می‌کند. شواهد رفتاری ترب/تکنولایف در
> [`FILTERING_TOROB_TECHNOLIFE_REA_SPEC.md`](./FILTERING_TOROB_TECHNOLIFE_REA_SPEC.md) است.

---

## ۰) نکته‌ی صادقانه درباره‌ی نقطه‌ی شروع

مأموریت، اصلاح باگ‌هایی در `services/specAndDescriptionService.js` را درخواست می‌کرد
(با شماره‌خط‌های مشخص). **آن فایل در این مخزن وجود نداشت** — نه روی دیسک و نه در هیچ
کمیاتی از تاریخچه‌ی گیت. همچنین `rankAndFormatPropertyFacets`، `facets` در پاسخ API،
`isPinned`، `normCompareKey` و اندپوینت‌های `discovered-specs` هم موجود نبودند.

بنابراین فازهای ۲ و بخشی از ۳ عملاً **ساخت لایه‌ی ازدست‌رفته** بودند، نه رفع باگ.
آنچه ساخته شد با همان قراردادهای خواسته‌شده طراحی شده است.

باگ‌هایی که **واقعاً** وجود داشتند و رفع شدند:
- `productSorting.js`: `ALIASES` مقدار `bestSelling` را به `popularity` نگاشت می‌کرد
  و یک `case 'bestSelling'` مرده هم داشت ⇒ مرتب‌سازی فروش هرگز اجرا نمی‌شد.
- `productService.ts`: `nocache=true` در `getProducts` کش سرور را کامل دور می‌زد.
- نبود ایندکس‌های ترکیبی `{isActive, category, brand}` و `{isActive, category, properties...}`.
- `products/page.tsx`: `<h1>` و `<title>` با اسلاگ انگلیسی ساخته می‌شدند.

---

## ۱) فایل‌های جدید

| فایل | نقش |
|---|---|
| `services/specNormalization.js` | نرمال‌ساز مشترک: ارقام، حروف، نفی، واحدها، باکت‌بندی، کلیدهای مقایسه |
| `services/specAndDescriptionService.js` | استخراج و نرمال‌سازی مشخصات + توضیحات غیرمخرب |
| `services/listingFacets.js` | ادغام قواعد دسته، معیارهای ویژگی، شرط‌های آگاه از متغیر، ساخت و رتبه‌بندی فست |
| `tests/filtering-engine.test.cjs` | ۲۱ تست قرارداد موتور فیلترینگ |
| `frontend/__tests__/ProductsPageFacets.test.tsx` | ۶ تست UI (شمارشگر برند، چیپ‌ها، بدون اسکلتون، جستجوی داخلی، دایره رنگ) |

---

## ۲) تصمیم‌های کلیدی و دلیل آن‌ها

### ۲.۱. نرمال‌سازی دوطرفه‌ی مقدار (نوشتن + خواندن)

هر مقدار مشخصه از `normalizeBucketValue(label, value)` عبور می‌کند و نتیجه در
`properties[].normValue` ذخیره می‌شود. کوئری هم دقیقاً از همان تابع می‌گذرد.
نتیجه: گزینه‌ی ادمین `2MP`، مقدار محصول `۲ مگاپیکسل` و مقدار `2 مگاپیکسل` همه به
باکت یکتای `2 مگاپیکسل` می‌رسند ⇒ **صفر-نتیجه‌ی ناشی از عدم تطابق حذف می‌شود**.

تطبیق در پایپ‌لاین به هر دو شکل انجام می‌شود تا داده‌ی قدیمی بدون مهاجرت کار کند:
```js
{ $anyElementTrue: { $map: { input: '$properties', as: 'p', in: { $and: [
  { $in: [{ $ifNull: ['$$p.normLabel', '$$p.label'] }, labelKeys] },
  { $in: [{ $ifNull: ['$$p.normValue', '$$p.value'] }, matchValues] },
] } } } }
```
`matchValues` هم باکت نرمال‌شده و هم مقدار خام را دارد.

### ۲.۲. نگهبان نفی با مرز یونیکد

`\b` در جاوااسکریپت فقط `\w` اسکی را مرز می‌داند، پس کنار حروف فارسی هرگز مرز
نمی‌سازد. این باگ در نسخه‌ی اولیه باعث شد «میکروفون ندارد» به‌عنوان «دارد» دسته‌بندی شود.
اکنون از lookaround یونیکد استفاده می‌شود:

```js
/(?<!\p{L})(?:فاقد|ندارد|بدون|غیر\s*فعال|غیرفعال|خیر|نیست|هیچ|عدم)(?!\p{L})/iu
```

### ۲.۳. نیم‌فاصله: در نمایش بمان، در مقایسه حذف شو

`normalizeText` نیم‌فاصله را حفظ می‌کند (تا «ژله‌ای» به «ژله ای» تخریب نشود)، اما
`toValueKey` و `normCompareKey` آن را حذف می‌کنند (تا «می‌کند» و «می کند» یکی شوند).

### ۲.۴. فست‌های Disjunctive واقعی — و هزینه‌ی آن

پیش‌فیلتر ویژگی‌ها **عمداً** از اولین `$match` حذف شده است. اگر پیش از `$facet`
اعمال شود، مقدارهای «خواهر» صفر می‌شوند و کاربر نمی‌تواند انتخابش را عوض کند.

```js
// گزینه‌های یک ویژگی باید مستقل شمرده شوند:
prop_i = allCriteriaExcept(i) + brandMatch + priceMatch
brands = allProperties + priceMatch            // بدون فیلتر برند
categories = allProperties + brand + priceMatch
data/total = allProperties + brand + priceMatch
```

**معاوضه‌ی صریح:** اولین `$match` فقط شرط‌های پایه را push می‌کند
(`isActive`، `category`، `search`، `minRating`، `minSalesCount`) که ایندکس‌پذیرند.
فیلتر ویژگی ایندکس‌پذیر نیست، اما تعداد اسناد داخل یک دسته معمولاً محدود است و
این تنها راه حفظ رفتار Disjunctive در MongoDB بدون N کوئری جداگانه است.

### ۲.۵. فیلترینگ آگاه از متغیر (هم‌زمان)

اگر چند معیار روی `variants.options` تعریف شده باشند، **یک متغیر واحد** باید همه را
برآورده کند (نه چند متغیر مختلف). علاوه بر آن:
- `inStock=true` ⇒ همان متغیر باید `stock > 0` داشته باشد
- `minPrice`/`maxPrice` ⇒ قیمت **همان** متغیر در بازه باشد
- قیمت نمایشی = کمترین قیمت بین **متغیرهای منطبق** (نه ناموجود/نامرتبط)

برای داده‌ی قدیمی بدون `normLabel/normValue` روی گزینه‌ها، تطبیق خام هم پشتیبانی می‌شود.

### ۲.۶. توضیحات غیرمخرب

`prepareProductSpecsAndDescription` هرگز `description` را بازنویسی نمی‌کند:
- `description` خروجی همیشه برابر ورودی است (تست هویت بایتی دارد)
- حذف جدول مشخصات فقط با `removeDuplicateSpecTable: true` و فقط همان جدول
- `buildStructuredHtmlDescription` فقط با `applyStructuredTemplate: true` (دکمه‌ی صریح ادمین)

### ۲.۷. اولویت ادمین بر لیست سیاه

```js
filterable = explicitlyEnabledByAdmin ? true : !isNonFilterableKey(label)
```
`explicitlyEnabledByAdmin` یعنی ویژگی در `category.properties` هست و
`isFilterable !== false` است — حتی اگر `isPinned: false` باشد.

---

## ۳) قرارداد پاسخ `GET /api/products`

```jsonc
{
  "success": true,
  "data": [ /* محصولات */ ],
  "pagination": { "currentPage": 1, "itemsPerPage": 24, "totalItems": 128, "totalPages": 6 },
  "priceRange": { "min": 0, "max": 676806000 },
  "facets": {
    "brands": [ { "id": "…", "slug": "apple", "name": "اپل", "count": 12 } ],
    "categories": [ { "id": "…", "slug": "mobile-phone", "name": "گوشی موبایل", "parent": null, "count": 89 } ],
    "properties": [
      {
        "name": "رزولوشن",
        "unit": "مگاپیکسل",
        "isConfigured": true,
        "isPinned": true,
        "order": 2,
        "values": [
          { "value": "4 مگاپیکسل", "count": 6, "isSelected": true },
          { "value": "2 مگاپیکسل", "count": 3, "isSelected": false }
        ]
      }
    ]
  }
}
```

فست‌های شهودی:
- `brands` فیلتر برند را اعمال نمی‌کند (Disjunctive)
- هر `properties[]` فیلتر خودش را اعمال نمی‌کند (Disjunctive)
- گزینه‌ی `isSelected` و گزینه‌های تعریف‌شده‌ی ادمین هرگز حذف نمی‌شوند (حتی با `count: 0`)

---

## ۴) اندپوینت‌های جدید

| متد | مسیر | نقش |
|---|---|---|
| `GET` | `/api/categories/:id/discovered-specs` | کشف مشخصات از داده‌ی واقعی + Backfill خودکار محصولات قدیمی |
| `POST` | `/api/categories/:id/sync-discovered-properties` | افزودن ویژگی‌های کشف‌شده به `category.properties` بدون بازنویسی قواعد ادمین |

هر دو با `protect` + دسترسی `CATEGORY_READ`/`CATEGORY_UPDATE` محافظت می‌شوند و کش
محصولات/دسته‌بندی را باطل می‌کنند.

---

## ۵) معیارهای Backfill

یک محصول «قدیمی» شمرده می‌شود اگر:
- `properties` نداشته باشد، یا
- اولین عضو `properties` را نداشته باشد، یا
- `properties.normValue` نداشته باشد (داده‌ی پیش از نرمال‌سازی)

Backfill فقط `properties` و `specifications` را می‌نویسد و **به `description` دست نمی‌زند**.

---

## ۶) وضعیت اعتبارسنجی

| بررسی | نتیجه |
|---|---|
| `npm test` بک‌اند | **۰ خطا** — شامل `filtering-engine.test.cjs` (۲۵ تست) و `pricing-display-parity` (۶ تست) |
| `npm --prefix frontend run typecheck` | بدون خطا |
| `npm --prefix frontend test` | **۳۰۴/۳۰۴** تست |
| `npm --prefix admin run build` | **موفق** (`✓ built in 7.89s`، chunk اختصاصی `CategoriesPage`) |
| `node --check` روی فایل‌های تغییر‌یافته | پاس |

### محدودیت‌های باقی‌مانده
1. **آزمایش انتها-به-انتها با MongoDB واقعی انجام نشد** — در این محیط نه `mongod` بود
   نه Docker. تمام تست‌های موتور با `mingo` (شبیه‌ساز aggregation مونگو) اجرا شدند که
   همان روش موجود در مخزن است.

---

## ۷) Hardening نهایی — چهار مورد باقی‌مانده

### ۷.۱. حفظ نیم‌فاصله در برچسب نمایشی گزینه‌ها

**مسئله:** گروه‌بندی فست روی `normValue` بود و همان رشته هم به UI می‌رفت، پس
«بی‌سیم»/«ژله‌ای»/«میلی‌آمپرساعت» بدون نیم‌فاصله نمایش داده می‌شدند.

**راه‌حل:** شاخه‌ی فست اکنون جفت `{k, v}` تولید می‌کند (`k` = کلید مقایسه‌ای،
`v` = مقدار خام نمایشی) و در دو مرحله گروه‌بندی می‌کند:

```js
// ۱) یک‌بار برای هر سند یکتا (جلوگیری از شمارش دوباره)
{ $group: { _id: { k: '$pairs.k', doc: '$_id' }, display: { $first: '$pairs.v' } } }
// ۲) شمارش روی کلید مقایسه‌ای، با حفظ رشته‌ی نمایش خام
{ $group: { _id: '$_id.k', displayValue: { $first: '$display' }, count: { $sum: 1 } } }
```

خروجی `facets.properties[].values[].value` = `displayValue` (با نیم‌فاصله)، در حالی
که ادغام هم‌ارزها («۱۲۸ گیگابایت» و «128GB») هنوز اتفاق می‌افتد.
انتخاب‌شدن (`isSelected`) هم با همان کلید مقایسه‌ای سنجیده می‌شود، نه با رشته‌ی خام.

تست: `facet displayValue keeps ZWNJ while the group key stays normalized`.

### ۷.۲. کوئری ایندکس‌پذیر با `$elemMatch` (حذف `$expr`/`$map` از تطبیق ویژگی)

**مسئله:** تطبیق `properties` با `$expr` + `$anyElementTrue` + `$map` انجام می‌شد که
کل آرایه را در حافظه می‌ساخت و از ایندکس Multikey استفاده نمی‌کرد.

**راه‌حل:** تابع جدید `propertyMatchQuery` شرط استاندارد و ایندکس‌پذیر می‌سازد:

```js
{
  $or: [
    { properties: { $elemMatch: { $or: [
        { normLabel: { $in: labelKeys }, normValue: { $in: matchValues } },
        { label: { $in: rawLabelCandidates }, value: { $in: matchValues } },
    ] } } },
    { 'variants.options': { $elemMatch: { $or: [
        { normLabel: { $in: labelKeys }, normValue: { $in: matchValues } },
        { name: { $in: rawLabelCandidates }, value: { $in: matchValues } },
    ] } } },
  ],
}
```

این شرط‌ها در `data`/`total`/`brands`/`categories` و هر شاخه‌ی `prop_i` (با حذف
معیار خودش) اعمال می‌شوند. `$expr`/`$map` فقط برای **کوپل متغیر** باقی مانده
(تشخیص اینکه یک متغیر واحد همه‌ی معیارها + موجودی + قیمت را برآورده کند)، چون این
منطق روی قیمت محاسبه‌شده‌ی متغیر کار می‌کند و در سطح کوئری قابل بیان نیست.

**مسیر سریع جدید (`facets=false`):** هیچ فست‌ای لازم نیست، پس همه‌ی شرط‌های ویژگی در
همان `$match` اول می‌نشینند و کوئری کاملاً ایندکس‌پذیر می‌شود:

```bash
GET /api/products?properties[رنگ]=آبی&facets=false
```

با `facets=false` شاخه‌های `brands`/`categories`/`prop_i` هم ساخته نمی‌شوند (پاسخ
سبک‌تر برای پنل ادمین و مصرف‌کننده‌های API).

تست‌ها: `property matching uses $elemMatch and facets=false makes the first $match index-able`
و `facets=false still returns the exact filtered data`.

### ۷.۳. رفع کامل دو تست `pricing-display-parity`

**ریشه‌یابی:** دو تست «چت‌بات پس از انقضا» و «چت با Sale فعال» شکست می‌خوردند،
در حالی که `resolveProductDisplay` در جدایی درست کار می‌کرد (۸۳۲٬۰۰۰). علت واقعی:

- `finalPriceOf(p, now)` ساعت را **تزریق** می‌کرد.
- `toCardPayload(p)` ساعت را تزریق نمی‌کرد و `resolveProductDisplay` با ساعت دیوار
  اجرا می‌شد.

«تازگی کف قطعی» (`pricingMeta.exactFloorPriceAt`) پنجره‌ی ۱۴ روزه دارد. در تاریخ
اجرا، `exactFloorPriceAt` فیکسچر تست دقیقاً از پنجره بیرون افتاده بود ⇒ کف قطعی
نادیده گرفته می‌شد ⇒ کارت ۹۹۰٬۴۷۶ (و با Sale: ۷۴۲٬۸۵۷) نشان می‌داد. یعنی تست یک
**time-bomb** بود و مسیر کارت با مسیر نمایش ناهمگام.

**راه‌حل (در سرویس، نه در تست):** `toCardPayload` و `formatProductContext` اکنون
ساعت درخواست را می‌پذیرند و به `resolveProductDisplay` می‌دهند:

```js
function toCardPayload(p, extra = {}) {
  const now = extra.now instanceof Date ? extra.now : new Date()
  const view = resolveProductDisplay(p, { now, activeSale: ... })
}
```

تست هم ساعت را تزریق می‌کند تا دیگر به تاریخ اجرا وابسته نباشد.

**نتیجه:** هر سه مسیر (لیست، صفحه‌ی محصول، چت) اکنون با یک ساعت واحد و یک گارد کف
یکسان کار می‌کنند. `pricing-display-parity`: ۶/۶ و `npm test` بک‌اند: ۰ خطا.

### ۷.۴. همگام‌سازی ادمین + فید ترب

**مدل `Category`:** فیلدهای `isPinned`، `aliases` و `valueAliases` به
`properties[]` اضافه شدند (پیش‌تر وجود نداشتند و `mergeCategoryRules` فقط
`isPinned` را از روی داده می‌خواند).

**پنل ادمین (`CategoriesPage.jsx`):**
- چک‌باکس «سنجاق در فیلترهای سریع» و ورودی «مترادف‌های نام» در فرم افزودن ویژگی
- نمایش تگ‌های «فیلتر سریع»، «مترادف» و «نگاشت مقادیر» در فهرست ویژگی‌ها
- دکمه‌ی «کشف مشخصات از محصولات» → `GET /discovered-specs`
- مودال انتخاب ویژگی‌های کشف‌شده → `POST /sync-discovered-properties` با برچسب‌های انتخابی
- ویژگی‌های از قبل تعریف‌شده با برچسب «تعریف‌شده» غیرفعال‌اند (بازنویسی نمی‌شوند)

**`ProductForm.jsx`:** بدون تغییر لازم بود — همان `properties: [{label, value}]` را
می‌فرستد. اتصال واقعی در بک‌اند انجام شد: `normalizeProductSpecPayload` اکنون در
مسیرهای `POST /api/products` و `PUT /api/products/:id` هم اجرا می‌شود، پس محصولی که
از فرم ادمین ذخیره می‌شود از همان لحظه `normLabel`/`normValue`/`bucket` دارد.

**فید ترب (`utils/torobMapper.js`):** `mapSpecifications` اکنون علاوه بر
`product.specifications`، آرایه‌ی `product.properties` را هم به `spec` فید اضافه
می‌کند (بدون بازنویسی مقادیر رسمی، با حفظ مقدار نمایشی و نیم‌فاصله، سقف ۸۰ ورودی).
به این ترتیب ویژگی‌های سطح متغیر (رنگ، ظرفیت، گارانتی) هم به فید ترب می‌رسند.

تست: `torobMapper merges properties into the feed spec without overwriting specifications`.

**کپچر زنده‌ی ترب:** میزبان `api.torob.com` مسدود نبود و با مرورگر واقعی
**HTTP 200** داد؛ schema واقعی فیلترها استخراج و در سند شواهد ثبت شد
(بخش ۲ سند REA). صفحه‌های سند `www.torob.com` همچنان پشت کپچا هستند.

---

## ۸) معماری دولایه‌ی مشخصات (Spec Layer Separation)

### ۸.۱. حذف کامل «بلوک» جدول مشخصات از توضیحات

پیش‌تر `removeDuplicateSpecTables` فقط تگ `<table>` را برمی‌داشت و **کامنت
`<!-- Technical Specifications -->`، کانتینر `<div>` و تیتر `<h2>مشخصات فنی</h2>`
باقی می‌ماندند** ⇒ یک باکس سفید خالی در انتهای توضیحات.

اکنون الگوریتم «گسترش محدوده» پیاده شده است:

1. همه‌ی جدول‌ها اسکن می‌شوند و جدولِ دارای نشانگر «مشخصات فنی» (در ۹۰۰ کاراکتر
   قبل یا ۴۰۰ کاراکتر ابتدای خودش) انتخاب می‌شود.
2. محدوده به عقب گسترش می‌یابد: تیتر `<h1..h6>` بلافاصله بالای جدول → کانتینر
   `<div>` بلافاصله بالای تیتر → کامنت `<!-- Technical Specifications -->`.
3. محدوده به جلو تا **بسته‌شدن همان کانتینر** با شمارش تودرتویی `<div>` گسترش می‌یابد.
4. `<h1>` داخل توضیحات به `<h2>` تبدیل می‌شود (تک‌بودن h1 صفحه).

نکته‌ی حساس: پنجره‌ی نگاه‌به‌عقب **از انتهای جدول قبلی شروع می‌شود**، وگرنه نشانگر
«مشخصات فنی» جدول قبلی، جدول‌های بعدی را هم بی‌دلیل حذف می‌کرد.

**پیش‌فرض تغییر کرد:** `removeDuplicateSpecTable` اکنون `true` است و فقط زمانی
حذف انجام می‌شود که از جدول حداقل یک جفت مشخصه استخراج شده باشد. `routes/products.js`
هم `payload.description = prepared.description` را ذخیره می‌کند.

### ۸.۲. تفکیک `specifications` (جدول کامل) از `properties` (فست سایدبار)

| لایه | محتوا | برچسب | مقدار |
|---|---|---|---|
| `product.specifications` | همه‌ی ردیف‌ها، حتی غیرقابل‌فیلتر | **خام** (وفادار به سند) | **متن کامل** |
| `product.properties` | فقط `filterable === true` | **استانداردشده** (canonical) | **باکت کوتاه** |

- `normalizeFacetValue` مسئول باکت‌سازی است: قاعده‌ی اختصاصی برچسب (تعداد زون/رله/کانال/کلید،
  فرکانس کاری، نوع کددهی، رزولوشن، استاندارد حفاظتی) → سپس نرمال‌ساز عمومی.
- **قاعده‌ی طول:** جمله‌ی بیش از ۴۵ کاراکتر یا بیش از ۷ کلمه که با هیچ قاعده‌ای باکت
  نشود فقط در `specifications` می‌ماند و وارد سایدبار نمی‌شود.
- `canonicalizeSpecLabel` اول از `categoryRules` (name + aliases) و بعد از
  `BUILTIN_KEY_SYNONYMS` (۸ کلیشه: فرکانس کاری، نوع کددهی، تعداد رله، …) استفاده می‌کند.
- `SPEC_TABLE_ONLY_KEYS` (۳۵ کلید مثل «مدت ضبط پیام»، «تعداد مدیران سیستم»، «ابعاد»،
  «گارانتی») به `NON_FILTERABLE_KEYS_BASE` اضافه شد؛ اولویت ادمین همچنان مقدم است.
- `guarantee` از کلیدهای گارانتی/ضمانت استخراج می‌شود اگر فیلد اختصاصی خالی باشد.

**نمونه‌ی SG8-S:** ۹ ردیف در `specifications` (متن کامل) و ۵ فست در `properties`:
`نوع کاربری`، `تعداد زون: 5 زون`، `تعداد رله: 4 رله`، `فرکانس کاری: 433 مگاهرتز`،
`نوع کددهی: هاپینگ کد (Hopping)`. ردیف‌های صرفاً جدولی حذف می‌شوند.

### ۸.۳. `propBase` — شمارش فست‌ها در ورود اول به دسته

**باگ:** شاخه‌های `prop_${index}` فقط برای ویژگی‌های *انتخاب‌شده در URL* ساخته
می‌شدند؛ پس در ورود اول (بدون فیلتر) هیچ شاخه‌ای نبود و همه‌ی شمارش‌ها صفر
برمی‌گشتند و Quick Filter Pills خالی می‌ماند.

**راه‌حل:** شاخه‌ی `propBase` که یک‌بار روی کل نتایج منطبق اجرا می‌شود و همه‌ی
جفت‌های (برچسب، مقدار) را از `properties` و `variants.options` می‌شمارد:

```js
$project: { pairs: { $setUnion: [propPairs, variantPairs] } }
$unwind → $group({labelKey, valKey, doc}) → $group({labelKey, valKey})
```

سپس در `buildFacets` ابتدا `propBase` خوانده می‌شود و بعد شاخه‌های Disjunctive
ویژگی‌های انتخاب‌شده، نتایج همان برچسب را جایگزین می‌کنند.

### ۸.۴. حاکمیت ضدشلوغی سایدبار

در `rankAndFormatPropertyFacets`:

- ویژگی‌های `isConfigured` و انتخاب‌شده‌ی کاربر همیشه می‌مانند (و اول می‌آیند).
- ویژگی‌های کشف‌شده‌ی خودکار حذف می‌شوند اگر: کلیدشان در لیست سیاه باشد،
  کمتر از ۲ مقدار زنده داشته باشند، یا بیش از ۱۸ مقدار پراکنده.
- سقف ویژگی‌های خودکار: **۱۰** در صفحه‌ی دسته، **۶** در جستجوی آزاد؛ مرتب‌شده بر
  اساس مجموع پوشش (`totalCoverage`).

### ۸.۵. اتصال فرانت‌اند و ادمین

- `frontend/src/lib/productSpecs.ts` (جدید): ادغام
  `specifications` → `specs` → `properties` → `guarantee` با حذف تکراری بر اساس
  کلید نرمال‌شده و تشخیص مترادف‌های گارانتی.
- `productData.ts` و `productService.ts` هر دو از همین تابع استفاده می‌کنند
  (پیش‌تر `specs: backend.specs` بود و بک‌اند چنین فیلدی ندارد ⇒ تب مشخصات خالی).
- `types/product.ts`: `guarantee?: string` اضافه شد.
- `ProductTabs.tsx`: حذف بلوک باقی‌مانده‌ی «مشخصات فنی» در سمت کلاینت (محصولات قدیمی)
  + تشخیص قالب ساختاریافته (`#f9fafb` / `Tahoma` / «محصول حرفه») و **حفظ کامل
  استایل‌های اینلاین** در آن حالت.
- `admin/ProductForm.jsx`: کارت «مشخصات فنی ثبت‌شده این کالا» با ویرایش/حذف/افزودن،
  دکمه‌ی «استخراج خودکار مشخصات از جدول توضیحات» (بالای تب و بالای ادیتور)،
  بارگذاری `specs` از `properties` + `specifications`، و ارسال `payload.specifications`.

### ۸.۶. نتایج اعتبارسنجی این مرحله

| بررسی | نتیجه |
|---|---|
| `npm --prefix ekgkala-backend test` | **۰ خطا** (exit=0) |
| `filtering-engine.test.cjs` | **۲۷/۲۷** (شامل SG8-S و propBase) |
| `npm --prefix frontend run typecheck` | بدون خطا |
| `npm --prefix frontend test` | **۳۰۹/۳۰۹** (شامل ۵ تست `productSpecs`) |
| `npm --prefix admin run build` | **موفق** (`✓ built in 7.77s`) |

**محدودیت باقی‌مانده:** آزمایش انتها-به-انتها با MongoDB واقعی همچنان انجام نشده
(نه `mongod` بود نه Docker)؛ تست‌ها با `mingo` اجرا می‌شوند.

---

## ۹) Commit 48.3 — موتور تطبیق‌پذیر و خودبه‌روزرسان

### ۹.۱. رفع تکرار ردیف‌های هم‌معنا (۱۳ → ۹)

**ریشه:** `specifications` برچسب خام دارد (`فرکانس ریموت`) و `properties` برچسب
استاندارد (`فرکانس کاری`). هر سه مصرف‌کننده (PDP، فرم ادمین، فید ترب) کلید مقایسه را
از جدول مترادف‌ها عبور نمی‌دادند ⇒ هر ۴ ویژگی هم‌معنا دو بار می‌آمد.

**راه‌حل:** کلید مقایسه = `normCompareKey(canonicalizeSpecLabel(label))` در سه نقطه:

| محل | پیاده‌سازی |
|---|---|
| `utils/torobMapper.js` | `mapSpecifications` → کلید کانونیکال؛ ردیف اول (متن کامل) برنده |
| `frontend/src/lib/productSpecs.ts` | `SYNONYM_GROUPS` + `normalizeLabelKey` |
| `admin/src/utils/specKey.js` (جدید) | `normSpecKey` برای ادغام در فرم ادمین |

نتیجه‌ی سنجش: `Object.keys(mapSpecifications(prepared)).length === 9` (نه ۱۳) و
`buildProductSpecs(...)` هم ۹ ردیف.

### ۹.۲. فشرده‌ساز هوشمند عمومی (`condenseDescriptiveValueToBucket`)

پیش از بررسی طول جمله در `normalizeFacetValue` اجرا می‌شود و چهار کار می‌کند:

1. حذف پسوندهای توصیفی («قابل برنامه‌ریزی»، «کنترلی»، «در فضای باز»، «در حالت استندبای»،
   «با قابلیت …»، «پشتیبانی از …»، «به همراه …»)
2. حذف پرانتز توضیحی انتهایی اگر بخش قبلش ۲..۳۰ کاراکتر باشد
3. برای کلیدهای `تعداد …`: `«<عدد> <کلمه بعدی>»`
4. کمیت ابتدای متن: `«<عدد> <واحد استاندارد>»`

نمونه‌ها: `20 حافظه پیامک و تماس` → `20 حافظه` · `4 پورت 10/100` → `4 پورت` ·
`12 ولت DC (قابلیت کارکرد از 9 تا 15 ولت)` → `12 ولت` · `100 متر در فضای باز` → `100 متر`.

به‌علاوه `CORE_IDENTITY_KEYS` (۱۷ ویژگی هویتی) و `isCoreIdentityKey` اضافه شد، و
`BUILTIN_KEY_SYNONYMS` با ۴ گروه جدید (تعداد زون، پشتیبانی از سیم‌کارت، نحوه کنترل،
جریان مصرفی) گسترش یافت.

### ۹.۳. خودبه‌روزرسانی دائمی فست‌های دسته (`autoEvolveCategoryFacets`)

سرویس جدید `services/categoryFacetEvolution.js`:

- `loadCategoryRulesWithAncestors` — قواعد دسته + والدها با `$graphLookup`
- `autoEvolveCategoryFacets` — افزودن ویژگی/گزینه به `category.properties`

قواعد: تصمیم `isFilterable: false` ادمین محترم است؛ گزینه‌ها تا ۶۰ مورد؛ حداکثر ۲۴
ویژگی در هر دسته؛ ویژگی‌های هویتی `isPinned` می‌شوند (سقف ۴) و ترتیب ۱..۱۷ می‌گیرند؛
کلیدهای صرفاً جدولی هرگز خودکار اضافه نمی‌شوند.

**محل‌های فراخوانی:** `normalizeProductSpecPayload` (ذخیره‌ی محصول)، `handleProductImport`
(یک بار به ازای هر دسته پس از درون‌ریزی، با فیلد `facetsEvolved` در پاسخ)، و اسکریپت
`scripts/backfillProductSpecs.js`.

### ۹.۴. هویت تک‌محصول

قاعده‌ی قبلی `liveValues.length < 2 → حذف` باعث می‌شد دسته‌ی تک‌محصول هیچ فیلتری
نداشته باشد. اکنون فقط `0` یا `>18` حذف می‌شود و رتبه‌بندی بر اساس
`(چندمقداره ? 2 : 0) + (هویتی ? 1 : 0)` است. نتیجه: SG8-S تنها در دسته‌اش، هر ۵ فست
هویتی را با `count: 1` نشان می‌دهد.

**باگ جانبی که در همین مسیر پیدا و رفع شد:** `rankAndFormatPropertyFacets` کلید قواعد را
فقط از `rule.key` می‌گرفت؛ اگر قواعد خام (بدون `mergeCategoryRules`) داده می‌شد، همه
`isConfigured=false` می‌شدند. اکنون `rule.key || normCompareKey(rule.name)`.

### ۹.۵. Paste هوشمند در ویرایشگر ادمین

- `RichTextEditor.jsx`: تشخیص قالب ساختاریافته (`#f9fafb` / `Tahoma` / `<!-- Header` /
  `<table`) و باز شدن خودکار در **حالت HTML** تا Quill استایل‌ها را تخریب نکند؛
  به‌علاوه رهگیری `paste` در فاز capture: کد HTML خام مستقیماً به حالت HTML می‌رود.
- `ProductForm.jsx`: `Form.useWatch('description')` + `handleDescriptionChange` ⇒
  به‌محض Paste شدن جدول، مشخصات بلافاصله استخراج، جدول از توضیحات حذف و پیام موفقیت
  نمایش داده می‌شود (بدون کلیک).

### ۹.۶. تکمیل درون‌ریزی و مهاجرت

- `specsForImportRow`: شرط `hasSpecs` (properties **یا** specifications)، بازگرداندن
  `description` و `guarantee`، و ثبت آن‌ها در هر دو مسیر create/update.
- قواعد دسته در درون‌ریزی با ارث‌بری والدها (در حافظه، بدون کوئری اضافه).
- `backfillCategoryProductSpecs`: افزودن `{ specifications: { $exists: false } }` و
  `{ description: /<table/i }` به شرط، و ذخیره‌ی `description`/`guarantee`.
- `scripts/backfillProductSpecs.js`: `--dry-run` / `--apply` / `--verbose` / `--limit=N`.

### ۹.۷. نتایج اعتبارسنجی Commit 48.3

| بررسی | نتیجه |
|---|---|
| `npm --prefix ekgkala-backend test` | **۰ خطا** (exit=0) |
| `filtering-engine.test.cjs` | **۳۰/۳۰** (۳ تست جدید 48.3) |
| `npm --prefix frontend run typecheck` | بدون خطا |
| `npm --prefix frontend test` | **۳۱۰/۳۱۰** (۶ تست `productSpecs`) |
| `npm --prefix admin run build` | **موفق** |

**محدودیت باقی‌مانده:** آزمایش انتها-به‌انتهای مهاجرت با MongoDB واقعی انجام نشد
(نه `mongod` بود نه Docker)؛ اسکریپت مهاجرت آماده است و باید در محیط با دیتابیس
ابتدا با `--dry-run` اجرا شود.
