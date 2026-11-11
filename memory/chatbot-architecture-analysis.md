---
name: chatbot-architecture-analysis
description: تحلیل کامل معماری چت‌بات ای‌کا‌جی کالا + ۱۰+ ایراد UX کشف‌شده + نقشه راه RAG/Vector DB
metadata:
  type: project
---

چت‌بات فروشگاه ای‌کا‌جی کالا: بررسی کامل معماری (۲۰۲۶-۱۱-۰۹)

**ساختار فعلی:**
- Frontend: `frontend/src/components/features/ai/` — `AIChatSheet` (SSE + کش localStorage)، `ChatPackageCard` (پیش‌فاکتور)، `ChatWizardStep` (ویزارد مرحله‌به‌مرحله)، `ChatPackageBuilder` (دوپهلو/مرده)، `chatCache.ts`
- Backend: `ekgkala-backend/controllers/chatController.js` (۱۲۹۱ خط، تمام منطق)، `utils/groqService.js` (failover/provider/circuit breaker/thinking filter)، `utils/chatRetrieval.js` (موتور جست‌وجوی دقیق فارسی + grounding)، `utils/packWizard.js`، `services/cctvChatFlow.js` + `services/cctvAssemblyEngine.js` (مسیر قطعی بدون LLM)
- API: `/api/chat` (fallback)، `/api/chat/message` (LLM)، `/api/chat/stream` (SSE)، `/api/chat/pack/action`، `/api/chat/history`
- Routes: `/api/ai-providers/*` از `aiProviderController`

**نقاط قوت:** RAG دستی SQL خوب، جلوگیری از هالوسینیشن با grounding، مسیر قطعی پک دوربین بدون LLM، failover ارائه‌دهنده با boost max_tokens، فیلتر think در time-stream.

**ایرادات UX کشف‌شده (۱۰+ مورد):**
1. شرط `!streamActive` روی Wizard/Product cards → پنل حین تایپ مخفی می‌ماند
2. پیام "در حال آماده‌سازی" بدون فیلتر isLastAi → حالت loading تکراری
3. کارت محصول ناموجود + target="_blank" گسسته
4. `PackConfirmBar` → `/chat/pack/state` غیرواقعی (route تعریف نشده) → مسیری از صفحه محصول شکست خورده
5. `ProductHeader` product context را نمی‌دهد → بات نمی‌داند کاربر کدام محصول را می‌بیند
6. دکمه لغو (abort) وجود ندارد
7. استییت خطا در کش باطله نمایش داده نمی‌شود
8. `as unknown as` + NaN → نمایش "۰" غلط برای محاسبات
9. `ChatPackageBuilder` تکراری ChatPackageCard
10. تست‌ها `__private__.getProviderRuntimeHealth` می‌زنند که وجود ندارد

**شکاف RAG:** هیچ embedding/vector DB وجود ندارد؛ بازیابی تماماً SQL regex کلمه‌ای است. پرسش‌های معنایی/مقایسه‌ای/فیلتر-ترکیبی/سوال عمومی از صفحات سایت پوشش داده نمی‌شوند. `aiService.js` قدیمی (۳۵۶ خط) کاملاً مرده است.

**معماری پیشنهادی:** Intent Router (دeterministic > RAG > generic LLM) + Vector DB (pgvector/Atlas Vector Search) + Hybrid re-ranker (vector ۵۵٪ + keyword ۳۰٪ + category/freshness ۱۵٪) + siteContent chunks (FAQ/Shipping/Returns/Blog) + `ChatHistory.retrieval` tracing.

**فازبندی:** فاز ۰ اصلاحات فوری → فاز ۱ UX → فاز ۲ Vector infra → فاز ۳ Intent Router/RAG → فاز ۴ تمیزکاری.

مستند کامل: [docs/CHATBOT_ARCHITECTURE_ANALYSIS.md](docs/CHATBOT_ARCHITECTURE_ANALYSIS.md)
