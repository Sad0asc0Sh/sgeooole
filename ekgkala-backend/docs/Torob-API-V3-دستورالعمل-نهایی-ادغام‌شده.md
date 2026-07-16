# دستورالعمل نهایی پیاده‌سازی Torob API V3 در پروژه sgeooole (ekgkala-backend)

> این سند نسخه‌ی ادغام‌شده‌ی دو تحلیل قبلی است: قوانین اجرا/انضباط کاری از نسخه‌ی خلاصه + جزئیات فنی دقیق برگرفته از بررسی واقعی کد پروژه (مدل Product، منطق قیمت در cartController، ساختار URL فرانت). این فایل را عیناً به AI مجری (با دسترسی کامل به ریپازیتوری) بدهید.

---

## بخش A — قوانین اجرا (این بخش را قبل از هر خطی از کد بخوان)

1. **منبع حقیقت مستندات رسمی Torob API V3 است.** هیچ endpoint، header، فرمت request/response یا مکانیزم authentication را حدس نزن. اگر جایی از این سند یک مقدار (مثل الگوریتم دقیق JWT یا claims آن) نامشخص گذاشته شده، آن را با placeholder/env قابل‌تنظیم پیاده کن، نه با فرض دلبخواهی.
2. **قبل از کدنویسی، کد فعلی را بخوان و از آن استفاده‌ی مجدد کن**، به‌خصوص:
   - منطق محاسبه‌ی قیمت نهایی و تخفیف (`controllers/cartController.js`)
   - ساخت `page_url` (باید با `buildProductUrl` فرانت یکی باشد)
   - مدل `Product` (ساده/متغیر، تصاویر، موجودی)
   اگر منطق مشترکی (مثل محاسبه‌ی قیمت) در چند جا تکرار می‌شود، فقط در همین حد که برای Torob لازم است آن را در یک Service/Util مشترک استخراج کن؛ Refactor اضافی و بی‌ربط انجام نده.
3. **محدوده‌ی تغییرات: فقط Backend.** موارد زیر **دست‌نخورده** باقی بمانند:
   - `frontend/` (Next.js، React components، `ProductPageClient`، SSR/SSG، SEO، `sitemap`، `robots.txt`)
   - هیچ HTML یا مسیر مخصوص crawler ساخته نشود؛ اتصال کاملاً سمت Backend (Express) و مستقل از رندر صفحات سایت انجام می‌شود.
4. **ترتیب اجرا:** اول ماژول Torob را کامل و صحیح بساز و با چک‌لیست بخش G تست کن. **یک «فید مسطح‌شده» (flattened feed) از همان مرحله‌ی اول الزامی است** (دلیل فنی در بخش D.2) چون بدون آن صفحه‌بندی با محصولات Variant درست کار نمی‌کند. **Redis پیاده‌سازی پیشنهادی و توصیه‌شده‌ی این فید است** — چون پروژه از قبل Redis راه‌اندازی‌شده و ساده‌ترین/سریع‌ترین گزینه است — ولی الزام فنی، خودِ «فید مسطح‌شده» است نه ابزار خاص؛ اگر پیاده‌سازی دیگری (مثلاً یک Collection materialized در MongoDB) بتواند صفحه‌بندی پایدار و کارایی مناسب را تضمین کند، آن هم قابل قبول است. بهینه‌سازی‌های بعدی کش (TTL، invalidation event-based) می‌توانند در فاز دوم بیایند.
5. **حالت اجرا: Implementation Mode.** فقط تحلیل و پیشنهاد ندهید — کد را واقعاً بنویسید و در پروژه اعمال کنید. بعد از هر مرحله (هر فایل/گروه فایل) گزارش کوتاه بدهید: چه فایل‌هایی ساخته/تغییر داده شد، چه تستی اجرا شد، چه مشکلی باقی ماند.
6. **امنیت:** هیچ secret (کلید عمومی/خصوصی، env) در کد هاردکد نشود. توکن‌های JWT در هیچ لاگی ذخیره یا چاپ نشوند (فقط payload غیرحساس در صورت نیاز).
7. در پایان کار، خروجی نهایی باید شامل باشد: (۱) فهرست فایل‌های ایجادشده، (۲) فهرست فایل‌های تغییریافته و دلیل هرکدام، (۳) آدرس نهایی endpoint، (۴) نمونه‌ی واقعی request/response از محیط تست، (۵) نتیجه‌ی تست‌های بخش G، (۶) تأیید build موفق backend و frontend بدون breaking change.

