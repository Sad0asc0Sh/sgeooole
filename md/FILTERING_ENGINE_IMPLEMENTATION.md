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
