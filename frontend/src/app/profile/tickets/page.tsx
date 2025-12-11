"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ticketService, Ticket } from "@/services/ticketService";
import {
    Plus,
    MessageSquare,
    Clock,
    CheckCircle,
    XCircle,
    ArrowRight,
    Headphones,
    AlertCircle,
    ChevronLeft,
    Loader2
} from "lucide-react";

export default function TicketsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        subject: "",
        department: "support",
        priority: "medium",
        message: ""
    });
    const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'error' }>({
        show: false,
        title: '',
        message: '',
        type: 'success'
    });

    useEffect(() => {
        loadTickets();
    }, []);

    // Auto-hide toast after 4 seconds
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => {
                setToast(prev => ({ ...prev, show: false }));
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    const showToast = (title: string, message: string, type: 'success' | 'error') => {
        setToast({ show: true, title, message, type });
    };

    const loadTickets = async () => {
        try {
            setLoading(true);
            const data = await ticketService.getAll();
            setTickets(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await ticketService.create(formData);
            showToast("تیکت ثبت شد", "کارشناسان ما به زودی پاسخ می‌دهند.", "success");
            setShowModal(false);
            setFormData({ subject: "", department: "support", priority: "medium", message: "" });
            loadTickets();
        } catch (err) {
            showToast("خطا", "مشکلی در ثبت تیکت پیش آمد.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open':
                return (
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold border border-green-100">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        باز
                    </span>
                );
            case 'closed':
                return (
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-gray-50 to-slate-50 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200">
                        <CheckCircle size={12} />
                        بسته شده
                    </span>
                );
            case 'answered':
                return (
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100">
                        <MessageSquare size={12} />
                        پاسخ داده شده
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-100">
                        <Clock size={12} />
                        در انتظار
                    </span>
                );
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'high':
                return <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">فوری</span>;
            case 'medium':
                return <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">مهم</span>;
            default:
                return <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">عادی</span>;
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

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Toast Notification */}
            {toast.show && (
                <div className={`fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[60] animate-in slide-in-from-top-2 fade-in duration-300`}>
                    <div className={`p-4 rounded-2xl shadow-xl border ${toast.type === 'success'
                            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                            : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200'
                        }`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-full ${toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                                {toast.type === 'success'
                                    ? <CheckCircle size={20} className="text-green-600" />
                                    : <AlertCircle size={20} className="text-red-600" />
                                }
                            </div>
                            <div className="flex-1">
                                <h4 className={`font-bold text-sm ${toast.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                                    {toast.title}
                                </h4>
                                <p className={`text-xs mt-0.5 ${toast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {toast.message}
                                </p>
                            </div>
                            <button
                                onClick={() => setToast(prev => ({ ...prev, show: false }))}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white sticky top-0 z-20 shadow-sm">
                <div className="p-4 flex items-center gap-3 border-b border-gray-100">
                    <Link
                        href="/profile"
                        className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <ArrowRight size={24} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Headphones size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-gray-800">پشتیبانی و تیکت‌ها</h1>
                            <p className="text-xs text-gray-400">ارتباط مستقیم با تیم پشتیبانی</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Button */}
            <div className="p-4">
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
                >
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                        <Plus size={20} />
                    </div>
                    ارسال درخواست جدید
                </button>
            </div>

            {/* Content */}
            <div className="px-4 space-y-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 animate-pulse">
                            <Loader2 size={28} className="text-blue-500 animate-spin" />
                        </div>
                        <p className="text-gray-400 text-sm">در حال بارگذاری تیکت‌ها...</p>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-50 rounded-full flex items-center justify-center">
                            <MessageSquare size={36} className="text-gray-300" />
                        </div>
                        <p className="text-gray-600 font-bold mb-2">هنوز تیکتی ثبت نکرده‌اید</p>
                        <p className="text-gray-400 text-sm">با ارسال تیکت جدید، سوالات خود را با ما در میان بگذارید</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tickets.map(ticket => (
                            <Link
                                key={ticket._id}
                                href={`/profile/tickets/${ticket._id}`}
                                className="block bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 mb-1 truncate group-hover:text-blue-600 transition-colors">
                                            {ticket.subject}
                                        </h3>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded">
                                                {ticket.ticketId || `#${ticket._id.slice(-6).toUpperCase()}`}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {getDepartmentLabel(ticket.department)}
                                            </span>
                                            {getPriorityBadge(ticket.priority)}
                                        </div>
                                    </div>
                                    <ChevronLeft size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                                </div>

                                <div className="flex items-center justify-between">
                                    {getStatusBadge(ticket.status)}
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <Clock size={12} />
                                        {new Date(ticket.updatedAt).toLocaleDateString('fa-IR')}
                                    </div>
                                </div>

                                {/* Messages Preview */}
                                {ticket.messages && ticket.messages.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-50">
                                        <p className="text-xs text-gray-500 line-clamp-1">
                                            {ticket.messages[ticket.messages.length - 1]?.message}
                                        </p>
                                        <span className="text-[10px] text-gray-300 mt-1 block">
                                            {ticket.messages.length} پیام
                                        </span>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* New Ticket Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
                    <div
                        className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white p-5 border-b border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                                    <Plus size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">درخواست جدید</h3>
                                    <p className="text-xs text-gray-400">فرم زیر را تکمیل کنید</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleCreate} className="p-5 space-y-5">
                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    موضوع درخواست
                                </label>
                                <input
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={formData.subject}
                                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                    placeholder="مثلا: پیگیری سفارش شماره ۱۲۳۴"
                                />
                            </div>

                            {/* Department & Priority */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">دپارتمان</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
                                        value={formData.department}
                                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    >
                                        <option value="support">پشتیبانی فنی</option>
                                        <option value="sales">فروش و مالی</option>
                                        <option value="warranty">گارانتی و مرجوعی</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">اولویت</label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
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
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    شرح درخواست
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-sm focus:ring-2 ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="توضیحات کامل درخواست خود را بنویسید..."
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        در حال ارسال...
                                    </>
                                ) : (
                                    <>
                                        <MessageSquare size={20} />
                                        ارسال تیکت
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