---

## بخش B — یافته‌های بررسی پروژه (زمینه‌ی فنی)

| مورد | یافته |
|---|---|
| Backend | `ekgkala-backend/` — Express + Mongoose (CommonJS) |
| مدل محصول | `models/Product.js` — `productType: 'simple' \| 'variable'` با آرایه‌ی `variants` |
| قیمت/تخفیف | `price`, `compareAtPrice`, `discount` (٪), `isFlashDeal`, `isSpecialOffer` — فرمول محاسبه‌ی نهایی در `controllers/cartController.js` |
| موجودی | `stock` (ساده) یا `variant.stock` (هر تنوع) |
| تصاویر | آرایه‌ی `{url, public_id}` روی ParsPack S3 |
| دسته‌بندی | `models/Category.js` (فیلد `name`) |
| شناسه‌ی پایدار محصول | `productCode` (فرمت `KY-XXXXXXX`، یکتا، تولید و حفظ در `pre('save')`) — پایدارتر از `slug` |
| آدرس صفحه‌ی محصول | الگوی `/product/{productCode}/{slug}/` — تابع `buildProductUrl()` در `frontend/src/lib/paths.ts` + `NEXT_PUBLIC_SITE_URL` / بک‌اند: `FRONTEND_URL` در `.env` |
| کش | Redis از قبل راه‌اندازی‌شده (`utils/redis.js`) |
| Rate limit فعلی | `productLimiter` روی `/api/products` و `limiter` عمومی روی `/api` — مسیر Torob باید از این‌ها مستثنی و با limiter مجزا محافظت شود |
| کتابخانه‌ی JWT | `jsonwebtoken` (نصب‌شده) — کافی برای verify امضای RS256 |
| الگوی ثبت روت | `server.js` با `app.use('/api/xxx', xRoutes)` |

نتیجه: هیچ تغییر اساسی در مدل‌ها لازم نیست؛ فقط یک لایه‌ی مپینگ + endpoint امن روی داده‌ی موجود ساخته می‌شود.

---

## بخش C — پیش‌نیازهایی که باید از خود Torob گرفته شود

اگر AI مجری به این‌ها دسترسی ندارد، باید env-driven پیاده‌سازی کند و این‌ها را به‌عنوان TODO مشخص در گزارش نهایی فهرست کند، نه این‌که حدس بزند:

1. کلید عمومی (Public Key، احتمالاً RS256) برای verify هدر `X-Torob-Token`.
2. ساختار دقیق claims توکن (`iss`/`aud`/`exp`) طبق صفحه‌ی رسمی امنیت درگاه Torob.
3. آدرس نهایی endpoint که پس از اتمام کار باید در پنل Torob ثبت شود.
4. (اختیاری) آی‌پی‌های Torob در صورت نیاز به whitelist در Nginx/فایروال.

---

## بخش D — طراحی فنی و ساختار ماژول

### D.1 فایل‌های جدید

```
ekgkala-backend/
├── middleware/torobAuth.js       ← اعتبارسنجی JWT (RS256)
├── controllers/torobController.js ← منطق سه‌حالته page/sort, page_urls, page_uniques
├── utils/torobMapper.js          ← تبدیل Product doc → آبجکت خروجی Torob (فقط تبدیل داده؛ بدون منطق کسب‌وکار جدید)
├── routes/torob.js               ← تعریف POST route
└── jobs/torobFeedCache.js        ← ساخت/تازه‌سازی فید مسطح‌شده (پیاده‌سازی پیشنهادی: Redis)
```

تغییرات در فایل‌های موجود: `server.js` (ثبت روت + استثنای rate limit)، `.env`/`.env.example`، به‌صورت اختیاری `models/Product.js`.

### D.2 چالش فنی مرکزی: صفحه‌بندی وقتی محصولات Variant دارند

