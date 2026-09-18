/**
 * chatCache.ts
 * ذخیره‌سازی محلی تاریخچه چت‌بات — وقتی کاربر برای دیدن جزئیات محصول تب جدید
 * باز می‌کند و مرورگر (مخصوصاً موبایل) تب چت را از حافظه می‌اندازد، با برگشت
 * پیام‌های قبلی از همین کش بازیابی می‌شوند.
 *
 * - کلید کش به هویت وابسته است (کاربر لاگین‌کرده جدا از مهمان) تا تاریخچه‌ها قاطی نشود
 * - انقضا ۲۴ ساعته تا قیمت‌های قدیمی روی کارت‌ها نماند
 * - پیام‌های ناتمام (isLoading) ذخیره/بازیابی نمی‌شوند
 */
import type { Message } from "./AIChatSheet";

export interface ChatCacheUsage {
    current: number;
    limit: number;
    remaining: number;
}

interface CachedChat {
    messages: Message[];
    usage: ChatCacheUsage | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_MESSAGES = 40;

export function buildChatCacheKey(identitySuffix: string): string {
    const safe = String(identitySuffix || "anon").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "anon";
    return `ekgkala_ai_chat_${safe}`;
}

function isValidUsage(u: unknown): u is ChatCacheUsage {
    if (!u || typeof u !== "object") return false;
    const o = u as Record<string, unknown>;
    return (
        typeof o.current === "number" &&
        typeof o.limit === "number" &&
        typeof o.remaining === "number"
    );
}

function sanitizeMessages(input: unknown): Message[] {
    if (!Array.isArray(input)) return [];
    const out: Message[] = [];
    for (const m of input) {
        if (!m || typeof m !== "object") continue;
        const msg = m as Record<string, unknown>;
        if (msg.role !== "user" && msg.role !== "ai") continue;
        if (typeof msg.content !== "string") continue;
        const clean: Message = {
            role: msg.role,
            content: msg.content.slice(0, 4000),
            isLoading: false,
            isError: msg.isError === true,
        };
        if (msg.role === "ai") {
            if (Array.isArray(msg.products)) clean.products = msg.products as Message["products"];
            if (msg.package && typeof msg.package === "object") clean.package = msg.package as Message["package"];
            if (msg.wizard && typeof msg.wizard === "object") clean.wizard = msg.wizard as Message["wizard"];
        }
        // پیام خالیِ بدون هیچ پیوستی (مثلاً استریم ناتمام) به‌درد بازسازی نمی‌خورد
        const hasPayload =
            clean.content.trim().length > 0 ||
            (clean.products && clean.products.length > 0) ||
            Boolean(clean.package) ||
            Boolean(clean.wizard);
        if (!hasPayload) continue;
        out.push(clean);
    }
    return out.slice(-MAX_CACHED_MESSAGES);
}

function storage(): Storage | null {
    try {
        if (typeof window === "undefined" || !window.localStorage) return null;
        return window.localStorage;
    } catch {
        return null;
    }
}

export function loadChatCache(cacheKey: string): CachedChat | null {
    try {
        const store = storage();
        if (!store || !cacheKey) return null;
        const raw = store.getItem(cacheKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { messages?: unknown; usage?: unknown; savedAt?: unknown };
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > CACHE_TTL_MS) {
            store.removeItem(cacheKey);
            return null;
        }
        const messages = sanitizeMessages(parsed.messages);
        if (messages.length === 0) return null;
        return { messages, usage: isValidUsage(parsed.usage) ? parsed.usage : null };
    } catch {
        return null;
    }
}

export function saveChatCache(cacheKey: string, messages: Message[], usage: ChatCacheUsage | null): void {
    try {
        const store = storage();
        if (!store || !cacheKey) return;
        const clean = sanitizeMessages(messages);
        store.setItem(
            cacheKey,
            JSON.stringify({ messages: clean, usage: isValidUsage(usage) ? usage : null, savedAt: Date.now() }),
        );
    } catch {
        // پر بودن حافظه یا حالت خصوصی مرورگر نباید چت را خراب کند
    }
}

export function clearChatCache(cacheKey: string): void {
    try {
        const store = storage();
        if (!store || !cacheKey) return;
        store.removeItem(cacheKey);
    } catch {
        // ignore
    }
}
