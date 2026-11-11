# تحلیل معماری چت‌بات فروشگاه ای‌کا‌جی کالا

**نسخه:** ۱.۰ | **تاریخ:** ۲۰۲۶-۱۱-۰۹ | **وضعیت:** بررسی کامل کد فعلی + نقشه راه RAG/Vector

---

## ۱. نمای کلی معماری فعلی (What Exists Today)

چت‌بات موجود سه لایه اصلی دارد:

### لایه فرانت‌اند (Next.js — `frontend/src/components/features/ai/`)
| فایل | نقش |
|---|---|
| `AIChatSheet.tsx` | شیت کامل گفت‌وگو، SSE reader، مدیریت پیام‌ها، کش محلی |
| `ChatPackageCard.tsx` | کارت پیش‌فاکتور نهایی پک + افزودن به سبد |
| `ChatWizardStep.tsx` | پنل مرحله‌به‌مرحله انتخاب کالا |
| `ChatPackageBuilder.tsx` | ویرایش دستی پک (تعداد/حذف بخش) — **دوپهلو** |
| `chatCache.ts` | ذخیره‌سازی localStorage با انقضا ۲۴ ساعته |

### لایه بک‌اند (Express — `ekgkala-backend/`)
| فایل | نقش |
|---|---|
| `controllers/chatController.js` (۱۲۹۱ خط) | تمام منطق: loadConversation، preparePackWizard، prepareConsultation، handleCctvTurn، buildChatContext، ۳ handler (message/message-stream/chat) |
| `utils/groqService.js` | انتخاب ارائه‌دهنده، failover، بازگشت با max_tokens بالاتر، فیلتر تگ‌های تفکر، SSE consumer |
| `utils/chatRetrieval.js` | موتور جست‌وجوی دقیق + امتیازدهی + grounding — **قلب RAG دستی** |
| `utils/packWizard.js` | ویزارد پک‌ساز مرحله‌به‌مرحله بر پایه دسته‌بندی |
| `utils/cctvEngine.js` | رتبه‌بندی و annotate انتخاب دوربین |
| `services/cctvChatFlow.js` | درخت ثابت سوالات slot-filling قطعی |
| `services/cctvAssemblyEngine.js` | محاسبه قطعی کابل/هارد/برق/رکوردر |
| `models/ChatHistory.js` | ذخیره پیام‌ها + packWizard + consultation + cctvFlow در یک سند |

### مسیرهای API (`routes/chatRoutes.js`)
- `POST /api/chat` — fallback غیر-streaming
- `POST /api/chat/message` — گفت‌وگوی عمومی با LLM
- `POST /api/chat/stream` — SSE استریم توکن‌به‌توکن
- `POST /api/chat/pack/action` — select/skip/back/restart ویزارد
- `GET /api/chat/suggestions` — سوالات پیشنهادی
- `DELETE /api/chat/history` — پاکسازی تاریخچه

---

## ۲. نقاط قوت موجود (Strengths)

۱. **سکوی RAG دستی خوب طراحی شده:** `chatRetrieval.js` نرمال‌سازی فارسی (ی/ک عربی، نیم‌فاصله، اعراب)، استخراج کد کالا، امتیازدهی چندلایه (کد کالا ۶، نام ۴، دسته/برند ۲، مشخصات ۱)، فیلتر موجودی — واقعاً کار می‌کند.
۲. **جلوگیری از هالوسینیشن:** grounding اجباری؛ LLM فقط از بخش «محصولات مرتبط» اجازه نقل قول دارد.
۳. **مسیر قطعی بدون LLM:** `cctvChatFlow` + `cctvAssemblyEngine` پک دوربین را بدون هزینه توکن و بدون خطای هوش مصنوعی می‌سازند.
۴. **failover ارائه‌دهنده:** Circuit Breaker، retry با max_tokens دوبل (برای مدل‌های reasoning)، لاگ‌نویسی امن پاسخ خالی.
۵. **استریم SSE با فیلتر `think` در time-stream** — جلوگیری از نشت فرآیند تفکر به کاربر.
۶. **کش محلی فرانت** برای بازیابی تاریخچه پس از پرش به تب جدید.

---

## ۳. کشف شده: ایرادهای UI/UX — **مهم**

### ۳.۱ باگ بحرانی: انیمیشن Welcome در حالت `streamActive`
در `AIChatSheet.tsx:878` شرط زیر **هیچ‌وقت true نمی‌شود**:

```tsx
{msg.role === 'ai' && !streamActive && isLastAi && msg.wizard && msg.wizard.active ? (
  <ChatWizardStep .../>
) : null}
```

`streamActive` فقط وقتی true است که `isTyping && isLastAi`. یعنی:
- **اگر استریم زنده باشد:** wizard نمایش داده نمی‌شود (حتی اگر سرور فرستاده باشد) → کاربر پنل را نمی‌بیند.
- **اگر استریم تمام شود:** `isTyping=false` → شرط درست می‌شود.

این یعنی در حین تایپ زنده، پنل ویزارد و کارت‌ها **مخفی** می‌مانند. فقط پس از اتمام کاملاً ظاهر می‌شوند.

**حذف انیمیشن `streamActive`** یک انتخاب آگاهانه برای عدم پرش است، اما با `!streamActive` روی Wizard/Products/Packages اعمال شده که **غلط است** — کارت محصول (`:msg.package`) و کارت‌های محصول از دیتابیس (`:msg.products`) هم همین شرط را دارند. نتیجه: کاربر **هیچ‌گاه** کارت/پنل را حین تایپ نمی‌بیند و وقتی پاسخ کامل شد، همه‌چی با هم می‌پرد پایین.

### ۳.۲ پیام «در حال آماده‌سازی پاسخ...» همیشگی
```tsx
{isTyping && (
  <div className="flex gap-2 animate-pulse mt-1">
    ...
    <span>در حال آماده‌سازی پاسخ...</span>
  </div>
)}
```
این `div` **بدون فیلتر isLastAi** است. اگر کاربر وسط پاسخ قبلی پیام جدید بنویسد (قبل از اتمام)، پیام قبلی هنوز `isLoading` دارد + این پیام دوم اضافه می‌شود → **دو حالت loading موازی** در یک نوبت.

### ۳.۳ کارت محصول ناموجود + لینک هدف
- کارت‌های `msg.products` در `:msg.package` **و** `:msg.products.length > 0` **و** `isSticky` مخفی می‌شوند. وقتی پک نهایی هم هست، کارت تکراری از دیتابیس نشان داده می‌شود.
- کارت‌های محصول به `target="_blank"` باز می‌شوند — یعنی کاربر در تب جدید محصول را می‌بیند و **چت بسته می‌ماند** (نه برگشت). کش localStorage کمک می‌کند اما تجربه گسسته است.

### ۳.۴ دکمه ارسال ناپایدار (StrictMode)
`pendingRequestRef.current` یک `useRef` است — در React StrictMode/تکرار render ممکن است guard از کار بیفتد. علاوه بر آن، `abortRef` در `finally` صفر می‌شود حتی اگر کاربر دکمه رها کند → کاربر نمی‌تواند استریم را **لغو** کند.

### ۳.۴ (b) `ProductHeader` context گم‌شده
`ProductHeader` محصول فعلی را می‌گیرد (`product` prop) ولی آن را به `AIChatSheet` **نمی‌دهد** → بات نمی‌داند کاربر روی کدام صفحه است. یعنی «این کدوم بهتره؟» یا «نسخه ارزان‌ترش چیه؟» نمی‌تواند بر پایه product-context پاسخ دهد (چالش ۴.۴).

### ۳.۴ (c) `PackConfirmBar` → endpoint غیرواقعی `/chat/pack/state`
`PackConfirmBar.tsx:40` به `/chat/pack/state` (GET) درخواست می‌دهد که در `routes/chatRoutes.js` **تعریف نشده** (فقط `POST /api/chat/pack/action` هست). این یعنی:
- پک را از صفحه محصول شروع کرده و به صفحه جزئیات برگشته کاربر، پنل تأیید نهایی **هرگز کار نمی‌کند**.
- `validForStep`/`stepTitle` هیچ داده‌ای نمی‌گیرند.
- مسیر صحیح: فرانت باید مستقیماً `POST /api/chat/pack/action` با `action: select` + `productId` بفرستد (همان‌طور که `AIChatSheet.tsx:664` می‌کند).