طبق مستندات Torob هر صفحه (به‌جز آخری) باید **دقیقاً ۱۰۰ ردیف** داشته باشد. اما یک محصول `variable` باید به چند ردیف (هر تنوع = یک `page_unique` مجزا) تبدیل شود. بنابراین `skip/limit` مستقیم روی collection اسناد محصول، عدد صحیحی نمی‌دهد (چون واحد شمارش سند است، نه ردیف خروجی).

**راه‌حل الزامی:** یک فید مسطح‌شده (flattened feed) نگه‌داری شود. **الزام فنی، وجود همین فید مسطح‌شده است، نه ابزار ذخیره‌سازی خاص.** پیاده‌سازی پیشنهادی (توصیه‌شده، نه اجباری) با Redis:
- روی رویداد ذخیره/حذف/فعال‌سازی محصول (یا با یک job زمان‌بندی‌شده هر ۵-۱۰ دقیقه، هرکدام ساده‌تر بود) کل محصولات `isActive:true` را بخوان، هر محصول ساده را به یک ردیف و هر تنوع را به یک ردیف تبدیل کن، و دو نسخه‌ی مرتب‌شده (بر `createdAt` و بر `updatedAt`) یا یک نسخه‌ی خام که در لحظه‌ی serve سورت می‌شود را در Redis ذخیره کن.
- **جایگزین قابل‌قبول:** اگر AI مجری یا تیم توسعه ترجیح دهد، همین فید را می‌توان به‌صورت یک Collection materialized در MongoDB (بازسازی‌شده با همان رویداد/job) یا هر مکانیزم دیگری پیاده کرد، به‌شرطی که دو ویژگی را تضمین کند: (۱) صفحه‌بندی پایدار و صحیح («دقیقاً ۱۰۰ ردیف در هر صفحه، به‌جز آخری»)، (۲) کارایی مناسب زیر بار کرال مکرر Torob. انتخاب Redis در این سند صرفاً چون پروژه از قبل آن را دارد، منطقی‌ترین گزینه است، نه یک محدودیت معماری.
- در هر درخواست `page+sort`: از کش بخوان (در صورت نبود/انقضا، lazy rebuild کن)، مرتب‌سازی موردنظر را اعمال کن، `slice((page-1)*100, page*100)` بزن، `total` و `max_pages` را از طول آرایه محاسبه کن.
- اگر `page` بزرگ‌تر از `max_pages` بود → `products: []` برگردان (نه خطا).

این تنها بخشی از پروژه است که «فید مسطح‌شده» از ابتدا **الزامی** است، نه صرفاً بهینه‌سازی — چون بدون آن، شمارش صحیح صفحات ممکن نیست. ابزار پیاده‌سازی آن (Redis یا جایگزین) انتخابی است، خودِ وجود این لایه انتخابی نیست.

### D.3 Authentication (`middleware/torobAuth.js`)

- هدرها: `X-Torob-Token`، `C-Torob-Token-Version`.
- بدون توکن → `401` با `{"error": "X-Torob-Token header is missing"}`.
- verify با `jsonwebtoken.verify(token, TOROB_PUBLIC_KEY, { algorithms: ['RS256'] })`؛ کلید از env (`TOROB_PUBLIC_KEY`)، هرگز هاردکد.
- امضای نامعتبر/منقضی → `401` با `{"error": "invalid or expired torob token"}`.
- عدم تطابق `C-Torob-Token-Version` با مقدار مجاز env (`TOROB_TOKEN_VERSION`) → فقط لاگ هشدار (نه رد درخواست)، مگر مستندات رسمی صراحتاً رد کردن را الزامی کند.
- هیچ هدر یا توکن دیگری معتبر شناخته نشود.
- **توکن در هیچ لاگی ذخیره نشود.**

```js
// middleware/torobAuth.js
const jwt = require('jsonwebtoken')
const TOROB_PUBLIC_KEY = (process.env.TOROB_PUBLIC_KEY || '').replace(/\\n/g, '\n')

function torobAuth(req, res, next) {
  const token = req.headers['x-torob-token']
  if (!token) return res.status(401).json({ error: 'X-Torob-Token header is missing' })
  if (!TOROB_PUBLIC_KEY) return res.status(500).json({ error: 'torob public key is not configured' })

  try {
    req.torob = { payload: jwt.verify(token, TOROB_PUBLIC_KEY, { algorithms: ['RS256'] }) }
    return next()
  } catch (err) {
    return res.status(401).json({ error: 'invalid or expired torob token' })
  }
}
module.exports = { torobAuth }
```

