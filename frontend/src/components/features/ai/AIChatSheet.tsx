"use client";

import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Camera, Send, X, RefreshCw, Sparkles, Box, Wrench, ShoppingBag, Phone, User, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { authService } from "@/services/authService";

interface AIChatSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
    isLoading?: boolean;
    isError?: boolean;
}

interface SuggestionItem {
    icon: typeof Sparkles;
    label: string;
    prompt: string;
}

export default function AIChatSheet({ open, onOpenChange }: AIChatSheetProps) {
    const [input, setInput] = useState<string>("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const [usage, setUsage] = useState<{ current: number; limit: number; remaining: number } | null>(null);

    // --- Body Scroll Lock ---
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
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

    // --- Smart Auto-Scroll ---
    useEffect(() => {
        if (open) {
            const timeoutId = setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [messages.length, open]);

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

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages((prev: Message[]) => [...prev, userMsg]);
        const currentInput = input;
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = "40px";

        const aiTempIndex = messages.length + 1;
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

        let fullReply = '';

        try {
            // Use global window object for base URL to avoid process.env issues
            const baseUrl = getBaseUrl();
            const apiUrl = `${baseUrl}/api/chat/stream`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: currentInput,
                    userId: currentUser?.id || undefined
                }),
                signal: abortController.signal,
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const jsonStr = trimmed.substring(6);
                    if (jsonStr === '[DONE]') continue;

                    let payload: { token?: string; done?: boolean; error?: string };
                    try {
                        payload = JSON.parse(jsonStr);
                    } catch {
                        continue;
                    }

                    if (payload.error) {
                        throw new Error(payload.error);
                    }

                    if (payload.token) {
                        fullReply += payload.token;
                        setMessages((prev: Message[]) => {
                            const last = prev[prev.length - 1];
                            if (last?.role === 'ai') {
                                const updated = [...prev];
                                updated[updated.length - 1] = {
                                    ...last,
                                    content: fullReply,
                                    isLoading: false,
                                };
                                return updated;
                            }
                            return prev;
                        });
                    }

                    if (payload.done) {
                        // Stream complete — nothing to do, reader will close
                    }
                }
            }

        } catch (error: unknown) {
            if ((error as Error)?.name === 'AbortError') {
                if (fullReply) {
                    setMessages((prev: Message[]) => {
                        const last = prev[prev.length - 1];
                        if (last?.role === 'ai') {
                            const updated = [...prev];
                            updated[updated.length - 1] = {
                                ...last,
                                content: fullReply + '\n\n(لغو شد)',
                                isLoading: false,
                            };
                            return updated;
                        }
                        return prev;
                    });
                } else {
                    setMessages((prev: Message[]) => prev.filter((_: Message, i: number) => i !== aiTempIndex));
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
        }
    };

    const handleClearChat = async () => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setMessages([]);
        setIsTyping(false);

        const currentUser = authService.getUser();
        if (currentUser?.id) {
            try {
                const token = localStorage.getItem("token");
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                headers['x-session-id'] = getSessionId();

                const baseUrl = getBaseUrl();

                await fetch(`${baseUrl}/api/chat/history/${currentUser.id}`, {
                    method: 'DELETE',
                    headers,
                });
            } catch (error) {
                console.error('[AI Chat] Error clearing history:', error);
            }
        }
    };

    // Remove dead store warning: `aiTempIndex` was used conditionally

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="fixed inset-0 z-[9999] !h-[100dvh] !w-full !p-0 bg-white border-none focus-visible:outline-none [&>div>button]:hidden"
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
                        className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden p-4 pt-4 scroll-smooth touch-pan-y overscroll-contain"
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
                                        <button key={idx} onClick={() => setInput(item.prompt)} className="flex flex-col items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-kala-300 hover:shadow-md transition-all active:scale-95 cursor-pointer">
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
                                {messages.map((msg: Message, index: number) => (
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
                                        <div className={`px-3.5 py-2 rounded-2xl text-[13px] leading-6 shadow-sm max-w-[85%] break-words whitespace-pre-wrap ${msg.role === 'user' ? 'bg-gray-800 text-white rounded-br-sm' : msg.isError ? 'bg-red-50 border border-red-200 text-red-800 rounded-bl-sm' : 'bg-orange-100 border border-orange-200 text-orange-900 rounded-bl-sm'}`}>
                                            {msg.content || (msg.isLoading ? '\u00A0' : '')}
                                        </div>
                                    </div>
                                ))}
                                {isTyping && (
                                    <div className="flex gap-2 animate-pulse mt-1">
                                        <div className="w-6 h-6 rounded-full bg-kala-50 flex items-center justify-center">
                                            <Sparkles size={12} className="text-kala-400" />
                                        </div>
                                        <span className="text-[10px] text-gray-400 pt-1">در حال فکر کردن...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Anchor for Auto-Scroll */}
                        <div ref={bottomRef} className="h-4 w-full shrink-0" />
                    </div>

                    {/* 3. Footer Input (Static Flex Item) */}
                    <div className="shrink-0 w-full p-4 pb-19 bg-white border-t border-gray-100 z-40">
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
                                onClick={handleSend}
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

function getSessionId(): string {
    try {
        const key = 'ekgkala_session_id';
        let id = localStorage.getItem(key);
        if (!id) {
            id = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
            localStorage.setItem(key, id);
        }
        return id;
    } catch {
        return 'sess_fallback_' + Date.now();
    }
}

function getBaseUrl(): string {
    try {
        // @ts-ignore — process may not be available in all build configs
        if (typeof process !== 'undefined' && process?.env?.NEXT_PUBLIC_API_URL) {
            // @ts-ignore
            return process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '');
        }
    } catch {
        // ignore
    }
    return 'https://www.ekgkala.ir';
}
