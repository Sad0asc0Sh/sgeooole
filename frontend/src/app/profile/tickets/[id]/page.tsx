"use client";
import { useEffect, useState, useRef } from "react";
import { ticketService, Ticket } from "@/services/ticketService";
import {
    Send,
    ArrowRight,
    User as UserIcon,
    Headphones,
    Clock,
    CheckCircle,
    AlertCircle,
    Loader2,
    MessageSquare,
    XCircle
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useParams } from "next/navigation";

export default function TicketDetailPage() {
    const params = useParams();
    const ticketId = params.id as string;

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { user } = useAuth();

    useEffect(() => {
        if (ticketId) {
            loadTicket();
        }
    }, [ticketId]);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (ticket?.messages) {
            setTimeout(() => {
                bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [ticket?.messages]);

    const loadTicket = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await ticketService.getById(ticketId);
            setTicket(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "خطا در دریافت اطلاعات تیکت");
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!reply.trim() || sending) return;

        setSending(true);
        try {
            await ticketService.reply(ticketId, reply);
            setReply("");
            loadTicket(); // Refresh chat
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (err) {
            alert("خطا در ارسال پیام");
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setReply(e.target.value);
        // Auto-resize textarea
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'open':
                return { label: 'باز', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
            case 'closed':
                return { label: 'بسته شده', color: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200' };
            case 'answered':
                return { label: 'پاسخ داده شده', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' };
            default:
                return { label: 'در انتظار پاسخ', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'high': return 'فوری';
            case 'medium': return 'مهم';
            default: return 'عادی';
        }
    };

    const getDepartmentLabel = (department: string) => {
        switch (department) {
            case 'support': return 'پشتیبانی فنی';
            case 'sales': return 'فروش و مالی';
            case 'warranty': return 'گارانتی و مرجوعی';
            default: return department;
        }
    };

    // Loading State
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                        <Loader2 size={28} className="text-blue-500 animate-spin" />
                    </div>
                    <p className="text-gray-400 text-sm">در حال بارگذاری گفتگو...</p>
                </div>
            </div>
        );
    }

    // Error State
    if (error || !ticket) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full border border-red-100">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle size={28} className="text-red-500" />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">خطا در بارگذاری</h3>
                    <p className="text-gray-500 text-sm mb-4">{error || "تیکت مورد نظر یافت نشد"}</p>
                    <Link
                        href="/profile/tickets"
                        className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
                    >
                        <ArrowRight size={16} />
                        بازگشت به لیست تیکت‌ها
                    </Link>
                </div>
            </div>
        );
    }

    const statusInfo = getStatusInfo(ticket.status);

    return (
        <div className="flex flex-col h-[100dvh] md:h-[calc(100vh-100px)] bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 shrink-0 shadow-sm">
                <div className="p-4 flex items-center gap-3">
                    <Link
                        href="/profile/tickets"
                        className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowRight size={22} />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-gray-800 text-sm md:text-base truncate">
                            {ticket.subject}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                            <span className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">
                                {ticket.ticketId || `#${ticket._id.slice(-6).toUpperCase()}`}
                            </span>
                            <span>•</span>
                            <span>{getDepartmentLabel(ticket.department)}</span>
                            <span>•</span>
                            <span>{getPriorityLabel(ticket.priority)}</span>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
                        {statusInfo.label}
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 to-white">
                {/* Ticket Info Card */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                        <Clock size={14} />
                        <span>ایجاد شده در: {new Date(ticket.createdAt).toLocaleDateString('fa-IR')} - {new Date(ticket.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                {/* Messages */}
                {ticket.messages && ticket.messages.length > 0 ? (
                    ticket.messages.map((msg, idx) => {
                        const isUser = msg.sender === 'user' || msg.sender === user?.id;

                        return (
                            <div
                                key={msg._id || idx}
                                className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar */}
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isUser
                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                    : 'bg-gradient-to-br from-gray-600 to-gray-700'
                                    }`}>
                                    {isUser
                                        ? <UserIcon size={16} className="text-white" />
                                        : <Headphones size={16} className="text-white" />
                                    }
                                </div>

                                {/* Message Bubble */}
                                <div className={`max-w-[75%] md:max-w-[65%] ${isUser
                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-2xl rounded-tr-md shadow-lg shadow-blue-200/50'
                                    : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-md shadow-sm'
                                    }`}>
                                    <div className="p-4">
                                        {/* Sender Label */}
                                        <div className={`text-[10px] font-bold mb-2 ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
                                            {isUser ? 'شما' : 'پشتیبانی'}
                                        </div>

                                        {/* Message Content */}
                                        <p className="text-sm leading-7 whitespace-pre-wrap break-words">
                                            {msg.message}
                                        </p>

                                        {/* Timestamp */}
                                        <div className={`text-[10px] mt-3 flex items-center gap-1 ${isUser ? 'text-blue-200' : 'text-gray-300'}`}>
                                            <Clock size={10} />
                                            {new Date(msg.createdAt).toLocaleDateString('fa-IR')} - {new Date(msg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-10">
                        <MessageSquare size={32} className="text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">هنوز پیامی در این تیکت ثبت نشده است</p>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input Area */}
            {ticket.status !== 'closed' ? (
                <div className="p-4 bg-white border-t border-gray-100 shrink-0 shadow-lg">
                    <div className="flex items-end gap-3">
                        <div className="flex-1 relative">
                            <textarea
                                ref={textareaRef}
                                value={reply}
                                onChange={handleTextareaChange}
                                onKeyDown={handleKeyDown}
                                placeholder="پیام خود را بنویسید... (Enter برای ارسال)"
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 pr-4 text-sm focus:ring-2 ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all min-h-[52px] max-h-[120px]"
                                rows={1}
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={sending || !reply.trim()}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-3.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 shrink-0"
                        >
                            {sending
                                ? <Loader2 size={20} className="animate-spin" />
                                : <Send size={20} className="rotate-180" />
                            }
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 text-center">
                        با فشردن Shift + Enter می‌توانید به خط بعد بروید
                    </p>
                </div>
            ) : (
                <div className="p-4 bg-gray-50 border-t border-gray-200 shrink-0">
                    <div className="bg-white rounded-xl p-4 border border-gray-100 flex items-center gap-3 justify-center">
                        <CheckCircle size={20} className="text-gray-400" />
                        <p className="text-gray-500 text-sm font-medium">این تیکت بسته شده و امکان ارسال پیام وجود ندارد</p>
                    </div>
                </div>
            )}
        </div>
    );
}