### D.4 Endpoint و ثبت روت

مسیر: **`POST /api/torob/products`** (در صورت الزام مستندات رسمی یا پنل Torob، مسیر قابل تغییر است — این فقط پیشنهاد است، نه محدودیت مستندات).

```js
// server.js
const { torobAuth } = require('./middleware/torobAuth')
const torobRoutes = require('./routes/torob')
app.use('/api/torob', torobAuth, torobRoutes)
```

- این مسیر باید از `limiter` عمومی `/api` مستثنی شود (اضافه به لیست `skip`) و با یک `torobLimiter` مجزا (مثلاً ۶۰-۱۲۰ req/min بر IP) محافظت شود تا کرال دوره‌ای Torob مسدود نشود ولی در برابر سوءاستفاده محافظت باشد.
- CORS نیازی به تغییر ندارد (تماس سرور-به-سرور است).

### D.5 اعتبارسنجی ورودی (بدون هیچ مقدار پیش‌فرض)

بدنه باید **دقیقاً یکی** از سه حالت باشد؛ در غیر این صورت `400`:

| ورودی | خطای نمونه (اگر نامعتبر) |
|---|---|
| بدنه خالی | `{"error": "request body is empty"}` |
| `page` هست، `sort` نیست | `{"error": "sort parameter is not provided"}` |
| `sort` مقدار نامعتبر | `{"error": "sort value is invalid"}` |
| هر دو گروه پارامتر هم‌زمان | `{"error": "only one of page_urls, page_uniques or page+sort must be provided"}` |
| `page_urls`/`page_uniques` خالی یا غیرآرایه | `{"error": "page_urls must be a non-empty array"}` |

همه با status **400** و فرمت `{"error": "..."}` مطابق نمونه‌ی رسمی مستندات.

### D.6 نگاشت داده (`utils/torobMapper.js`)

> Mapper فقط تبدیل داده است؛ منطق کسب‌وکار (قیمت، موجودی) از سرویس/کنترلر موجود فراخوانی می‌شود، نه بازنویسی موازی.

**شناسه‌ها (باید پایدار بمانند):**
- `page_unique`: ساده → `product.productCode`؛ تنوع → `` `${product.productCode}_${variant._id}` ``. **از `slug` استفاده نشود** (چون ممکن است تغییر کند و طبق مستندات، تغییر این شناسه محصول را از دسترس Torob خارج می‌کند).
- `product_group_id`: فقط برای `productType==='variable'` → `product.productCode` مشترک بین تنوع‌ها؛ برای ساده → `null`.
- `page_url`: باید **دقیقاً** با خروجی `buildProductUrl()` فرانت یکسان باشد (الگو: `${FRONTEND_URL}/product/${productCode}/${slug}/`). چون فرانت برای هر تنوع صفحه‌ی مجزا ندارد، فاز اول: همه‌ی تنوع‌های یک محصول همان `page_url` پایه را دارند (فقط `image_links`/`spec` بر اساس تنوع فرق می‌کند). افزودن query param اختصاصی هر تنوع (نیازمند تغییر فرانت) **در این فاز ممنوع است** طبق قید بخش A.3؛ به‌عنوان بهبود آینده یادداشت شود، نه پیاده‌سازی شود.

**عنوان/توضیح:**
- `title` = `product.name` (تا ۵۰۰ کاراکتر).
- `subtitle` = `null` (مدل فیلد نام انگلیسی ندارد).
- `short_desc` = `product.description` با **حذف تگ‌های HTML** (چون در فرانت با `dangerouslySetInnerHTML` رندر می‌شود)، trim، حداکثر ۵۰۰ کاراکتر.
- `category_name` = `product.category.name` (populate)، یا `null`.
- `guarantee` = اگر فیلد در مدل نبود، `null` (بخش F).

