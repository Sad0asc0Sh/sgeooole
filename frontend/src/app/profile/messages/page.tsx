"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Bell, Check, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

interface Notification {
    _id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    isRead: boolean;
    createdAt: string;
}

export default function MessagesPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            console.log('Fetching notifications...');
            const res = await api.get('/notifications');
            console.log('Notifications response:', res.data);
            if (res.data.success) {
                setNotifications(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.put(`/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => n._id === id ? { ...n, isRead: true } : n)
            );
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <CheckCircle className="text-green-500" size={24} />;
            case 'warning': return <AlertTriangle className="text-orange-500" size={24} />;
            case 'error': return <XCircle className="text-red-500" size={24} />;
            default: return <Info className="text-blue-500" size={24} />;
        }
    };

    const getBgColor = (type: string) => {
        switch (type) {
            case 'success': return 'bg-green-50';
            case 'warning': return 'bg-orange-50';
            case 'error': return 'bg-red-50';
            default: return 'bg-blue-50';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            <div className="bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10 md:static">
                <Link
                    href="/profile"
                    className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
                >
                    <ArrowRight size={20} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">پیغام‌ها</h1>
            </div>

            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">در حال بارگذاری...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                            <Bell size={32} className="text-gray-300" />
                        </div>
                        <p className="text-gray-400 text-sm mb-2">پیغامی برای نمایش وجود ندارد</p>
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div
                            key={notification._id}
                            className={`p-4 rounded-xl border ${notification.isRead ? 'bg-white border-gray-100' : 'bg-white border-blue-100 shadow-sm'}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full ${getBgColor(notification.type)}`}>
                                    {getIcon(notification.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className={`font-bold mb-1 ${notification.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                                            {notification.title}
                                        </h3>
                                        {!notification.isRead && (
                                            <button
                                                onClick={() => markAsRead(notification._id)}
                                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                            >
                                                <Check size={14} />
                                                خواندم
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-gray-600 text-sm leading-relaxed mb-2">
                                        {notification.message}
                                    </p>
                                    <span className="text-xs text-gray-400">
                                        {new Date(notification.createdAt).toLocaleDateString('fa-IR')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
