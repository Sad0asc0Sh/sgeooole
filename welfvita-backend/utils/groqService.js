const Groq = require('groq-sdk');
const Settings = require('../models/Settings');
const dnsAgent = require('./dnsAgent');

exports.generateExpertResponse = async (userMessage, productContext, chatHistory = [], storeInfoContext = "") => {
    try {
        // 1. Load Config
        // Explicitly select apiKey because it has select: false in schema
        const settings = await Settings.findOne({ singletonKey: 'main_settings' }).select('+aiConfig.apiKey') || {};
        const config = settings.aiConfig || {};

        // Admin must provide this Key in Panel
        const apiKey = config.apiKey || process.env.GROQ_API_KEY;
        if (!apiKey) return "سیستم هوشمند فعلاً غیرفعال است (کلید تنظیم نشده).";

        const groq = new Groq({
            apiKey,
            httpAgent: dnsAgent
        });

        // 2. Load Admin-Defined Persona or use Default
        // User wants FULL control via Admin Panel, so we use customSystemPrompt if available.
        // If not, we use a default one.
        // We DO NOT append extra strict rules here, as user requested to control "Knowledge" (System Prompt) via Admin Panel.
        let systemPersona = config.customSystemPrompt || `
      نقش: شما مشاور فروش حرفه‌ای و دلسوز فروشگاه "ویلف‌ویتا" هستید.
      تخصص: دوربین مداربسته، دزدگیر و خانه هوشمند.
      زبان: فارسی سلیس و محترمانه.
      
      وظایف:
      1. نیاز مشتری را دقیق بررسی کنید.
      2. از بین "لیست محصولات موجود" (که در ادامه می‌آید) بهترین گزینه را پیشنهاد دهید.
      3. اگر محصولی موجود نیست، صادقانه بگویید.
      4. قیمت‌ها را حتماً به "تومان" بگویید.
      5. پاسخ‌هایتان کوتاه و راهگشا باشد.
      6. اگر مشتری درباره تماس، آدرس یا اطلاعات فروشگاه سوال کرد، از بخش "اطلاعات فروشگاه" استفاده کنید.
      7. خودت رو به عنوان فقط فروشنده ویلف ویتا معرفی میکنی نه متا 
    `;

        // 3. Prepare Messages - Include store info if available
        let systemContent = systemPersona;

        // Add store info context (Contact Us, About Us, etc.)
        if (storeInfoContext) {
            systemContent += `\n\n### 🏪 اطلاعات فروشگاه:\n${storeInfoContext}`;
        }

        // Add product context
        systemContent += `\n\n### 📦 لیست محصولات موجود مرتبط (فقط از این‌ها پیشنهاد دهید):\n${productContext || "هیچ محصول مرتبطی با جستجوی کاربر پیدا نشد."}`;

        const messages = [
            {
                role: "system",
                content: systemContent
            }
        ];

        // Add History (Last 6 messages to save tokens)
        if (chatHistory && Array.isArray(chatHistory)) {
            chatHistory.slice(-6).forEach(msg => {
                messages.push({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                });
            });
        }

        // Add Current Message
        messages.push({ role: "user", content: userMessage });

        // 4. Call AI
        const completion = await groq.chat.completions.create({
            messages: messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.5, // Lower temperature for more factual/strict responses
        });

        return completion.choices[0]?.message?.content || "متاسفانه پاسخی دریافت نشد.";

    } catch (error) {
        console.error("Groq API Error:", error);
        return "مشکلی در ارتباط با مشاور هوشمند پیش آمده است.";
    }
};