### ۳.۴ (d) `aiProviderController.js` — `getRuntimeHealth` در `groqService` تعریف شده اما export نشده
`exports.getProviderRuntimeHealth = ...` فقط در انتهای فایل صادر شده، ولی `__private__` **forwardBuildOptions** را export می‌کند — `aiProviderController` از `getProviderRuntimeHealth` استفاده می‌کند ✓ (درست است). اما تست‌ها `ai.__private__.getProviderRuntimeHealth` را صدا می‌زنند که **وجود ندارد** (فقط `getRuntimeHealth` در controller است) → تست‌های مربوطه fail می‌شوند.

### ۳.۵ `ChatPackageBuilder` — کارکرد مبهم (دو نسخه تکراری)
این کامپوننت **همان** `ChatPackageCard` را پیاده‌سازی کرده (بخش‌ها + انتخاب + تعداد + افزودن همه). در UI فعلی هیچ‌جا render نمی‌شود (فقط در تست‌ها/مخزن است). اگر قرار است قابلیت ویرایش دستی پک داشته باشیم، باید به‌صورت یک Sheet جداگانه با دکمه «ویرایش پک» فراخوانی شود — در غیر این صورت کد مرده است.

### ۳.۶ وضعیت خطا نامرئی پس از بازگشت از تب
اگر استریم قطع شود و کاربر به تب برگردد، `chatCache` فقط پیام‌های ذخیره‌شده را برمی‌گرداند؛ **استییت `isError` روی `messages[0]` (خوشه خوشه) نمایش داده نمی‌شود** — خوشه خوشه خوشه خوشه خوشه خوشه خوشه. یعنی کاربر بعد از بازگشت نمی‌داند آخرین پاسخ خطا خورده.

### ۳.۷ استفاده‌های نامطمئن از `as unknown as`
در `buildBadges` و `extractLines`/`ChatPackageCard` — اگر سرور فیلد `requirements` یا `calculations` را ندهد، به جای مقدار پیش‌فرض `undefined` → `Number(undefined)` = NaN → `fa(NaN)` = "۰". نمایش **غلط صفر** به جای عدم وجود محاسبه.

### ۳.۸ `ChatWizardStep` — `recommendedQty` و `compatibilityHint` بدون فیلد
اگر سرور `recommendedQty` را نفرستد، `qty` پیش‌فرض ۱ است — مشکلی نیست. اما `compatibilityHint` فقط اگر وجود داشته باشد render می‌شود؛ اگر سرور `hints` را بیرون بفرستد اما فرانت فیلدش را تغییر دهد، **hint گم می‌شود** (بی‌خطر اما ناسازگار).

### ۳.۹ صفحه خوش‌آمدگویی و چت در هم
وقتی کاربر پیام می‌دهد، `messages.length > 0` → block خوش‌آمدگویی `max-h-0 scale-50` می‌شود اما **حالت `opacity-0` دارد**. در مرورگرهای قدیمی‌تر (یا هنگام تغییر سایز پنجره) `max-h-0` ممکن است overflow کند و block **به‌صورت خط‌تیره کوچک** دیده شود.

### ۳.۱۰ تعداد پیام‌های باقی‌مانده بدون خطا
`usage` در سرور محاسبه می‌شود (`dailyCount >= limit` → ۴۲۹). اما فرانت هیچ‌جا **۴۲۹ را به‌صورت UI Toast** نمایش نمی‌دهد — فقط error message ساده. همچنین `usage.remaining` در header نشان داده می‌شود اما **اگر سرور بازگشت روزانه را reset کند، فرانت باطله** (فرانت هیچ cache invalidation برای usage ندارد).

---

## ۴. شکاف‌ها نسبت به درخواست شما (RAG + تشخیص اطلاعات سایت)

کاربر خواسته: «باتی که با توجه به **سوالات کاربر** و **اطلاعات وبسایت** تشخیص نیاز دهد و به **دیتابیس وکتور** نیاز دارد».

### ۴.۱ دیتابیس وکتور وجود ندارد
هیچ مدلی برای embeddings وجود ندارد (`models/` ندارد: `Embedding.js`, `VectorIndex.js`, `Chunk.js`). تمام بازیابی **SQL-regex** است:
- `chatRetrieval.js` ← `Product.find({ $or: [{name: {$regex}}] })`
- این یعنی بازیابی **کلمه‌ای** — «دوربین ضدآب ۵ مگاپیکسل» باید عین عبارت در نام/کد باشد.

