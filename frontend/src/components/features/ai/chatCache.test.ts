import {
    buildChatCacheKey,
    loadChatCache,
    saveChatCache,
    clearChatCache,
} from "./chatCache";
import type { Message } from "./AIChatSheet";

const KEY = buildChatCacheKey("test-user");

const sampleMessages = (): Message[] => [
    { role: "user", content: "سلام" },
    {
        role: "ai",
        content: "سلام! چطور کمکتان کنم؟",
        products: [
            {
                id: "p1",
                name: "دوربین تست",
                price: 1000000,
                image: "/x.jpg",
                countInStock: 3,
                inStock: true,
                url: "/product/ky-1/x",
            },
        ],
    },
];

beforeEach(() => {
    window.localStorage.clear();
});

test("کلید کش به هویت وابسته است و یکتا می‌ماند", () => {
    expect(buildChatCacheKey("u_123")).not.toBe(buildChatCacheKey("g_abc"));
    expect(buildChatCacheKey("u_123")).toBe(buildChatCacheKey("u_123"));
    expect(buildChatCacheKey("a/b?c")).toBe("ekgkala_ai_chat_abc");
});

test("ذخیره و بازیابی تاریخچه با محصولات", () => {
    saveChatCache(KEY, sampleMessages(), { current: 3, limit: 20, remaining: 17 });
    const loaded = loadChatCache(KEY);
    expect(loaded).not.toBeNull();
    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages[1].products).toHaveLength(1);
    expect(loaded?.usage).toEqual({ current: 3, limit: 20, remaining: 17 });
});

test("کش منقضی‌شده برمی‌گردد null و پاک می‌شود", () => {
    saveChatCache(KEY, sampleMessages(), null);
    // دست‌کاری زمان ذخیره به ۲۵ ساعت قبل
    const raw = window.localStorage.getItem(KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    parsed.savedAt = Date.now() - 25 * 60 * 60 * 1000;
    window.localStorage.setItem(KEY, JSON.stringify(parsed));

    expect(loadChatCache(KEY)).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
});

test("پیام‌های ناتمام و نامعتبر حذف می‌شوند", () => {
    const dirty = [
        { role: "user", content: "سلام" },
        { role: "ai", content: "", isLoading: true }, // استریم ناتمام
        { role: "bot", content: "نقش نامعتبر" },
        { role: "ai", content: 123 },
        { role: "ai", content: "   " }, // خالی بدون پیوست
    ] as unknown as Message[];
    saveChatCache(KEY, dirty, null);
    const loaded = loadChatCache(KEY);
    expect(loaded?.messages).toHaveLength(1);
    expect(loaded?.messages[0]).toEqual({ role: "user", content: "سلام", isLoading: false, isError: false });
});

test("بیش از سقف پیام نگه داشته نمی‌شود", () => {
    const many: Message[] = Array.from({ length: 60 }, (_, i) => ({ role: "user", content: `پیام ${i}` }));
    saveChatCache(KEY, many, null);
    const loaded = loadChatCache(KEY);
    expect(loaded?.messages).toHaveLength(40);
    expect(loaded?.messages[0].content).toBe("پیام 20");
});

test("JSON خراب و کلید خالی امن هستند", () => {
    window.localStorage.setItem(KEY, "not-json{{{");
    expect(loadChatCache(KEY)).toBeNull();
    expect(loadChatCache("")).toBeNull();
    expect(() => saveChatCache("", [], null)).not.toThrow();
    expect(() => clearChatCache("")).not.toThrow();
});

test("پاک‌سازی کش", () => {
    saveChatCache(KEY, sampleMessages(), null);
    expect(loadChatCache(KEY)).not.toBeNull();
    clearChatCache(KEY);
    expect(loadChatCache(KEY)).toBeNull();
});
