"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Box, Clock, CheckCircle2, XCircle, Truck, AlertCircle, ChevronLeft, Search, Filter } from "lucide-react";
import { authService } from "@/services/authService";

interface Order {
    _id: string;
    user: { name: string; email: string };
    orderStatus: string;
    totalPrice: number;
    createdAt: string;
    isPaid: boolean;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            setLoading(true);
            // Note: We need an admin endpoint for all orders. 
            // Assuming authService.getAllOrders() exists or using a similar endpoint.
            // If not, we might need to add it to authService.
            const response = await authService.getAllOrders();
            if (response.success) {
                setOrders(response.data);
            }
            setLoading(false);
        } catch (err) {
            console.error("Error loading orders:", err);
            setLoading(false);
        }
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'Pending': return { label: 'در انتظار پرداخت', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: Clock };
            case 'Processing': return { label: 'درحال پردازش', color: 'text-blue-600', bg: 'bg-blue-50', icon: Box };
            case 'Shipped': return { label: 'تحویل به پست', color: 'text-purple-600', bg: 'bg-purple-50', icon: Truck };
            case 'Delivered': return { label: 'تحویل شده', color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 };
            case 'Cancelled': return { label: 'لغو شده', color: 'text-red-600', bg: 'bg-red-50', icon: XCircle };
            default: return { label: status, color: 'text-gray-600', bg: 'bg-gray-50', icon: AlertCircle };
        }
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order._id.includes(search) || order.user?.name?.includes(search);
        const matchesStatus = statusFilter ? order.orderStatus === statusFilter : true;
        return matchesSearch && matchesStatus;
    });

    if (loading) return <div className="p-8 text-center text-gray-500">در حال بارگذاری...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-800">مدیریت سفارشات</h1>

                <div className="flex gap-2">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="جستجو..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-white border border-gray-200 rounded-xl py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-vita-500 w-64"
                        />
                        <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-vita-500 outline-none"
                    >
                        <option value="">همه وضعیت‌ها</option>
                        <option value="Pending">ثبت سفارش</option>
                        <option value="Processing">درحال پردازش</option>
                        <option value="Shipped">تحویل به پست</option>
                        <option value="Delivered">تحویل شده</option>
                        <option value="Cancelled">لغو شده</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs font-bold">
                            <tr>
                                <th className="px-6 py-4">کد سفارش</th>
                                <th className="px-6 py-4">کاربر</th>
                                <th className="px-6 py-4">تاریخ</th>
                                <th className="px-6 py-4">مبلغ کل</th>
                                <th className="px-6 py-4">وضعیت</th>
                                <th className="px-6 py-4">عملیات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredOrders.map((order) => {
                                const status = getStatusInfo(order.orderStatus);
                                return (
                                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm text-gray-600">
                                            {order._id.slice(-6).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-bold text-gray-800">{order.user?.name || "کاربر حذف شده"}</div>
                                            <div className="text-xs text-gray-400 font-mono">{order.user?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {new Date(order.createdAt).toLocaleDateString('fa-IR')}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-800">
                                            {order.totalPrice.toLocaleString('fa-IR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.bg} ${status.color}`}>
                                                <status.icon size={12} />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link
                                                href={`/admin/orders/${order._id}`}
                                                className="text-vita-600 hover:bg-vita-50 p-2 rounded-lg transition-colors inline-block"
                                            >
                                                <ChevronLeft size={20} />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredOrders.length === 0 && (
                    <div className="p-8 text-center text-gray-500">سفارشی یافت نشد</div>
                )}
            </div>
        </div>
    );
}