**شکاف‌ها:**
- پرسش‌های **معنایی**: «برای حیاط پشتی که سایه است چی پیشنهاد می‌کنی؟» ← هیچ محصولی match نمی‌شود (حتی اگر دوربین night-vision موجود باشد).
- پرسش‌های **مقایسه‌ای**: «کدوم دوربین کیفیت بهتری داره؟» ← پاسخ متنی تصادفی از دانش عمومی LLM ← **هالوسینیشن**.
- پرسش‌های **فیلتر-ترکیبی**: «دوربین تحت شبکه زیر ۵ میلیون» ← `cctvChatFlow` فقط اسلات‌های ثابت می‌داند، نه فیلترهای دلخواه.
- پرسش‌های **عمومی سایت**: «آیا ارسال به شهرستان دارید؟ هزینه‌اش چقدره؟» ← `SUPPORT_FAQ` فقط regex‌های از پیش تعریف‌شده را می‌پوشاند. هر صفحه جدید FAQ/شرایط → نیاز به آپدیت regex دارد.
- پرسش‌های **مرتبط به محصول فعلی**: در صفحه محصول، بات باید بداند کاربر روی کدام صفحه است — اما `AIChatSheet` **هیچ context محصولی** از فرانت نمی‌گیرد (مگر `ChatPackageBuilder` که از `/chat/pack/state` می‌گیرد).

### ۴.۲ دسته‌بندی نیت ضعیف
`classifyChatIntent` یک تابع regex است. موارد جدید هرگز خودکار پوشش نمی‌دهند. مثلاً `SUPPORT_FAQ` فقط ۱۸ الگوی خاص دارد.

### ۴.۳ `aiService.js` — **دور انداخته شده اما حذف نشده**
`ekgkala-backend/utils/aiService.js` (۳۵۶ خط) کد قدیمی با منطق fallback متنی ساده است. در `handleChatMessage` از `groqService` استفاده می‌شود — `aiService.js` **هرگز import نمی‌شود** (مرده، اما ۳۵۶ خط نویز).

### ۴.۴ عدم پراکس کردن صفحه/محتوا
هیچ مکانیزمی برای خواندن صفحات `frontend/src/app` (Products/Categories/Blog/FAQ/Contact) و تبدیل آن‌ها به embedding وجود ندارد.

### ۴.۵ مدل embedding
هیچ `AI_PROVIDER` برای embedding وجود ندارد، هیچ job فراخوانی `embed()` نمی‌کند، هیچ `VectorStore` (pgvector/MongoDB Atlas Vector Search / Pinecone) پیکربندی نشده.

---

## ۵. معماری پیشنهادی حرفه‌ای (Recommended Architecture)

### ۵.۱ لایه‌بندی جدید
```
┌──────────────────────────────────────────────────────┐
│            Frontend (Next.js)                        │
│  AIChatSheet (UI) ──> hooks: useChatStream()        │
│  ──> ProductContextProvider (صفحه محصول فعلی)       │
│  ──> siteContent cache (FAQ/Blog/Contact snippets)  │
└─────────────────────┬────────────────────────────┬──┘
                      │                            │
        ┌─────────────▼─────────┐   ┌─────────────▼──────────┐
        │   Edge Routing        │   │   Intent Router        │
        │   (API Gateway)       │   │   1. Deterministic     │
        └───────────┬───────────┘   │      2. RAG            │
                    │               │      3. Generic LLM    │
        ┌───────────▼───────────────▼───────────────────────┐
        │         Chat Router Service (new)                 │
        │  - intent classification (embedding similarity)   │
        │  - query rewriting + fallback chain               │
        └───┬───────────────────────┬───────────────────────┘
            │                       │
   ┌────────▼────────┐    ┌─────────▼──────────────┐
   │ RAG Engine      │    │ Deterministic Engines  │
   │ - retrieve      │    │ - cctvChatFlow         │
   │   top-K chunks  │    │ - packWizard           │
   │ - re-rank       │    │ - consultation flow    │
   │ - answer build  │    │                        │
   └─────┬───────────┘    └───────────┬────────────┘
         │                            │
   ┌─────▼──────────────┐    ┌────────▼──────────┐
   │ Vector DB          │    │  MongoDB          │
   │ - pgvector / Atlas │    │ - Product/Order   │
   │ - chunks:          │    │ - ChatHistory     │
   │   * product        │    │ - settings        │
   │   * category       │    └───────────────────┘
   │   * blog/faq page  │
   │   * site info      │
   │   * price rules    │
   └────────────────────┘
```

