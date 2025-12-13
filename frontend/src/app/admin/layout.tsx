"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Bell,
    Search,
    MessageSquare,
    FileText
} from "lucide-react";
import { authService } from "@/services/authService";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [admin, setAdmin] = useState<any>(null);

    useEffect(() => {
        const checkAdmin = async () => {
            if (!authService.isAuthenticated()) {
                router.push("/login");
                return;
            }

            try {
                const profile = await authService.getProfile();
                if (profile.role !== 'admin' && profile.role !== 'manager' && profile.role !== 'superadmin') {
                    router.push("/");
                    return;
                }
                setAdmin(profile);
                setLoading(false);
            } catch (err) {
                router.push("/login");
            }
        };
        checkAdmin();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin w-10 h-10 border-4 border-vita-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const menuItems = [
        { icon: LayoutDashboard, label: "داشبورد", href: "/admin" },
        { icon: ShoppingBag, label: "سفارشات", href: "/admin/orders" },
        { icon: MessageSquare, label: "نظرات", href: "/admin/reviews" },
        { icon: FileText, label: "صفحات", href: "/admin/pages" },
        { icon: Users, label: "کاربران", href: "/admin/users" },
        { icon: Settings, label: "تنظیمات", href: "/admin/settings" },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex" dir="rtl">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? "translate-x-0" : "translate-x-full"
                    }`}
            >
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <h1 className="text-2xl font-black text-gray-800">
                            <span className="text-vita-600">Welf</span>Admin
                        </h1>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Menu */}
                    <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive
                                        ? "bg-vita-50 text-vita-600 font-bold shadow-sm"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                        }`}
                                >
                                    <Icon size={20} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 border-t border-gray-100">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                                {admin.name?.charAt(0) || "A"}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{admin.name}</p>
                                <p className="text-xs text-gray-500 truncate">{admin.role}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => authService.logout()}
                            className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors text-sm font-bold"
                        >
                            <LogOut size={18} />
                            خروج
                        </button>
                    </div>
                </div>
            </aside>

            {/* Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex-1 max-w-md mx-4 hidden md:block">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="جستجو..."
                                className="w-full bg-gray-100 border-none rounded-lg py-2 pr-10 pl-4 text-sm focus:ring-2 focus:ring-vita-500"
                            />
                            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
