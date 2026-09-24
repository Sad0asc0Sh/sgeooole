"use client";

import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Camera, Send, X, RefreshCw, Sparkles, Box, Wrench, ShoppingBag, Phone, User, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from "react";
import { authService } from "@/services/authService";
import ChatPackageBuilder from "./ChatPackageBuilder";
import ChatWizardStep, { type ChatWizard } from "./ChatWizardStep";
import { buildChatCacheKey, loadChatCache, saveChatCache, clearChatCache } from "./chatCache";

interface AIChatSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export interface ChatProductSpec {
    label: string;
    value: string;
}

export interface ChatProduct {
    id: string;
    name: string;
    slug?: string;
    productCode?: string;
    price: number;
    oldPrice?: number;
    discount?: number;
    image: string;
    category?: string;
    brand?: string;
    rating?: number;
    reviewCount?: number;
    countInStock: number;
    inStock: boolean;
    url: string;
    specs?: ChatProductSpec[];
    guarantee?: string;
    productType?: string;
    defaultVariantOptions?: Array<{ name: string; value: string }>;
    priceUpdatedAt?: string | null;
    priceUpdateCount?: number;
}

export interface ChatPackageSection {
    key: string;
    title: string;
    hint?: string;
    optional?: boolean;
    options: ChatProduct[];
    defaultId: string;
}

export interface ChatPackage {
    domainId: string;
    title: string;
    sections: ChatPackageSection[];
    missing?: string[];
}

export interface Message {
    role: 'user' | 'ai';
    content: string;
    isLoading?: boolean;
    isError?: boolean;
    products?: ChatProduct[];
    package?: ChatPackage | null;
    wizard?: ChatWizard | null;
}

interface SuggestionItem {
    icon: typeof Sparkles;
    label: string;
    prompt: string;
}

export function stripThinkingTags(text: string): string {
    if (!text) return "";
    return text
        .replace(/<\s*(think|thought|reasoning)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*(think|thought|reasoning)\b[^>]*>[\s\S]*$/gi, '')
        .replace(/<\s*\/\s*(think|thought|reasoning)\s*>/gi, '')
        .trim();
}

/** استخراج دکمه‌های دوگزینه‌ای [[CHOICE:الف|ب]] از متن هوش مصنوعی */
export function parseChoices(text: string): { clean: string; groups: string[][] } {
    if (!text) return { clean: "", groups: [] };
    const groups: string[][] = [];
    const clean = text.replace(/\[\[CHOICE:([^\]]+)\]\]/g, (_m, inner: string) => {
        const opts = String(inner).split("|").map((s) => s.trim()).filter(Boolean).slice(0, 2);
        if (opts.length === 2) groups.push(opts);
        return "";
    }).replace(/\n{3,}/g, "\n\n").trim();
    return { clean, groups };
}

export function resolveChatImage(src: string | undefined): string {
    if (!src || !src.trim()) return "/placeholder.svg";
    const s = src.trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/")) {
        try {
            const base = (typeof process !== "undefined" && (process as unknown as { env?: Record<string, string> })?.env?.NEXT_PUBLIC_API_URL) || "https://www.ekgkala.ir/api";
            return `${String(base).replace(/\/api\/?$/, "")}${s}`;
        } catch {
            return s;
        }
    }
    return s;
}

export function formatFaPrice(n: number | undefined): string {
    return Number(n || 0).toLocaleString("fa-IR");
}

/** کلید کش به هویت وابسته است تا تاریخچه کاربر لاگین‌کرده با مهمان قاطی نشود */
function resolveChatCacheKey(): string {
    try {
        const uid = authService.getUser()?.id;
        if (uid) return buildChatCacheKey(`u_${uid}`);
    } catch {
        // ignore
    }
    try {
        return buildChatCacheKey(`g_${getSessionId()}`);
    } catch {
        return buildChatCacheKey("anon");
    }
}