### ۵.۲ اجزای پایگاه داده جدید
جدول‌ها/مجموعه‌های جدید:
1. `VectorChunk` (`_id`, `type`, `refId`, `title`, `content`, `embedding[vector]`, `metadata{pageUrl, updatedAt, section}`)
2. `EmbeddingJob` (`entityType`, `entityId`, `status`, `lastEmbedAt`, `chunksIndexed`)
3. `IntentTemplate` (اختیاری — برای بازبینی انسان الگوهای جدید)

جریان embedding (job روزانه + on-change):
- هر بار Product Update/Create/Delete → `embedding-service` را trigger کن.
- job batch: برای همه `Product|Category|Page|Blog|FAQ` → split به chunks of ~۳۰۰ token → call embedding API (مثلاً `text-embedding-3-large` یا مدل فارسی `parler/tts` ... نه، `FaEmbed` / `sentence-transformers/paraphrase-multilingual-MiniLM`) → insert chunks.

### ۵.۳ رتبه‌بندی ترکیبی (Hybrid Re-ranking)
به‌جای حذف `chatRetrieval.js`، آن را به **Hybrid Search** تبدیل کن:
```
query → normalizeFa → (1) vector_similarity(top-30) + (2) keyword_match(top-30)
      → unified re-rank by:
          score = 0.55 * norm(vector_sim) + 0.30 * norm(keyword)
                + 0.10 * category_boost + 0.05 * freshness/salesCount
      → filter inStock → top 3 (یا top 5 برای مشاوره)
```
این همان منطق `chatRetrieval.js` را حفظ می‌کند **به‌عنوان بخش keyword** و vector را به آن اضافه می‌کند.

### ۵.۴ Intent Router جدید
`services/intentRouter.js` — تصمیم‌گیری اولویت:
1. `cctvChatFlow` اگر نیت «پک دوربین» (همان regex قبلی) → deterministic.
2. `packWizard` اگر «پک کامل + دسته‌بندی» → deterministic.
3. `product-context` اگر پیام حاوی `productCode`/`slug` یا **product context از فرانت** باشد → RAG با filter `type=product`.
4. **RAG عمومی** برای سوالات سایت/FAQ/قیمت/موجودی/مقایسه.
5. **Generic LLM** فقط اگر none match یا کاربر مستقیم سوال عمومی بپرسد.

### ۵.۵ افزایش context سایت
`services/siteContentService.js` — extract content از صفحات:
- `/faq`, `/contact`, `/shipping`, `/returns` → chunks + embedding.
- `Settings` store info.
- صفحه محصول فعلی → chunk خود صفحه + ۵ محصول مشابه.

این content در سیستم prompt تزریق می‌شود:
```
== منابع سایت ==
<faq chunks with pageUrl>
<shipping/returns rules>
```
و LLM **مجبور** است برای پاسخ به این منابع فقط از chunks استفاده کند.

### ۵.۶ تغییرات مدل داده
`ChatHistory` نیاز به فیلد جدید دارد:
```js
retrieval: {
  queryText: String,          // کاربر چه پرسید
  vectorResults: [{chunkId, sim, type, refId}],
  keywordResults: [...],
  intent: String,             // کدام مسیر انتخاب شد
  provider: String,           // برای tracing cost
  tokensUsed: Number,
  answeredBy: String,         // 'ragnorm' | 'cctv-deterministic' | 'llm-generic'
}
```

### ۵.۷ مسیر API جدید
- `POST /api/chat/retrieve` — pure retrieval (فرانت می‌تواند query بفرستد و product cards را خودش render کند).
- `GET /api/site/chunks?types=faq,product,page` — cache content.
- `GET /api/embed/status` — وضعیت indexing.

---

## ۶. نقشه اجرایی (Implementation Phases)

### فاز ۰ — اصلاحات فوری (بدون تغییر معماری)
| # | مشکل | اصلاح |
|---|---|---|
| 1 | ۳.۱ شرط `!streamActive` روی Wizard/Product cards | جدا کردن انیمیشن ورود (fade/slide) از `streamActive` — کارت‌ها باید به‌محض arrival سرور visible شوند |
| 2 | ۳.۲ پیام loading تکراری | فیلتر `isLastAi` اضافه کن |
| 3 | ۳.۴ دکمه لغو + StrictMode guard | دکمه «لغو» با `abortRef.abort()` + guard با `pendingRequestRef` فقط برای duplicate send |
| 4 | ۳.۶ نمایش خطا پس از بازگشت | در `loadChatCache` `isError` را روی خوشه خوشه خوشه خوشه |
| 5 | ۳.۷ NaN در fa() | `fa(Number(x) || 0)` یا `fa(Number.isFinite(x) ? x : undefined)` |

