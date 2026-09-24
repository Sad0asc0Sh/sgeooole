"use client";
import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { ticketService, Ticket } from "@/services/ticketService";
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
    Sparkles
} from "lucide-react";

// ========== TYPES ==========
interface ToastState {
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
}

// ========== PREMIUM SUPPORT MESSENGER ==========
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-violet-500" />
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

    // Load selected ticket details
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
                return {
                    label: 'در حال بررسی',
                    color: 'text-emerald-700',
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-200',
                    dot: 'bg-emerald-500',
                    gradient: 'from-emerald-500 to-teal-600'
                };
            case 'closed':
                return {
                    label: 'پایان یافته',
                    color: 'text-slate-600',
                    bg: 'bg-slate-100',
                    border: 'border-slate-200',
                    dot: 'bg-slate-400',
                    gradient: 'from-slate-400 to-slate-500'
                };
            case 'answered':
                return {
                    label: 'پاسخ داده شده',
                    color: 'text-sky-700',
                    bg: 'bg-sky-50',
                    border: 'border-sky-200',
                    dot: 'bg-sky-500',
                    gradient: 'from-sky-500 to-blue-600'
                };
            default:
                return {
                    label: 'در انتظار پاسخ',
                    color: 'text-amber-700',
                    bg: 'bg-amber-50',
                    border: 'border-amber-200',
                    dot: 'bg-amber-500',
                    gradient: 'from-amber-500 to-orange-600'
                };
        }
    };

    const getDepartmentConfig = (department: string) => {
        switch (department) {
            case 'support': return { label: 'پشتیبانی فنی', icon: Headphones, color: 'text-violet-600' };
            case 'sales': return { label: 'فروش و مالی', icon: Building2, color: 'text-emerald-600' };
            case 'warranty': return { label: 'گارانتی و خدمات', icon: Shield, color: 'text-blue-600' };
            default: return { label: department, icon: MessageSquare, color: 'text-gray-600' };
        }
    };

    const _getPriorityConfig = (priority: string) => {
        switch (priority) {
            case 'high': return { label: 'فوری', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' };
            case 'medium': return { label: 'مهم', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
            default: return { label: 'عادی', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' };
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
            // Admin messages have sender as 'admin', everything else is user
            const isUserMessage = lastMsg.sender !== 'admin';
            const prefix = isUserMessage ? 'شما: ' : 'پشتیبانی: ';
            return prefix + lastMsg.message;
        }
        return 'شروع گفتگو...';
    };

    // ===== RENDER =====
    return (
        <div className="h-screen h-[100dvh] flex flex-col bg-white bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden">
            {/* Toast Notification - Premium Style */}
            {toast.show && (
                <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-[60] animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${toast.type === 'success'
                        ? 'bg-gradient-to-r from-emerald-50/95 to-teal-50/95 border-emerald-200/60'
                        : 'bg-gradient-to-r from-rose-50/95 to-red-50/95 border-rose-200/60'
                        }`}>
                        <div className="flex items-start gap-4">
                            <div className={`p-2.5 rounded-xl ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                                {toast.type === 'success'
                                    ? <CheckCircle size={22} className="text-emerald-600" />
                                    : <AlertCircle size={22} className="text-rose-600" />
                                }
                            </div>
                            <div className="flex-1 pt-0.5">
                                <h4 className={`font-bold text-[15px] ${toast.type === 'success' ? 'text-emerald-800' : 'text-rose-800'}`}>
                                    {toast.title}
                                </h4>
                                <p className={`text-sm mt-1 ${toast.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {toast.message}
                                </p>
                            </div>
                            <button
                                onClick={() => setToast(prev => ({ ...prev, show: false }))}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Container */}
            <div className="flex-1 flex overflow-hidden">

                {/* ========== SIDEBAR - TICKET LIST ========== */}
                <div className={`
                    ${selectedTicketId ? 'hidden md:flex' : 'flex'} 
                    flex-col w-full md:w-[380px] lg:w-[420px] 
                    border-l border-slate-200/60 bg-white shrink-0 shadow-xl shadow-slate-200/20
                `}>
                    {/* Premium Sidebar Header */}
                    <div className="relative overflow-hidden">
                        {/* Gradient Background */}
                        <div className="absolute inset-0 bg-gradient-to-bl from-indigo-600 via-violet-600 to-purple-700"></div>
                        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_25%,rgba(255,255,255,0.1)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.1)_75%)] bg-[length:10px_10px]"></div>

                        {/* Content */}
                        <div className="relative p-5">
                            <div className="flex items-center gap-4">
                                <Link
                                    href="/profile"
                                    className="p-2 -mr-2 hover:bg-white/10 rounded-xl transition-all"
                                >
                                    <ArrowRight size={22} className="text-white" />
                                </Link>
                                <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                                    <Headphones size={24} className="text-white" />
                                </div>
                                <div className="flex-1">
                                    <h1 className="font-black text-xl text-white">مرکز پشتیبانی</h1>
                                    <p className="text-sm text-white/70 mt-0.5">پاسخگویی ۲۴ ساعته</p>
                                </div>
                            </div>

                            {/* Trust Badges */}
                            <div className="flex items-center gap-3 mt-5">
                                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                                    <Shield size={14} className="text-emerald-300" />
                                    <span className="text-xs text-white/90 font-medium">پاسخ امن</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                                    <Zap size={14} className="text-amber-300" />
                                    <span className="text-xs text-white/90 font-medium">پاسخ سریع</span>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                                    <Star size={14} className="text-yellow-300" />
                                    <span className="text-xs text-white/90 font-medium">کارشناس حرفه‌ای</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* New Ticket Button - Premium */}
                    <div className="p-4 border-b border-slate-100">
                        <button
                            onClick={() => setShowModal(true)}
                            className="w-full group relative overflow-hidden bg-gradient-to-l from-indigo-500 via-violet-500 to-purple-600 text-white px-5 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-violet-200/50 hover:shadow-violet-300/60 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <div className="absolute inset-0 bg-gradient-to-l from-indigo-600 via-violet-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative flex items-center gap-3">
                                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Plus size={20} />
                                </div>
                                <span className="text-[15px]">ارسال درخواست جدید</span>
                            </div>
                            <Sparkles size={18} className="absolute left-4 text-white/40" />
                        </button>
                    </div>

                    {/* Stats Bar */}
                    {!loading && tickets.length > 0 && (
                        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-xs text-slate-600">
                                    <span className="font-bold text-slate-800">{tickets.filter(t => t.status === 'open' || t.status === 'pending').length}</span> در انتظار
                                </span>
                            </div>
                            <div className="w-px h-4 bg-slate-200"></div>
                            <div className="flex items-center gap-2">
                                <CheckCheck size={14} className="text-sky-500" />
                                <span className="text-xs text-slate-600">
                                    <span className="font-bold text-slate-800">{tickets.filter(t => t.status === 'answered').length}</span> پاسخ داده شده
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Ticket List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <div className="relative">
                                    <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center">
                                        <Loader2 size={28} className="text-violet-500 animate-spin" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg">
                                        <Lock size={12} className="text-white" />
                                    </div>
                                </div>
                                <p className="text-slate-500 text-sm mt-4 font-medium">در حال بارگذاری تیکت‌ها...</p>
                                <p className="text-slate-400 text-xs mt-1">اتصال امن برقرار است</p>
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                                <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-50 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                                    <MessageSquare size={40} className="text-slate-300" />
                                </div>
                                <h3 className="text-slate-700 font-bold text-lg mb-2">هنوز تیکتی ثبت نشده</h3>
                                <p className="text-slate-400 text-sm leading-6 max-w-[280px]">
                                    سوال یا مشکلی دارید؟ تیم پشتیبانی ما ۲۴ ساعته آماده کمک به شماست
                                </p>
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="mt-6 text-violet-600 font-bold text-sm hover:text-violet-700 flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    ثبت اولین تیکت
                                </button>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100/80">
                                {tickets.map(ticket => {
                                    const statusConfig = getStatusConfig(ticket.status);
                                    const deptConfig = getDepartmentConfig(ticket.department);
                                    const isSelected = selectedTicketId === ticket._id;
                                    const DeptIcon = deptConfig.icon;

                                    return (
                                        <button
                                            key={ticket._id}
                                            onClick={() => setSelectedTicketId(ticket._id)}
                                            className={`w-full text-right p-4 transition-all duration-200 flex gap-4 group ${isSelected
                                                ? 'bg-gradient-to-l from-violet-50 to-purple-50/50 border-r-[3px] border-violet-500'
                                                : 'hover:bg-slate-50/80'
                                                }`}
                                        >
                                            {/* Avatar with Status */}
                                            <div className="relative shrink-0">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${statusConfig.gradient} shadow-lg`}>
                                                    <DeptIcon size={22} className="text-white" />
                                                </div>
                                                {(ticket.status === 'open' || ticket.status === 'pending') && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse"></div>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <h3 className={`font-bold text-[15px] truncate ${isSelected ? 'text-violet-900' : 'text-slate-800'}`}>
                                                        {ticket.subject}
                                                    </h3>
                                                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                                                        {formatTime(ticket.updatedAt)}
                                                    </span>
                                                </div>

                                                <p className="text-sm text-slate-500 truncate mb-2 leading-5">
                                                    {getLastMessage(ticket)}
                                                </p>

                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                                                            {statusConfig.label}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                                            {deptConfig.label}
                                                        </span>
                                                    </div>
                                                    {ticket.messages && ticket.messages.length > 0 && (
                                                        <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${ticket.status === 'answered'
                                                            ? 'bg-sky-500 text-white'
                                                            : 'bg-slate-200 text-slate-600'
                                                            }`}>
                                                            {ticket.messages.length} پیام
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Security Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                            <Lock size={12} className="text-emerald-500" />
                            <span>تمامی مکالمات شما رمزنگاری شده است</span>
                        </div>
                    </div>
                </div>

                {/* ========== CHAT AREA ========== */}
                <div className={`
                    ${selectedTicketId ? 'flex' : 'hidden md:flex'} 
                    flex-1 flex-col min-w-0 bg-gradient-to-br from-slate-100 via-slate-50 to-white
                `}>
                    {selectedTicketId && selectedTicket ? (
                        <>
                            {/* Premium Chat Header */}
                            <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/60 shrink-0 shadow-sm">
                                <div className="p-4 flex items-center gap-4">
                                    {/* Back Button - Mobile */}
                                    <button
                                        onClick={() => setSelectedTicketId(null)}
                                        className="p-2.5 -mr-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all md:hidden"
                                    >
                                        <ArrowRight size={22} />
                                    </button>

                                    {/* Avatar with Online Status */}
                                    <div className="relative">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${getStatusConfig(selectedTicket.status).gradient} shadow-lg`}>
                                            <Headphones size={20} className="text-white" />
                                        </div>
                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-bold text-slate-800 text-[15px] truncate">
                                            {selectedTicket.subject}
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-500">
                                                {selectedTicket.ticketId || `#${selectedTicket._id.slice(-6).toUpperCase()}`}
                                            </span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span>{getDepartmentConfig(selectedTicket.department).label}</span>
                                        </div>
                                    </div>

                                    {/* Status Badge - Premium */}
                                    <div className={`px-4 py-2 rounded-xl text-xs font-bold ${getStatusConfig(selectedTicket.status).bg} ${getStatusConfig(selectedTicket.status).color} ${getStatusConfig(selectedTicket.status).border} border hidden sm:flex items-center gap-2`}>
                                        <div className={`w-2 h-2 rounded-full ${getStatusConfig(selectedTicket.status).dot} ${selectedTicket.status === 'open' ? 'animate-pulse' : ''}`}></div>
                                        {getStatusConfig(selectedTicket.status).label}
                                    </div>
                                </div>
                            </div>

                            {/* Messages Container with Premium Background */}
                            <div
                                className="flex-1 overflow-y-auto p-4 space-y-4"
                                style={{
                                    backgroundImage: `
                                        radial-gradient(circle at 20% 50%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
                                        radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.03) 0%, transparent 50%),
                                        radial-gradient(circle at 40% 80%, rgba(16, 185, 129, 0.03) 0%, transparent 50%)
                                    `,
                                    backgroundColor: '#f8fafc'
                                }}
                            >
                                {chatLoading ? (
                                    <div className="flex justify-center py-16">
                                        <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-xl border border-slate-200/50 text-center">
                                            <div className="w-14 h-14 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                                                <Loader2 size={24} className="text-violet-500 animate-spin" />
                                            </div>
                                            <p className="text-slate-600 text-sm font-medium">در حال بارگذاری مکالمه...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Ticket Created Info */}
                                        <div className="flex justify-center mb-6">
                                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-sm border border-slate-200/50 flex items-center gap-3">
                                                <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                                                    <Clock size={14} className="text-violet-600" />
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    <span className="font-medium">تاریخ ایجاد:</span>
                                                    <span className="mr-1 text-slate-700">
                                                        {new Date(selectedTicket.createdAt).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                                    </span>
                                                    <span className="mr-1">ساعت</span>
                                                    <span className="text-slate-700">
                                                        {new Date(selectedTicket.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Messages */}
                                        {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                                            selectedTicket.messages.map((msg, idx) => {
                                                // Admin messages have sender as 'admin', everything else is user
                                                const isUser = msg.sender !== 'admin';

                                                return (
                                                    <div
                                                        key={msg._id || idx}
                                                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        {/* Support Avatar - Only for support messages */}
                                                        {!isUser && (
                                                            <div className="w-9 h-9 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center ml-2 shrink-0 shadow-lg self-end mb-1">
                                                                <Headphones size={14} className="text-white" />
                                                            </div>
                                                        )}

                                                        <div className={`max-w-[80%] md:max-w-[65%] ${isUser
                                                            ? 'bg-gradient-to-br from-violet-500 via-violet-600 to-purple-600 text-white rounded-2xl rounded-br-md shadow-xl shadow-violet-200/30'
                                                            : 'bg-white text-slate-800 rounded-2xl rounded-bl-md shadow-lg border border-slate-200/60'
                                                            }`}>
                                                            <div className="p-4">
                                                                {/* Sender Label */}
                                                                <div className={`text-[11px] font-bold mb-2 flex items-center gap-1.5 ${isUser ? 'text-violet-200' : 'text-violet-600'}`}>
                                                                    {isUser ? (
                                                                        <>
                                                                            <UserIcon size={12} />
                                                                            شما
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Shield size={12} />
                                                                            کارشناس پشتیبانی
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Message Content */}
                                                                <p className="text-sm leading-7 whitespace-pre-wrap break-words">
                                                                    {msg.message}
                                                                </p>

                                                                {/* Timestamp */}
                                                                <div className={`text-[10px] mt-3 flex items-center gap-1.5 ${isUser ? 'text-violet-300 justify-end' : 'text-slate-400'}`}>
                                                                    {new Date(msg.createdAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                                                                    {isUser && <CheckCheck size={12} />}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* User Avatar - Only for user messages */}
                                                        {isUser && (
                                                            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mr-2 shrink-0 shadow-lg self-end mb-1">
                                                                <UserIcon size={14} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="flex justify-center py-16">
                                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-lg border border-slate-200/50 text-center">
                                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                        <MessageSquare size={28} className="text-slate-300" />
                                                    </div>
                                                    <p className="text-slate-500 text-sm font-medium">اولین پیام را ارسال کنید</p>
                                                    <p className="text-slate-400 text-xs mt-1">کارشناسان ما آماده پاسخگویی هستند</p>
                                                </div>
                                            </div>
                                        )}
                                        <div ref={bottomRef} />
                                    </>
                                )}
                            </div>

                            {/* Premium Input Area */}
                            {selectedTicket.status !== 'closed' ? (
                                <div className="p-4 bg-white/95 backdrop-blur-md border-t border-slate-200/60 shrink-0">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1 relative">
                                            <textarea
                                                ref={textareaRef}
                                                value={reply}
                                                onChange={handleTextareaChange}
                                                onKeyDown={handleKeyDown}
                                                placeholder="پیام خود را بنویسید..."
                                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-5 text-sm focus:ring-2 ring-violet-500/20 focus:border-violet-400 focus:bg-white outline-none resize-none transition-all min-h-[52px] max-h-[120px] shadow-inner"
                                                rows={1}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSend}
                                            disabled={sending || !reply.trim()}
                                            className="bg-gradient-to-br from-violet-500 via-violet-600 to-purple-600 text-white p-3.5 rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl shadow-violet-200/40 shrink-0 hover:scale-105 active:scale-95"
                                        >
                                            {sending
                                                ? <Loader2 size={20} className="animate-spin" />
                                                : <Send size={20} className="rotate-180" />
                                            }
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Lock size={10} className="text-emerald-500" />
                                            پیام رمزنگاری شده
                                        </span>
                                        <span>•</span>
                                        <span>Enter برای ارسال</span>
                                        <span>•</span>
                                        <span>Shift+Enter خط جدید</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
                                    <div className="bg-white rounded-2xl p-4 flex items-center gap-3 justify-center text-slate-500 border border-slate-200 shadow-sm">
                                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                                            <CheckCircle size={16} className="text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">این تیکت بسته شده است</p>
                                            <p className="text-xs text-slate-400 mt-0.5">برای ارتباط مجدد، تیکت جدید ایجاد کنید</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Premium Empty State - No ticket selected */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
                            <div className="relative mb-8">
                                <div className="w-40 h-40 bg-gradient-to-br from-violet-100 via-purple-100 to-indigo-100 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-violet-100/50">
                                    <Headphones size={56} className="text-violet-400" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl">
                                    <Shield size={24} className="text-white" />
                                </div>
                                <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg animate-bounce">
                                    <Zap size={18} className="text-white" />
                                </div>
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 mb-3">مرکز پشتیبانی حرفه‌ای</h3>
                            <p className="text-slate-500 text-center max-w-md leading-7 mb-8">
                                تیم متخصص ما ۲۴ ساعته آماده پاسخگویی به سوالات و رفع مشکلات شماست.
                                <br />
                                یک تیکت از لیست انتخاب کنید یا درخواست جدید ارسال نمایید.
                            </p>

                            <button
                                onClick={() => setShowModal(true)}
                                className="group bg-gradient-to-r from-violet-500 via-violet-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:from-violet-600 hover:to-purple-700 transition-all shadow-2xl shadow-violet-200/50 hover:shadow-violet-300/60 hover:scale-105 active:scale-95"
                            >
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-all">
                                    <Plus size={20} />
                                </div>
                                ارسال درخواست جدید
                            </button>

                            {/* Trust Indicators */}
                            <div className="flex items-center gap-6 mt-10">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Clock size={16} className="text-violet-400" />
                                    <span className="text-xs">پاسخ در کمتر از ۲ ساعت</span>
                                </div>
                                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Star size={16} className="text-amber-400" />
                                    <span className="text-xs">رضایت ۹۸٪ کاربران</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ========== PREMIUM NEW TICKET MODAL ========== */}
            {
                showModal && (
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <div
                            className="bg-white rounded-t-[2rem] md:rounded-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header - Premium */}
                            <div className="sticky top-0 bg-gradient-to-bl from-indigo-600 via-violet-600 to-purple-700 p-6 rounded-t-[2rem] md:rounded-t-3xl">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                                            <MessageSquare size={26} className="text-white" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-xl text-white">درخواست جدید</h3>
                                            <p className="text-sm text-white/70 mt-1">فرم زیر را تکمیل کنید</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                    >
                                        <XCircle size={26} />
                                    </button>
                                </div>

                                {/* Trust Badge */}
                                <div className="flex items-center gap-2 mt-5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10 w-fit">
                                    <Shield size={16} className="text-emerald-300" />
                                    <span className="text-sm text-white/90">اطلاعات شما محفوظ و امن است</span>
                                </div>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={handleCreate} className="p-6 space-y-6">
                                {/* Subject */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2.5">
                                        موضوع درخواست
                                    </label>
                                    <input
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 ring-violet-500/20 focus:border-violet-400 focus:bg-white outline-none transition-all"
                                        value={formData.subject}
                                        onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder="مثال: پیگیری سفارش شماره ۱۲۳۴"
                                    />
                                </div>

                                {/* Department & Priority */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2.5">دپارتمان</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 ring-violet-500/20 focus:border-violet-400 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                            value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                                        >
                                            <option value="support">پشتیبانی فنی</option>
                                            <option value="sales">فروش و مالی</option>
                                            <option value="warranty">گارانتی و خدمات</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2.5">اولویت</label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 ring-violet-500/20 focus:border-violet-400 focus:bg-white outline-none transition-all appearance-none cursor-pointer"
                                            value={formData.priority}
                                            onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                        >
                                            <option value="low">عادی</option>
                                            <option value="medium">مهم</option>
                                            <option value="high">فوری</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2.5">
                                        شرح درخواست
                                    </label>
                                    <textarea
                                        required
                                        rows={5}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 ring-violet-500/20 focus:border-violet-400 focus:bg-white outline-none transition-all resize-none leading-7"
                                        value={formData.message}
                                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                                        placeholder="توضیحات کامل درخواست خود را بنویسید..."
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-gradient-to-r from-violet-500 via-violet-600 to-purple-600 text-white py-4 rounded-xl font-bold hover:from-violet-600 hover:to-purple-700 transition-all shadow-xl shadow-violet-200/50 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            در حال ارسال...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={20} className="rotate-180" />
                                            ارسال درخواست
                                        </>
                                    )}
                                </button>

                                {/* Response Time Info */}
                                <div className="flex items-center justify-center gap-2 pt-2 text-xs text-slate-400">
                                    <Zap size={14} className="text-amber-500" />
                                    <span>معمولاً در کمتر از ۲ ساعت پاسخ داده می‌شود</span>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
