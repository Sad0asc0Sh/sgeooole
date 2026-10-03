"use client";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { ticketService, Ticket, TicketMessage } from "@/services/ticketService";
import { useAuth } from "@/hooks/useAuth";
import {
    Plus,
    MessageSquare,
    Clock,
    CheckCircle,
    XCircle,
    ArrowRight,
    Headphones,
    AlertCircle,
    Loader2,
    Send,
    User as UserIcon,
    Shield,
    Zap,
    Star,
    CheckCheck,
    Building2,
    Lock,
    Sparkles,
    Inbox
} from "lucide-react";

// ========== TYPES ==========
interface ToastState {
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
}

// پیام پشتیبانی = هر پیامی که از پنل (ادمین/مدیر/پشتیبانی) ثبت شده باشد.
// بک‌اند این را با پرچم isAdminReply مشخص می‌کند؛ فیلد sender فقط ObjectId
// فرستنده است و هیچ‌وقت رشته‌ی 'admin' نیست.
const isSupportMessage = (msg: TicketMessage) => msg.isAdminReply === true;

// ========== SUPPORT MESSENGER (EKG KALA) ==========
export default function SupportMessengerPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={<SupportMessengerFallback />}>
                <SupportMessenger />
            </Suspense>
        </ProtectedRoute>
    );
}

function SupportMessengerFallback() {
    return (
        <div className="h-[100dvh] bg-ekg-50 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-kala-500" />
        </div>
    );
}