### فاز ۱ — بهبودهای UX (قبل از RAG)
- Sheet جدید `EditPackageSheet` برای `ChatPackageBuilder`.
- Toast برای rate-limit ۴۲۹.
- `ProductContext` provider در `ProductHeader` → ارسال `productCode`/`category` به فرانت.
- بهبود Welcome block (`overflow-hidden` + `transform` safe).

### فاز ۲ — زیرساخت Vector (قلب درخواست کاربر)
1. نصب `pgvector` روی PostgreSQL یا فعال‌سازی **MongoDB Atlas Vector Search**.
2. ایجاد مدل‌های جدید (`VectorChunk`, `EmbeddingJob`).
3. job روزانه (cron) + webhook on Product/Page change.
4. `services/embeddingService.js` — normalize → chunk → embed → upsert.
5. `services/vectorRetriever.js` — `query(vector, topK)`, `hybridSearch(query, filters)`.

### فاز ۳ — Intent Router + RAG
1. `services/intentRouter.js`.
2. تبدیل `chatRetrieval.js` به hybrid re-ranker.
3. `services/siteContentService.js` + embedding صفحات FAQ/Shipping/Returns/About/Blog.
4. به‌روزرسانی `groqService.buildMessages` برای تزریق `siteContext`.
5. `ChatHistory.retrieval` tracing.

### فاز ۴ — حذف/deprecate کد مرده
- `utils/aiService.js` → حذف یا refactor کامل به fallback عمومی.
- `ChatPackageBuilder.tsx` → اگر استفاده نمی‌شود حذف.
- `aiProviderController.js` بررسی — آیا هنوز استفاده می‌شود؟

---

## ۷. پیشنهادات فنی اضافی

۱. **قیمت لحظه‌ای:** `resolveProductDisplay` الان استفاده می‌شود — عالی. فقط مطمئن شو `now` در stream هم تزریق می‌شود (الان `now` در `buildFinalPackage` و `handleStreamMessage` به درستی `new Date()` است ✓).

۲. **تست‌ها:** تست‌های موجود (`tests/chat-architecture.test.cjs`) فقط unit-logic هستند. نیاز به **integration test** برای `hybridSearch` و `intentRouter` داری.

۳. **محدودیت توکن:** system prompt حدود ۶۰۰۰-۸۰۰۰ کاراکتر است. با اضافه کردن site chunks باید `productContext` را محدود به top-K کنی — در غیر این صورت **context window overflow** می‌شود.

۴. **Multi-turn context:** `buildMessages` فقط `history.slice(-8)` را می‌فرستد — خوب. اما `retrieval` باید **history-aware** باشد: query کاربر فعلی را با last 2 user messages ترکیب کن قبل از vector search (برای سوالات اشاره‌ای مثل «قیمتش چنده؟»).

۵. **مدیریت خطای Embedding API:** اگر embed API down شود، کد باید **graceful** باشد (keyword-only fallback) — نه crash.

---

## ۸. نتیجه‌گیری

معماری فعلی **پایه محکمی** دارد:
- ✅ Retrieval SQL خوب
- ✅ Deterministic engine عالی
- ✅ Failover + thinking-filter حرفه‌ای
- ❌ **هیچ embedding/vector DB وجود ندارد** ← این همان شکاف اصلی درخواست شماست
- ❌ **۱۰+ ایراد UI/UX** که برخی (مخفی ماندن wizard حین استریم) کاربردی و مهم‌اند

**اولویت اقدام:** فاز ۰ (اصلاحات فوری) → فاز ۱ (UX) → فاز ۲ (Vector infra) → فاز ۳ (Intent Router + RAG) → فاز ۴ (تمیزکاری).

آیا می‌خواهید **پیاده‌سازی فاز ۰ + ۱** را شروع کنم یا مستقیماً روی **فاز ۲ (Vector DB + embedding)** کار کنیم؟