**قیمت — باید دقیقاً همان منطق `cartController.js` باشد (بازنویسی موازی متفاوت ممنوع):**

```js
const basePrice = Number((variant && variant.price) ?? product.price ?? 0)
const rawDiscount = Number(product.discount) || 0
const now = new Date()
const flashActive = Boolean(product.isFlashDeal && (!product.flashDealEndTime || new Date(product.flashDealEndTime) > now))
const specialActive = Boolean(product.isSpecialOffer && (!product.specialOfferEndTime || new Date(product.specialOfferEndTime) > now))

let appliedDiscount = 0
if (flashActive || specialActive) appliedDiscount = rawDiscount
else if (!product.isFlashDeal && !product.isSpecialOffer && rawDiscount > 0) appliedDiscount = rawDiscount

const finalPrice = appliedDiscount > 0
  ? Math.max(0, Math.round(basePrice - (basePrice * appliedDiscount) / 100))
  : basePrice

current_price = finalPrice   // همیشه int، هرگز null/float/string
old_price = product.compareAtPrice > finalPrice
  ? product.compareAtPrice
  : (appliedDiscount > 0 ? basePrice : null)
```

اگر این فرمول به یک تابع مشترک (مثلاً `services/pricingService.js`) منتقل و هم در `cartController` هم در `torobMapper` استفاده شود، بهتر است (طبق بخش A.2) — ولی رفتار فعلی API‌های موجود **دست‌نخورده** بماند.

**موجودی:**
```js
availability = product.isActive === true &&
  (product.productType === 'simple' ? product.stock > 0 : variant.stock > 0)
```
محصولات `isActive:false` کاملاً از خروجی حذف شوند (نه فقط `availability:false`).

**تصاویر:** `image_links` از `variant.images` (اگر موجود) وگرنه `product.images`، map به `img.url`، همان ترتیب فعلی حفظ شود (اولین = اصلی).

**Spec:** ادغام `product.specifications` + `product.properties` (`{label,value}`) + برای تنوع، `variant.options` (`{name,value}`؛ مثل رنگ/سایز) — همه به رشته تبدیل شوند.

**تاریخ‌ها:** `date_added = product.createdAt.toISOString()`، `date_updated = product.updatedAt.toISOString()` (هر دو timezone-aware، طبق مستندات مجاز است `Z`).

**seller_name/seller_city:** فروشگاه تک‌فروشنده است (نه marketplace) → این دو فیلد ارسال نشوند.

### D.7 سه حالت درخواست

- **`page`+`sort`**: از فید مسطح‌شده‌ی کش (D.2) بخوان، مرتب‌سازی (`date_added_desc`/`date_updated_desc`) اعمال کن، صفحه‌بندی ۱۰۰تایی کن.
- **`page_uniques`**: هر شناسه را parse کن (`PRODUCTCODE` یا `PRODUCTCODE_variantId`)، از DB مستقیم query کن (نیازی به کش نیست چون تعداد کم است)، آیتم‌های یافت‌نشده/غیرفعال را **بدون خطا حذف کن** (نه 404، طبق رفتار رسمی مستندات که محصول حذف‌شده باید نتیجه‌ی خالی بدهد).
- **`page_urls`**: از هر URL با regex، `productCode` را استخراج کن (بخش path بعد از `/product/`)، سپس مثل `page_uniques` عمل کن. URLهایی که parse نمی‌شوند، نادیده گرفته شوند (حذف از خروجی).

### D.8 فرمت پاسخ (هر سه حالت یکسان)

```json
{
  "api_version": "torob_api_v3",
  "current_page": 1,
  "total": 150,
  "max_pages": 2,
  "products": [ /* خروجی torobMapper */ ]
}
```

---

## بخش E — متغیرهای محیطی جدید

```
TOROB_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
TOROB_TOKEN_VERSION=1
TOROB_FEED_CACHE_TTL_SECONDS=600
```

`FRONTEND_URL` موجود از قبل برای ساخت `page_url` استفاده شود؛ دامنه هاردکد نشود.

---

## بخش F — تغییرات اختیاری (بلاکر نیستند)

در `models/Product.js` می‌توان اضافه کرد (فقط در صورت نیاز واقعی، طبق قانون A.2 «Refactor فقط در صورت ضرورت»):