export default function AIChatSheet({ open, onOpenChange }: AIChatSheetProps) {
    const [input, setInput] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [actionLoading, setActionLoading] = useState<boolean>(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // --- Sticky-bottom scroll: فقط وقتی کاربر نزدیک انتهاست دنبالش می‌کنیم،
    // تا حین تایپ زنده بتواند آزادانه بالا برود و کارت‌ها را ببیند ---
    const [isSticky, setIsSticky] = useState<boolean>(true);
    const isStickyRef = useRef<boolean>(true);
    const prevTypingRef = useRef<boolean>(false);

    const setSticky = (value: boolean) => {
        isStickyRef.current = value;
        setIsSticky(value);
    };

    const scrollToBottom = (smooth: boolean = true) => {
        const el = scrollRef.current;
        if (!el) return;
        setSticky(true);
        if (smooth) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        } else {
            el.scrollTop = el.scrollHeight;
        }
    };

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
        setSticky(distance < 120);
    };

    const [usage, setUsage] = useState<{ current: number; limit: number; remaining: number } | null>(null);
    const [cacheReady, setCacheReady] = useState<boolean>(false);

    // --- بازیابی تاریخچه از کش محلی (فقط سمت کلاینت، بعد از hydration) ---
    // وقتی کاربر جزئیات محصول را در تب جدید می‌بیند و مرورگر تب چت را از حافظه
    // می‌اندازد، با برگشت پیام‌های قبلی از همین‌جا برمی‌گردند.
    useEffect(() => {
        try {
            const cached = loadChatCache(resolveChatCacheKey());
            if (cached) {
                if (cached.messages.length > 0) setMessages(cached.messages);
                if (cached.usage) setUsage(cached.usage);
            }
        } finally {
            setCacheReady(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- ذخیره debounced تاریخچه در کش محلی ---
    useEffect(() => {
        if (!cacheReady || typeof window === "undefined") return;
        const id = window.setTimeout(() => {
            saveChatCache(resolveChatCacheKey(), messages, usage);
        }, 400);
        return () => window.clearTimeout(id);
    }, [messages, usage, cacheReady]);

    // --- Body Scroll Lock ---
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            setSticky(true);
            requestAnimationFrame(() => {
                const el = scrollRef.current;
                if (el) el.scrollTop = el.scrollHeight;
            });
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    const suggestions: SuggestionItem[] = [
        { icon: Box, label: "پیگیری سفارش", prompt: "سفارش من کجاست؟" },
        { icon: Wrench, label: "خدمات نصب", prompt: "شرایط نصب در محل چیست؟" },
        { icon: ShoppingBag, label: "راهنمای خرید", prompt: "بهترین دوربین مداربسته برای منزل کدام است؟" },
        { icon: Phone, label: "پشتیبانی", prompt: "شماره تماس پشتیبانی چند است؟" },
    ];

    // --- Sticky Auto-Scroll: حین استریم فقط اگر کاربر ته است دنبال می‌کنیم (بدون قفل) ---
    useEffect(() => {
        if (!open) return;
        const el = scrollRef.current;
        if (!el) return;
        if (isStickyRef.current) {
            // حین تایپ زنده: پرش آنی تا انیمیشن ۶۰فریمی لگ نزند و قفل حس نشود
            el.scrollTop = el.scrollHeight;
        }
    }, [messages, open]);

    // --- پایان استریم: اگر کاربر ته است، نرم به انتها (نمایش دکمه‌ها و کارت‌ها) ---
    useEffect(() => {
        if (prevTypingRef.current && !isTyping && isStickyRef.current) {
            const el = scrollRef.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
        prevTypingRef.current = isTyping;
    }, [isTyping]);

    const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Prevent duplicate requests (React StrictMode / double-fire protection)
    const pendingRequestRef = useRef<boolean>(false);

    // Ref for accumulated reply to avoid stale closure issues
    const fullReplyRef = useRef<string>('');

    const handleSend = async (overrideText?: string) => {
        const rawText = typeof overrideText === "string" ? overrideText : input;
        if (!rawText.trim() || isTyping || actionLoading) return;
        // Guard against duplicate requests
        if (pendingRequestRef.current) {
            console.warn('[AI Chat] Duplicate request blocked');
            return;
        }
        pendingRequestRef.current = true;
        // با ارسال پیام، دنبال‌کردن پاسخ زنده را از سر می‌گیریم
        setSticky(true);

        const currentInput = rawText.trim();
        const userMsg: Message = { role: 'user', content: currentInput };
        setMessages((prev: Message[]) => [...prev, userMsg]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "40px";

        setMessages((prev: Message[]) => [...prev, { role: 'ai', content: '', isLoading: true }]);
        setIsTyping(true);

        const currentUser = authService.getUser();
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        headers['x-session-id'] = getSessionId();

        const abortController = new AbortController();
        abortRef.current = abortController;
        const requestId = createRequestId();

        let fullReply = '';
        fullReplyRef.current = '';
        let lastError: string | null = null;

        try {
            const baseUrl = getBaseUrl();
            const apiUrl = `${baseUrl}/api/chat/stream`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: currentInput,
                    userId: currentUser?.id || undefined,
                    requestId,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errorPayload = await response.json().catch(() => null);
                throw new Error(errorPayload?.message || `خطا در ارسال پیام (${response.status})`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('پاسخ قابل‌خواندن از دستیار دریافت نشد.');
            }

            // Buffer tokens and flush at ~60fps for smooth typing animation
            let tokenBuffer = '';
            let rafId: number | null = null;

            const flushBuffer = () => {
                rafId = null;
                if (tokenBuffer) {
                    fullReply += tokenBuffer;
                    fullReplyRef.current = fullReply;
                    tokenBuffer = '';
                    const cleanReply = stripThinkingTags(fullReply);
                    setMessages((prev: Message[]) => {
                        const last = prev[prev.length - 1];
                        if (last?.role === 'ai') {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...last,
                                content: cleanReply,
                                isLoading: !cleanReply,
                            };
                            return updated;
                        }
                        return prev;
                    });
                }
            };

            let sseBuffer = '';
            const consumeSseLine = (line: string) => {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) return;

                const jsonStr = trimmed.substring(6);
                if (jsonStr === '[DONE]') return;

                let payload: {
                    token?: string;
                    done?: boolean;
                    error?: string;
                    usage?: { current: number; limit: number; remaining: number };
                    partial?: boolean;
                    products?: ChatProduct[];
                    package?: ChatPackage | null;
                    wizard?: ChatWizard | null;
                    meta?: { requestId?: string };
                };
                try {
                    payload = JSON.parse(jsonStr);
                } catch {
                    return;
                }

                if (payload.usage) setUsage(payload.usage);
                if (Array.isArray(payload.products) && payload.products.length > 0) {
                    const incoming = payload.products;
                    setMessages((prev: Message[]) => {
                        const last = prev[prev.length - 1];
                        if (last?.role !== 'ai') return prev;
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            ...last,
                            products: [...(last.products || []), ...incoming].slice(0, 6),
                        };
                        return updated;
                    });
                }
                if (payload.package && Array.isArray(payload.package.sections) && payload.package.sections.length > 0) {
                    const incomingPkg = payload.package;
                    setMessages((prev: Message[]) => {
                        const last = prev[prev.length - 1];
                        if (last?.role !== 'ai') return prev;
                        const updated = [...prev];
                        // هر پیام فقط یک بسته دارد — جایگزین می‌شود نه الحاق (جلوگیری از قاطی‌شدن)
                        updated[updated.length - 1] = { ...last, package: incomingPkg };
                        return updated;
                    });
                }
                if (payload.wizard && payload.wizard.active) {
                    const incomingWiz = payload.wizard;
                    setMessages((prev: Message[]) => {
                        const last = prev[prev.length - 1];
                        if (last?.role !== 'ai') return prev;
                        const updated = [...prev];
                        // نمای ویزارد همیشه تازه‌ترین وضعیت است — جایگزین می‌شود
                        updated[updated.length - 1] = { ...last, wizard: incomingWiz };
                        return updated;
                    });
                }
                if (payload.error) {
                    lastError = payload.error;
                    if (payload.partial) {
                        if (rafId !== null) {
                            cancelAnimationFrame(rafId);
                            rafId = null;
                        }
                        flushBuffer();
                        const cleanReply = stripThinkingTags(fullReply);
                        setMessages((prev: Message[]) => {
                            const last = prev[prev.length - 1];
                            if (last?.role !== 'ai') return prev;
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...last,
                                content: cleanReply ? `${cleanReply}\n\n${payload.error || ''}` : (payload.error || 'خطایی رخ داد.'),
                                isLoading: false,
                                isError: true,
                            };
                            return updated;
                        });
                    }
                    return;
                }

                if (payload.token) {
                    tokenBuffer += payload.token;
                    if (rafId === null) rafId = requestAnimationFrame(flushBuffer);
                }

                if (payload.done) {
                    if (rafId !== null) {
                        cancelAnimationFrame(rafId);
                        rafId = null;
                    }
                    flushBuffer();
                    const cleanReply = stripThinkingTags(fullReply);
                    if (!cleanReply && !lastError) {
                        setMessages((prev: Message[]) => {
                            const last = prev[prev.length - 1];
                            if (last?.role === 'ai') {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    role: 'ai',
                                    content: 'پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.',
                                    isError: true,
                                    isLoading: false,
                                };
                                return updated;
                            }
                            return prev;
                        });
                    } else if (cleanReply) {
                        setMessages((prev: Message[]) => {
                            const last = prev[prev.length - 1];
                            if (last?.role === 'ai') {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    ...last,
                                    content: cleanReply,
                                    isLoading: false,
                                };
                                return updated;
                            }
                            return prev;
                        });
                    }
                }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split(/\r?\n/);
                sseBuffer = lines.pop() || '';
                lines.forEach(consumeSseLine);
            }
            sseBuffer += decoder.decode();
            if (sseBuffer.trim()) consumeSseLine(sseBuffer);

            // Final flush — ensures no tokens are lost
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            flushBuffer();

            const finalClean = stripThinkingTags(fullReply);
            // Stream ended normally — show error if no tokens were received
            if (!finalClean && lastError) {
                setMessages((prev: Message[]) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'ai' && last.isLoading) {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'ai',
                            content: lastError || 'پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.',
                            isError: true,
                            isLoading: false,
                        };
                        return updated;
                    }
                    return prev;
                });
            } else if (finalClean) {
                setMessages((prev: Message[]) => {
                    const last = prev[prev.length - 1];
                    if (last?.role === 'ai') {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            ...last,
                            content: finalClean,
                            isLoading: false,
                        };
                        return updated;
                    }
                    return prev;
                });
            }

        } catch (error: unknown) {
            if ((error as Error)?.name === 'AbortError') {
                // Flush any buffered tokens on abort
                if (fullReplyRef.current) {
                    const savedReply = fullReplyRef.current;
                    setMessages((prev: Message[]) => {
                        const last = prev[prev.length - 1];
                        if (last?.role === 'ai') {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...last,
                                content: savedReply + '\n\n(لغو شد)',
                                isLoading: false,
                            };
                            return updated;
                        }
                        return prev;
                    });
                } else {
                    setMessages((prev: Message[]) => prev.slice(0, prev.length - 2));
                }
                return;
            }

            console.error('[AI Chat] Error:', error);
            const errorMessage = (error instanceof Error ? error.message : null) || 'خطای ناشناخته. لطفاً دوباره تلاش کنید.';

            setMessages((prev: Message[]) => {
                const last = prev[prev.length - 1];
                if (last?.role === 'ai') {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: 'ai',
                        content: errorMessage,
                        isError: true,
                    };
                    return updated;
                }
                return [...prev, { role: 'ai', content: errorMessage, isError: true }];
            });
        } finally {
            setIsTyping(false);
            abortRef.current = null;
            pendingRequestRef.current = false;
        }
    };

    // --- اکشن‌های ویزارد پک (انتخاب/رد/برگشت/شروع‌دوباره/رد سوالات) — بدون استریم، کوتاه و قطعی ---
    // تمام عملیات داخل همین چت انجام می‌شود؛ صفحه محصول فقط برای دیدن جزئیات است.
    const handlePackAction = async (action: "select" | "skip-needs" | "skip" | "back" | "restart", productId?: string, qty?: number) => {
        if (actionLoading || isTyping) return;
        setActionLoading(true);
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            headers['x-session-id'] = getSessionId();

            const baseUrl = getBaseUrl();
            const response = await fetch(`${baseUrl}/api/chat/pack/action`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ action, productId, qty, requestId: createRequestId() }),
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.message || `خطا در ثبت انتخاب (${response.status})`);
            }
            const d = payload.data;
            if (d.userMessage) {
                setMessages((prev: Message[]) => [...prev, { role: 'user', content: d.userMessage }]);
            }
            setMessages((prev: Message[]) => [...prev, {
                role: 'ai',
                content: d.message || '',
                products: [],
                package: d.package || null,
                wizard: d.wizard || null,
            }]);
            if (d.usage) setUsage(d.usage);
            setSticky(true);
        } catch (error: unknown) {
            console.error('[AI Chat] Pack action error:', error);
            const errorMessage = (error instanceof Error ? error.message : null) || 'خطا در ثبت انتخاب. لطفاً دوباره تلاش کنید.';
            setMessages((prev: Message[]) => [...prev, { role: 'ai', content: errorMessage, isError: true }]);
        } finally {
            setActionLoading(false);
        }
    };

    const handleClearChat = async () => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        // ریست کامل حالت محلی: پیام‌ها، ورودی، سهمیه نمایشی، بافر پاسخ و موقعیت اسکرول
        setMessages([]);
        setInput("");
        setUsage(null);
        setIsTyping(false);
        fullReplyRef.current = '';
        setSticky(true);
        clearChatCache(resolveChatCacheKey());
        if (textareaRef.current) textareaRef.current.style.height = "40px";
        requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = 0;
        });

        // پاک‌سازی واقعی تاریخچه در سرور — برای مهمان (x-session-id) و کاربر لاگین‌کرده (توکن)
        try {
            const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            headers['x-session-id'] = getSessionId();

            const baseUrl = getBaseUrl();

            await fetch(`${baseUrl}/api/chat/history`, {
                method: 'DELETE',
                headers,
            });
        } catch (error) {
            console.error('[AI Chat] Error clearing history:', error);
        }
    };

    // Remove dead store warning: `aiTempIndex` was used conditionally

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="fixed inset-0 z-[9999] !h-screen supports-[height:100dvh]:!h-[100dvh] !w-full !p-0 bg-white border-none focus-visible:outline-none [&>div>button]:hidden"
            >
                <div className="flex flex-col h-full w-full relative">

                    {/* 1. Header */}
                    <div className="shrink-0 flex justify-between items-center p-4 pt-safe-top bg-white/95 backdrop-blur-md border-b border-gray-100 z-30">
                        <SheetClose className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                            <X className="text-gray-600" size={24} />
                        </SheetClose>
                        <div className="flex flex-col items-center">
                            <span className="font-bold text-ekg-800 text-sm">هوش مصنوعی ای‌کا‌جی کالا</span>
                            {usage && (
                                <span className={`text-[10px] ${usage.remaining === 0 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                    {usage.remaining} پیام باقی‌مانده
                                </span>
                            )}
                        </div>
                        <button onClick={handleClearChat} className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors" title="شروع گفتگوی جدید">
                            <RefreshCw className="text-gray-600" size={20} />
                        </button>
                    </div>

                    {/* 2. Main Content (Scrollable) */}
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="relative flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden p-4 pt-4 touch-pan-y overscroll-contain"
                        style={{ WebkitOverflowScrolling: "touch" }}
                    >
                        {/* Welcome Block */}
                        <div className="flex flex-col items-center w-full transition-all duration-500">
                            <div className={`transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${messages.length > 0 ? "opacity-0 max-h-0 scale-50 overflow-hidden margin-0" : "opacity-100 max-h-[200px] scale-100 mt-10 mb-6"}`}>
                                <div className="w-20 h-20 bg-gradient-to-tr from-gray-100 to-white border border-gray-100 rounded-full flex items-center justify-center shadow-xl shadow-kala-200/40 relative">
                                    <div className="absolute inset-0 bg-kala-400 rounded-full blur-xl opacity-20"></div>
                                    <Sparkles className="text-kala-500 relative z-10" size={40} />
                                </div>
                            </div>
                            <div className={`flex flex-col items-center w-full transition-all duration-500 ease-in-out origin-top ${(input.trim().length > 0 || messages.length > 0) ? "opacity-0 max-h-0 scale-95 -translate-y-4 overflow-hidden" : "opacity-100 max-h-[500px] scale-100 translate-y-0"}`}>
                                <h2 className="text-xl font-bold text-gray-800 mb-8">چطور می‌توانم کمکتان کنم؟</h2>
                                <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-4">
                                    {suggestions.map((item: SuggestionItem, idx: number) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setInput(item.prompt);
                                                if (textareaRef.current) {
                                                    textareaRef.current.focus();
                                                    textareaRef.current.style.height = "auto";
                                                    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
                                                }
                                            }}
                                            className="flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-kala-300 hover:shadow-md transition-all active:scale-95 cursor-pointer"
                                        >
                                            <item.icon className="text-kala-500" size={24} />
                                            <span className="text-xs font-medium text-gray-600">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Messages List */}
                        {messages.length > 0 && (
                            <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 mt-4 px-1">
                                {messages.map((msg: Message, index: number) => {
                                    const rawDisplay = msg.role === 'ai' ? stripThinkingTags(msg.content) : msg.content;
                                    const { clean: displayContent, groups: choiceGroups } = msg.role === 'ai'
                                        ? parseChoices(rawDisplay)
                                        : { clean: rawDisplay, groups: [] as string[][] };
                                    const isLastAi = msg.role === 'ai' && index === messages.length - 1;
                                    // حین استریم پیام آخر: فقط متن زنده دیده می‌شود تا توضیحات از دید خارج نشود؛
                                    // دکمه‌ها و کارت‌ها بعد از اتمام پاسخ ظاهر می‌شوند.
                                    const streamActive = isTyping && isLastAi;
                                    return (
                                    <div key={index} className={`flex gap-2 items-end ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-1 ${msg.role === 'user' ? 'bg-gray-200' : msg.isError ? 'bg-red-100' : 'bg-kala-100'}`}>
                                            {msg.role === 'user' ? (
                                                <User size={14} className="text-gray-600" />
                                            ) : msg.isError ? (
                                                <AlertCircle size={14} className="text-red-600" />
                                            ) : (
                                                <Sparkles size={14} className="text-kala-600" />
                                            )}
                                        </div>
                                        <div className={`flex flex-col gap-2 min-w-0 ${msg.role === 'user' ? 'items-end max-w-[85%]' : 'items-start max-w-[92%] flex-1'}`}>
                                            <div className={`px-3.5 py-2 rounded-2xl text-[13px] leading-6 shadow-sm break-words whitespace-pre-wrap ${msg.role === 'user' ? 'bg-gray-800 text-white rounded-br-sm max-w-full' : msg.isError ? 'bg-red-50 border border-red-200 text-red-800 rounded-bl-sm max-w-full' : 'bg-kala-50/80 border border-kala-200/80 text-gray-800 rounded-bl-sm max-w-full'}`}>
                                                {displayContent ? (
                                                    displayContent
                                                ) : msg.isLoading ? (
                                                    <div className="flex items-center gap-1.5 py-1 px-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-kala-500 animate-bounce [animation-delay:-0.3s]"></span>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-kala-500 animate-bounce [animation-delay:-0.15s]"></span>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-kala-500 animate-bounce"></span>
                                                    </div>
                                                ) : (
                                                    '\u00A0'
                                                )}
                                            </div>
                                            {/* دکمه‌های دوگزینه‌ای مشاور (بعد از اتمام استریم) */}
                                            {msg.role === 'ai' && !streamActive && choiceGroups.length > 0 && (
                                                <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                    {choiceGroups.map((opts, gi) => (
                                                        <div key={gi} className="grid grid-cols-2 gap-2 w-full">
                                                            {opts.map((opt, oi) => (
                                                                <button
                                                                    key={oi}
                                                                    disabled={isTyping || actionLoading || !isLastAi}
                                                                    onClick={() => handleSend(opt)}
                                                                    className="px-3 py-2.5 rounded-xl border border-kala-300 bg-white text-kala-700 text-xs font-bold shadow-sm hover:bg-kala-500 hover:text-white hover:border-kala-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                                                >
                                                                    {opt}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {/* پنل ویزارد پک — فقط روی تازه‌ترین پیام (وضعیت زنده)، بعد از اتمام استریم */}
                                            {msg.role === 'ai' && !streamActive && isLastAi && msg.wizard?.active && !msg.wizard.complete && (msg.wizard.current || msg.wizard.phase === 'needs') ? (
                                                <ChatWizardStep
                                                    wizard={msg.wizard}
                                                    disabled={isTyping}
                                                    loading={actionLoading}
                                                    onAction={handlePackAction}
                                                />
                                            ) : null}
                                            {/* بسته پیشنهادی (پک) جایگزین کارت‌های تکی می‌شود تا قاطی نشود */}
                                            {msg.role === 'ai' && !streamActive && msg.package && Array.isArray(msg.package.sections) && msg.package.sections.length > 0 ? (
                                                <ChatPackageBuilder pkg={msg.package} />
                                            ) : null}
                                            {/* کارت محصولات مرتبط از دیتابیس (بعد از اتمام استریم + انیمیشن ورود) */}
                                            {msg.role === 'ai' && !streamActive && !msg.package && msg.products && msg.products.length > 0 && (
                                                <div className="grid grid-cols-1 gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                    {msg.products.map((p) => (
                                                        <a
                                                            key={p.id}
                                                            href={p.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex gap-3 p-2.5 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:border-kala-300 hover:shadow-md transition-all cursor-pointer"
                                                        >
                                                            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={resolveChatImage(p.image)}
                                                                    alt={p.name}
                                                                    className="w-full h-full object-cover"
                                                                    loading="lazy"
                                                                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                                                                />
                                                                {!p.inStock && (
                                                                    <span className="absolute inset-x-0 bottom-0 bg-gray-900/70 text-white text-[10px] font-bold text-center py-0.5">ناموجود</span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col flex-1 min-w-0 gap-1">
                                                                <span className="text-[12px] font-bold text-gray-800 leading-5 line-clamp-2">{p.name}</span>
                                                                {(p.brand || p.category) && (
                                                                    <span className="text-[10px] text-gray-400 truncate">{[p.brand, p.category].filter(Boolean).join(" • ")}</span>
                                                                )}
                                                                {p.specs && p.specs.length > 0 && (
                                                                    <span className="text-[10px] text-gray-500 truncate">
                                                                        {p.specs.slice(0, 2).map((s) => `${s.label}: ${s.value}`).join(" | ")}
                                                                    </span>
                                                                )}
                                                                <div className="flex items-center justify-between mt-auto">
                                                                    <span className={`text-[12px] font-black ${p.inStock ? "text-gray-900" : "text-gray-400"}`}>
                                                                        {formatFaPrice(p.price)} <span className="text-[10px] font-medium text-gray-500">تومان</span>
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.inStock ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                                                                        {p.inStock ? `موجود (${Number(p.countInStock).toLocaleString("fa-IR")})` : "ناموجود"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    );
                                })}
                                {isTyping && (
                                    <div className="flex gap-2 animate-pulse mt-1">
                                        <div className="w-6 h-6 rounded-full bg-kala-50 flex items-center justify-center">
                                            <Sparkles size={12} className="text-kala-400" />
                                        </div>
                                        <span className="text-[10px] text-gray-400 pt-1">در حال آماده‌سازی پاسخ...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Anchor for Auto-Scroll */}
                        <div ref={bottomRef} className="h-4 w-full shrink-0" />
                    </div>

                    {/* دکمه شناور بازگشت به پاسخ زنده — وقتی کاربر بالا رفته است */}
                    {!isSticky && messages.length > 0 && (
                        <button
                            onClick={() => scrollToBottom(true)}
                            className="absolute bottom-[calc(var(--bottom-nav-total-height)_+_6.5rem)] left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900/90 backdrop-blur text-white text-xs font-bold shadow-lg hover:bg-gray-900 transition-all active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300"
                        >
                            <span>{isTyping ? "مشاهده پاسخ زنده" : "برو به آخر"}</span>
                            <span className="text-sm leading-none">↓</span>
                            {isTyping && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            )}
                        </button>
                    )}

                    {/* 3. Footer Input (Static Flex Item) */}
                    <div className="shrink-0 w-full p-4 pb-[calc(var(--bottom-nav-total-height)_+_0.75rem)] bg-white border-t border-gray-100 z-40">
                        <div className="flex items-end gap-2 bg-white p-2 pr-4 rounded-[1.5rem] border border-gray-200 shadow-sm focus-within:border-kala-400 focus-within:ring-1 focus-within:ring-kala-200 transition-all">
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                value={input}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="از من بپرسید..."
                                className="flex-1 bg-transparent border-none outline-none text-sm text-right min-h-[40px] max-h-[150px] py-2.5 resize-none overflow-y-auto placeholder:text-gray-400"
                                style={{ height: '40px' }}
                                disabled={isTyping}
                            />
                            <div className="flex items-center gap-1 border-r border-gray-200 pr-2 mr-1 mb-1.5 h-8">
                                <button className="p-2 text-gray-400 hover:text-kala-600 transition"><Camera size={20} /></button>
                            </div>
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isTyping}
                                className={`mb-1 p-3 rounded-full transition-all duration-300 ${input.trim() && !isTyping ? 'bg-kala-500 text-white shadow-lg shadow-kala-500/30 rotate-0 scale-100 hover:bg-kala-600' : 'bg-gray-100 text-gray-300 rotate-90 scale-90 cursor-not-allowed'}`}
                            >
                                <Send size={18} className="rtl:-scale-x-100" />
                            </button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// --- helpers ---

function createRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

function getSessionId(): string {
    try {
        const key = 'ekgkala_session_id';
        let id = localStorage.getItem(key);
        if (!id) {
            id = `sess_${createRequestId()}`;
            localStorage.setItem(key, id);
        }
        return id;
    } catch {
        return 'sess_fallback_' + Date.now();
    }
}

function getBaseUrl(): string {
    try {
        if (typeof process !== 'undefined' && process?.env?.NEXT_PUBLIC_API_URL) {
            return process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '');
        }
    } catch {
        // ignore
    }
    return 'https://www.ekgkala.ir';
}