function SupportMessenger() {
    // ===== STATE MANAGEMENT =====
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [chatLoading, setChatLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: "",
        department: "support",
        priority: "medium",
        message: ""
    });
    const [toast, setToast] = useState<ToastState>({
        show: false,
        title: '',
        message: '',
        type: 'success'
    });

    // Chat States
    const [reply, setReply] = useState("");
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { user: _user } = useAuth();
    const searchParams = useSearchParams();

    const loadTickets = useCallback(async () => {
        try {
            setLoading(true);
            const data = await ticketService.getAll();
            setTickets(data);
        } catch {
            // handle error silently
        } finally {
            setLoading(false);
        }
    }, []);

    // ===== EFFECTS =====
    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    // Auto-select ticket from URL query parameter
    useEffect(() => {
        const selectedFromUrl = searchParams.get('selected');
        if (selectedFromUrl && !selectedTicketId) {
            setSelectedTicketId(selectedFromUrl);
        }
    }, [searchParams, selectedTicketId]);

    // Auto-hide toast after 4 seconds
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    const showToast = useCallback((title: string, message: string, type: 'success' | 'error') => {
        setToast({ show: true, title, message, type });
    }, []);

    const loadSelectedTicket = useCallback(async (ticketId: string) => {
        try {
            setChatLoading(true);
            const data = await ticketService.getById(ticketId);
            setSelectedTicket(data);
        } catch {
            showToast("خطا", "در بارگذاری تیکت مشکلی پیش آمد", "error");
            setSelectedTicketId(null);
        } finally {
            setChatLoading(false);
        }
    }, [showToast]);

    // Load selected ticket details
    useEffect(() => {
        if (selectedTicketId) {
            loadSelectedTicket(selectedTicketId);
        } else {
            setSelectedTicket(null);
        }
    }, [selectedTicketId, loadSelectedTicket]);

    // Scroll to bottom when messages arrive
    useEffect(() => {
        if (!chatLoading && selectedTicket?.messages) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [chatLoading, selectedTicket?.messages?.length]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const newTicket = await ticketService.create(formData);
            showToast("تیکت ثبت شد", "کارشناسان ما به زودی پاسخ می‌دهند.", "success");
            setShowModal(false);
            setFormData({ subject: "", department: "support", priority: "medium", message: "" });
            loadTickets();
            setSelectedTicketId(newTicket._id);
        } catch {
            showToast("خطا", "مشکلی در ثبت تیکت پیش آمد.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSend = async () => {
        if (!reply.trim() || sending || !selectedTicketId) return;

        setSending(true);
        try {
            await ticketService.reply(selectedTicketId, reply);
            setReply("");
            loadSelectedTicket(selectedTicketId);
            loadTickets();
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch {
            showToast("خطا", "در ارسال پیام مشکلی پیش آمد", "error");
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
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    };

    // ===== HELPER FUNCTIONS =====
    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'open':
                return { label: 'در حال بررسی', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' };
            case 'closed':
                return { label: 'پایان یافته', pill: 'bg-ekg-100 text-ekg-500 border-ekg-200', dot: 'bg-ekg-400' };
            case 'answered':
                return { label: 'پاسخ داده شده', pill: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' };
            default: // 'pending' — پاسخ پنل ثبت شده، در انتظار کاربر
                return { label: 'در انتظار پاسخ شما', pill: 'bg-kala-50 text-kala-700 border-kala-200', dot: 'bg-kala-500' };
        }
    };

    const getDepartmentConfig = (department: string) => {
        switch (department) {
            case 'support': return { label: 'پشتیبانی فنی', icon: Headphones };
            case 'sales': return { label: 'فروش و مالی', icon: Building2 };
            case 'warranty': return { label: 'گارانتی و خدمات', icon: Shield };
            default: return { label: department, icon: MessageSquare };
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        }
        if (isYesterday) {
            return 'دیروز';
        }
        return date.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
    };

    const getLastMessage = (ticket: Ticket) => {
        if (ticket.messages && ticket.messages.length > 0) {
            const lastMsg = ticket.messages[ticket.messages.length - 1];
            const prefix = isSupportMessage(lastMsg) ? 'پشتیبانی: ' : 'شما: ';
            return prefix + lastMsg.message;
        }
        return 'شروع گفتگو...';
    };

    const pendingCount = tickets.filter(t => t.status === 'open' || t.status === 'pending').length;
    const answeredCount = tickets.filter(t => t.status === 'answered').length;

    // ===== RENDER =====
    return (
        <div className="h-[100dvh] md:h-[calc(100dvh-136px)] flex bg-ekg-50 text-ekg-900 overflow-hidden">
            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-[400px] z-[60] animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className={`p-4 rounded-2xl shadow-xl border bg-white/95 backdrop-blur ${toast.type === 'success' ? 'border-emerald-200' : 'border-rose-200'}`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-xl ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                {toast.type === 'success'
                                    ? <CheckCircle size={20} className="text-emerald-600" />
                                    : <AlertCircle size={20} className="text-rose-600" />
                                }
                            </div>
                            <div className="flex-1 pt-0.5">
                                <h4 className="font-bold text-sm text-ekg-900">{toast.title}</h4>
                                <p className="text-[13px] mt-0.5 text-ekg-500">{toast.message}</p>
                            </div>
                            <button
                                onClick={() => setToast(prev => ({ ...prev, show: false }))}
                                className="p-1 text-ekg-400 hover:text-ekg-600 hover:bg-ekg-100 rounded-lg transition-all"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========== SIDEBAR - TICKET LIST ========== */}
            <aside className={`
                ${selectedTicketId ? 'hidden md:flex' : 'flex'}
                flex-col w-full md:w-[360px] lg:w-[400px] shrink-0
                bg-white border-l border-ekg-200/70
            `}>
                {/* Brand header */}
                <div className="relative overflow-hidden bg-ekg-950 shrink-0">
                    <div className="absolute -left-10 -top-10 w-44 h-44 bg-kala-500/20 rounded-full blur-3xl" />
                    <div className="absolute -right-8 -bottom-12 w-36 h-36 bg-kala-600/10 rounded-full blur-2xl" />
                    <div className="relative p-5">
                        <div className="flex items-center gap-3">
                            <Link
                                href="/profile"
                                className="p-2 -mr-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                aria-label="بازگشت به پروفایل"
                            >
                                <ArrowRight size={20} />
                            </Link>
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-kala-400 to-kala-600 flex items-center justify-center shadow-lg shadow-kala-900/40 ring-1 ring-kala-300/40">
                                <Headphones size={22} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h1 className="font-extrabold text-lg text-white leading-6">مرکز پشتیبانی</h1>
                                <p className="text-xs text-white/60 mt-1">گفت‌وگوی مستقیم با کارشناسان ای‌کا‌جی‌کالا</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-4">
                            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[11px] text-white/85 font-medium">پاسخگویی همه‌روزه</span>
                            </span>
                            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
                                <Lock size={11} className="text-kala-300" />
                                <span className="text-[11px] text-white/85 font-medium">محرمانه</span>
                            </span>
                        </div>
                    </div>
                    <div className="h-[2px] w-full bg-gradient-to-l from-kala-600 via-kala-400 to-kala-600" />
                </div>

                {/* New ticket CTA */}
                <div className="p-4 border-b border-ekg-100 shrink-0">
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full group bg-kala-500 hover:bg-kala-600 text-white px-5 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2.5 shadow-lg shadow-kala-500/25 transition-all hover:shadow-kala-500/40 active:scale-[0.98]"
                    >
                        <span className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                            <Plus size={18} />
                        </span>
                        <span className="text-sm">ثبت درخواست جدید</span>
                        <Sparkles size={16} className="text-kala-100/70" />
                    </button>
                </div>

                {/* Stats */}
                {!loading && tickets.length > 0 && (
                    <div className="px-4 py-2.5 bg-ekg-50 border-b border-ekg-100 flex items-center gap-4 shrink-0">
                        <span className="flex items-center gap-1.5 text-xs text-ekg-500">
                            <span className="w-2 h-2 rounded-full bg-kala-500" />
                            <b className="text-ekg-800">{pendingCount}</b> در انتظار
                        </span>
                        <span className="w-px h-4 bg-ekg-200" />
                        <span className="flex items-center gap-1.5 text-xs text-ekg-500">
                            <CheckCheck size={14} className="text-emerald-600" />
                            <b className="text-ekg-800">{answeredCount}</b> پاسخ داده شده
                        </span>
                    </div>
                )}

                {/* Ticket list */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-14 h-14 bg-ekg-100 rounded-2xl flex items-center justify-center">
                                <Loader2 size={26} className="text-kala-500 animate-spin" />
                            </div>
                            <p className="text-ekg-500 text-sm mt-4">در حال بارگذاری تیکت‌ها...</p>
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                            <div className="w-20 h-20 bg-ekg-100 rounded-3xl flex items-center justify-center mb-4">
                                <Inbox size={34} className="text-ekg-400" />
                            </div>
                            <h3 className="text-ekg-800 font-bold mb-1.5">هنوز تیکتی ثبت نشده</h3>
                            <p className="text-ekg-400 text-[13px] leading-6 max-w-[260px]">
                                سوال یا مشکلی دارید؟ کارشناسان ما آماده‌ی پاسخگویی هستند
                            </p>
                            <button
                                onClick={() => setShowModal(true)}
                                className="mt-5 text-kala-600 font-bold text-sm hover:text-kala-700 flex items-center gap-1.5"
                            >
                                <Plus size={15} />
                                ثبت اولین تیکت
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-ekg-100">
                            {tickets.map(ticket => {
                                const statusConfig = getStatusConfig(ticket.status);
                                const deptConfig = getDepartmentConfig(ticket.department);
                                const isSelected = selectedTicketId === ticket._id;
                                const DeptIcon = deptConfig.icon;

                                return (
                                    <button
                                        key={ticket._id}
                                        onClick={() => setSelectedTicketId(ticket._id)}
                                        className={`w-full text-right p-4 transition-colors flex gap-3.5 ${isSelected
                                            ? 'bg-kala-50/70 border-r-[3px] border-kala-500'
                                            : 'hover:bg-ekg-50 border-r-[3px] border-transparent'
                                            }`}
                                    >
                                        <div className={`relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-kala-100 text-kala-700' : 'bg-ekg-100 text-ekg-600'}`}>
                                            <DeptIcon size={20} />
                                            {(ticket.status === 'open' || ticket.status === 'pending') && (
                                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <h3 className="font-bold text-sm truncate text-ekg-900">
                                                    {ticket.subject}
                                                </h3>
                                                <span className="text-[11px] text-ekg-400 shrink-0">
                                                    {formatTime(ticket.updatedAt)}
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-ekg-500 truncate mb-2 leading-5">
                                                {getLastMessage(ticket)}
                                            </p>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${statusConfig.pill}`}>
                                                        {statusConfig.label}
                                                    </span>
                                                    <span className="text-[10px] text-ekg-400 bg-ekg-100 px-2 py-0.5 rounded-md">
                                                        {deptConfig.label}
                                                    </span>
                                                </div>
                                                {ticket.messages && ticket.messages.length > 0 && (
                                                    <span className="text-[10px] text-ekg-400 font-medium">
                                                        {ticket.messages.length} پیام
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </aside>

            {/* ========== CHAT AREA ========== */}
            <section className={`
                ${selectedTicketId ? 'flex' : 'hidden md:flex'}
                flex-1 flex-col min-w-0 bg-ekg-50
            `}>
                {selectedTicketId && selectedTicket ? (
                    <>
                        {/* Chat header */}
                        <div className="bg-white border-b border-ekg-200/70 shrink-0">
                            <div className="px-4 py-3 flex items-center gap-3">
                                <button
                                    onClick={() => setSelectedTicketId(null)}
                                    className="p-2 -mr-1 text-ekg-500 hover:bg-ekg-100 rounded-xl transition-all md:hidden"
                                    aria-label="بازگشت به لیست"
                                >
                                    <ArrowRight size={20} />
                                </button>
                                <div className="w-11 h-11 rounded-2xl bg-ekg-950 flex items-center justify-center shrink-0 ring-1 ring-ekg-800">
                                    <Headphones size={19} className="text-kala-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-bold text-ekg-900 text-[15px] truncate">
                                        {selectedTicket.subject}
                                    </h2>
                                    <div className="flex items-center gap-2 text-[11px] text-ekg-400 mt-1">
                                        <span className="font-mono bg-ekg-100 px-2 py-0.5 rounded-md text-ekg-500" dir="ltr">
                                            {selectedTicket.ticketId || `#${selectedTicket._id.slice(-6).toUpperCase()}`}
                                        </span>
                                        <span className="w-1 h-1 bg-ekg-300 rounded-full" />
                                        <span>{getDepartmentConfig(selectedTicket.department).label}</span>
                                    </div>
                                </div>
                                <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${getStatusConfig(selectedTicket.status).pill}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusConfig(selectedTicket.status).dot}`} />
                                    {getStatusConfig(selectedTicket.status).label}
                                </span>
                            </div>
                            <div className="h-[2px] w-full bg-gradient-to-l from-kala-600 via-kala-400 to-kala-600" />
                        </div>

                        {/* Messages */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto px-4 py-5"
                            style={{
                                backgroundImage: 'radial-gradient(rgba(120,113,108,0.10) 1px, transparent 1px)',
                                backgroundSize: '22px 22px',
                            }}
                        >
                            <div className="max-w-3xl mx-auto space-y-4">
                                {chatLoading ? (
                                    <div className="flex justify-center py-14">
                                        <div className="bg-white rounded-2xl px-8 py-6 shadow-sm border border-ekg-200/70 text-center">
                                            <Loader2 size={24} className="text-kala-500 animate-spin mx-auto mb-3" />
                                            <p className="text-ekg-500 text-sm">در حال بارگذاری گفتگو...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Created info */}
                                        <div className="flex justify-center mb-2">
                                            <div className="bg-white/90 rounded-full px-4 py-1.5 shadow-sm border border-ekg-200/70 flex items-center gap-2">
                                                <Clock size={12} className="text-kala-600" />
                                                <span className="text-[11px] text-ekg-500">
                                                    {new Date(selectedTicket.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                    {' • '}
                                                    {new Date(selectedTicket.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Message bubbles — تمایز فرستنده با isAdminReply */}
                                        {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                            selectedTicket.messages.map((msg, idx) => {
                                                const support = isSupportMessage(msg);

                                                return (
                                                    <div
                                                        key={msg._id || idx}
                                                        className={`flex ${support ? 'justify-start' : 'justify-end'}`}
                                                    >
                                                        {support && (
                                                            <div className="w-8 h-8 bg-ekg-950 rounded-xl flex items-center justify-center ml-2 shrink-0 self-end mb-0.5 ring-1 ring-ekg-800">
                                                                <Shield size={13} className="text-kala-400" />
                                                            </div>
                                                        )}

                                                        <div className={`max-w-[82%] md:max-w-[70%] ${support
                                                            ? 'bg-white text-ekg-900 rounded-2xl rounded-bl-md shadow-sm border border-ekg-200/80'
                                                            : 'bg-gradient-to-br from-kala-500 to-kala-600 text-white rounded-2xl rounded-br-md shadow-md shadow-kala-500/20'
                                                            }`}>
                                                            <div className="px-4 py-3">
                                                                <div className={`text-[11px] font-bold mb-1.5 flex items-center gap-1.5 ${support ? 'text-kala-700' : 'text-kala-100'}`}>
                                                                    {support ? (
                                                                        <>
                                                                            <Shield size={12} />
                                                                            کارشناس پشتیبانی
                                                                            <span className="font-normal text-ekg-400">• ای‌کا‌جی‌کالا</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <UserIcon size={12} />
                                                                            شما
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm leading-7 whitespace-pre-wrap break-words">
                                                                    {msg.message}
                                                                </p>
                                                                <div className={`text-[10px] mt-2 flex items-center gap-1 ${support ? 'text-ekg-400' : 'text-kala-100/90 justify-end'}`}>
                                                                    {new Date(msg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                                    {!support && <CheckCheck size={13} />}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {!support && (
                                                            <div className="w-8 h-8 bg-kala-100 rounded-xl flex items-center justify-center mr-2 shrink-0 self-end mb-0.5 border border-kala-200/60">
                                                                <UserIcon size={13} className="text-kala-700" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="flex justify-center py-14">
                                                <div className="bg-white rounded-2xl px-8 py-6 shadow-sm border border-ekg-200/70 text-center">
                                                    <div className="w-14 h-14 bg-ekg-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                                        <MessageSquare size={24} className="text-ekg-400" />
                                                    </div>
                                                    <p className="text-ekg-600 text-sm font-medium">گفتگو را شروع کنید</p>
                                                    <p className="text-ekg-400 text-xs mt-1">کارشناسان ما آماده‌ی پاسخگویی هستند</p>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={bottomRef} />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Input */}
                        {selectedTicket.status !== 'closed' ? (
                            <div className="p-3 md:p-4 bg-white border-t border-ekg-200/70 shrink-0">
                                <div className="max-w-3xl mx-auto">
                                    <div className="flex items-end gap-2.5">
                                        <div className="flex-1">
                                            <textarea
                                                ref={textareaRef}
                                                value={reply}
                                                onChange={handleTextareaChange}
                                                onKeyDown={handleKeyDown}
                                                placeholder="پیام خود را بنویسید..."
                                                className="w-full bg-ekg-100/70 border border-ekg-200 rounded-2xl px-4 py-3 text-sm text-ekg-900 placeholder:text-ekg-400 focus:ring-2 ring-kala-500/30 focus:border-kala-500 focus:bg-white outline-none resize-none transition-all min-h-[48px] max-h-[120px] leading-6"
                                                rows={1}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSend}
                                            disabled={sending || !reply.trim()}
                                            className="bg-kala-500 hover:bg-kala-600 text-white p-3.5 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-kala-500/25 shrink-0 active:scale-95"
                                            aria-label="ارسال پیام"
                                        >
                                            {sending
                                                ? <Loader2 size={19} className="animate-spin" />
                                                : <Send size={19} className="rotate-180" />
                                            }
                                        </button>
                                    </div>
                                    <p className="text-center text-[10px] text-ekg-400 mt-2">
                                        Enter برای ارسال • Shift+Enter برای خط جدید
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 bg-ekg-100/60 border-t border-ekg-200 shrink-0">
                                <div className="max-w-3xl mx-auto bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 justify-center text-ekg-500 border border-ekg-200">
                                    <CheckCircle size={17} className="text-ekg-400" />
                                    <div className="text-center">
                                        <p className="text-[13px] font-medium">این تیکت بسته شده است</p>
                                        <p className="text-[11px] text-ekg-400 mt-0.5">برای ارتباط مجدد، تیکت جدید ثبت کنید</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    /* Empty state — desktop */
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="relative mb-7">
                            <div className="w-32 h-32 bg-ekg-950 rounded-[2rem] flex items-center justify-center shadow-xl ring-1 ring-ekg-800">
                                <Headphones size={48} className="text-kala-400" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-11 h-11 bg-kala-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Shield size={20} className="text-white" />
                            </div>
                        </div>
                        <h3 className="text-xl font-extrabold text-ekg-900 mb-2">مرکز پشتیبانی ای‌کا‌جی‌کالا</h3>
                        <p className="text-ekg-500 text-sm max-w-sm leading-7 mb-6">
                            یک تیکت از لیست انتخاب کنید یا درخواست جدید ثبت نمایید؛ کارشناسان ما در کنار شما هستند.
                        </p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="bg-kala-500 hover:bg-kala-600 text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2.5 shadow-lg shadow-kala-500/25 transition-all active:scale-95"
                        >
                            <Plus size={18} />
                            ثبت درخواست جدید
                        </button>
                        <div className="flex items-center gap-5 mt-8 text-ekg-400">
                            <span className="flex items-center gap-1.5 text-xs">
                                <Zap size={14} className="text-kala-500" />
                                پاسخ سریع
                            </span>
                            <span className="w-1 h-1 bg-ekg-300 rounded-full" />
                            <span className="flex items-center gap-1.5 text-xs">
                                <Star size={14} className="text-kala-500" />
                                کارشناس حرفه‌ای
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* ========== NEW TICKET MODAL ========== */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-ekg-950/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white rounded-t-[1.75rem] md:rounded-3xl w-full max-w-lg max-h-[92dvh] overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-ekg-950 p-6 rounded-t-[1.75rem] md:rounded-t-3xl relative overflow-hidden">
                            <div className="absolute -left-8 -top-8 w-36 h-36 bg-kala-500/20 rounded-full blur-3xl" />
                            <div className="relative flex justify-between items-start">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 bg-gradient-to-br from-kala-400 to-kala-600 rounded-2xl flex items-center justify-center ring-1 ring-kala-300/40">
                                        <MessageSquare size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-lg text-white">درخواست جدید</h3>
                                        <p className="text-xs text-white/60 mt-1">فرم زیر را تکمیل کنید</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    aria-label="بستن"
                                >
                                    <XCircle size={24} />
                                </button>
                            </div>
                            <div className="absolute bottom-0 right-0 left-0 h-[2px] bg-gradient-to-l from-kala-600 via-kala-400 to-kala-600" />
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            <div>
                                <label className="block text-[13px] font-bold text-ekg-700 mb-2">موضوع درخواست</label>
                                <input
                                    required
                                    className="w-full bg-ekg-100/70 border border-ekg-200 rounded-xl px-4 py-3.5 text-sm text-ekg-900 placeholder:text-ekg-400 focus:ring-2 ring-kala-500/30 focus:border-kala-500 focus:bg-white outline-none transition-all"
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="مثال: پیگیری سفارش شماره ۱۲۳۴"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[13px] font-bold text-ekg-700 mb-2">دپارتمان</label>
                                    <select
                                        className="w-full bg-ekg-100/70 border border-ekg-200 rounded-xl px-4 py-3.5 text-sm text-ekg-900 focus:ring-2 ring-kala-500/30 focus:border-kala-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                        value={formData.department}
                                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    >
                                        <option value="support">پشتیبانی فنی</option>
                                        <option value="sales">فروش و مالی</option>
                                        <option value="warranty">گارانتی و خدمات</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold text-ekg-700 mb-2">اولویت</label>
                                    <select
                                        className="w-full bg-ekg-100/70 border border-ekg-200 rounded-xl px-4 py-3.5 text-sm text-ekg-900 focus:ring-2 ring-kala-500/30 focus:border-kala-500 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                    >
                                        <option value="low">عادی</option>
                                        <option value="medium">مهم</option>
                                        <option value="high">فوری</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[13px] font-bold text-ekg-700 mb-2">شرح درخواست</label>
                                <textarea
                                    required
                                    rows={5}
                                    className="w-full bg-ekg-100/70 border border-ekg-200 rounded-xl px-4 py-3.5 text-sm text-ekg-900 placeholder:text-ekg-400 focus:ring-2 ring-kala-500/30 focus:border-kala-500 focus:bg-white outline-none transition-all resize-none leading-7"
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="توضیحات کامل درخواست خود را بنویسید..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-kala-500 hover:bg-kala-600 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-kala-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 active:scale-[0.98]"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={19} className="animate-spin" />
                                        در حال ارسال...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} className="rotate-180" />
                                        ارسال درخواست
                                    </>
                                )}
                            </button>

                            <div className="flex items-center justify-center gap-1.5 text-xs text-ekg-400">
                                <Zap size={13} className="text-kala-500" />
                                <span>معمولاً در کمتر از ۲ ساعت پاسخ داده می‌شود</span>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