```js
excludeFromTorob: { type: Boolean, default: false }, // مخفی‌کردن محصول خاص از فید Torob
guarantee: { type: String, trim: true, maxlength: 200, default: '' },
```

بدون این دو فیلد هم فاز اول قابل تحویل است (`guarantee: null`، بدون قابلیت exclude).

---

## بخش G — Logging و تست پذیرش

**Logging:** هر درخواست (IP، حالت ورودی، تعداد محصول برگشتی، مدت پاسخ، خطا در صورت وجود) با الگوی مشابه `securityLogger` موجود لاگ شود. **توکن هرگز لاگ نشود.**

**تست‌های الزامی (باید با curl واقعی اجرا و در گزارش نهایی پیوست شود):**

```bash
# صفحه‌ی دوم لیست
curl -X POST https://www.ekgkala.ir/api/torob/products \
  -H "Content-Type: application/json" -H "X-Torob-Token: <JWT>" -H "C-Torob-Token-Version: 1" \
  -d '{"page": 2, "sort": "date_added_desc"}'

# تک محصول با page_url
curl ... -d '{"page_urls": ["https://www.ekgkala.ir/product/KY-0000001/slug/"]}'

# تک محصول با page_unique
curl ... -d '{"page_uniques": ["KY-0000001"]}'

# محصول حذف‌شده/ناموجود در سایت → products: []
curl ... -d '{"page_uniques": ["KY-0000000-NOT-EXIST"]}'

# ورودی ناقص → 400
curl ... -d '{"page": 1}'   # انتظار: {"error": "sort parameter is not provided"}

# بدون توکن → 401
curl -X POST https://www.ekgkala.ir/api/torob/products -d '{"page":1,"sort":"date_added_desc"}'

# توکن نامعتبر → 401
# محصول Variant → هر تنوع یک page_unique مجزا با spec/image متفاوت
```

**چک‌لیست پذیرش:**
- [ ] `current_price` همیشه int، هرگز null/رشته/اعشار
- [ ] محصولات `isActive:false` هرگز در خروجی نیستند
- [ ] هر صفحه (به‌جز آخری) دقیقاً ۱۰۰ ردیف
- [ ] `page_unique` بین چند بار فراخوانی ثابت می‌ماند
- [ ] `page_url` مطلق و دقیقاً برابر با آدرس واقعی صفحه محصول
- [ ] `image_links` حداقل یک آیتم، اولی = تصویر اصلی، بدون thumbnail
- [ ] تاریخ‌ها timezone-aware
- [ ] بدون توکن → 401؛ بدنه نامعتبر → 400 با `{"error":"..."}`
- [ ] endpoint خارج از rate limit عمومی و پایدار زیر بار پیوسته
- [ ] **Backend build موفق، Frontend build موفق، هیچ breaking change در API‌های موجود**

---

## بخش H — خلاصه‌ی گام‌های اجرا (Task List)

1. افزودن متغیرهای env (بخش E).
2. `middleware/torobAuth.js`.
3. `utils/torobMapper.js` (شامل فراخوانی/بازاستفاده از منطق قیمت موجود، نه بازنویسی مستقل).
4. `jobs/torobFeedCache.js` (فید مسطح‌شده — طبق D.2 خودِ فید الزامی است، Redis پیاده‌سازی پیشنهادی است نه اجباری).
5. `controllers/torobController.js` (اعتبارسنجی + سه حالت + پاسخ استاندارد).
6. `routes/torob.js`.
7. ثبت روت در `server.js` + استثنای rate limiter + `torobLimiter` مجزا.
8. (اختیاری) فیلدهای `excludeFromTorob`/`guarantee` در `Product.js` + UI پنل ادمین.
9. اجرای کامل تست‌های بخش G و رفع مغایرت‌ها.
10. تأیید build کامل backend + frontend، بدون breaking change.
11. گزارش نهایی مطابق بخش A.7 (فایل‌ها، دلایل، endpoint نهایی، نمونه request/response، نتیجه‌ی تست‌ها).
12. یادآوری برای ثبت آدرس endpoint در پنل Torob و اخذ کلید عمومی نهایی برای production.
