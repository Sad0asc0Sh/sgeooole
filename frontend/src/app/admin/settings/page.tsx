"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Save, Bot, MessageSquare, Zap, AlertCircle, Store, Mail, Phone, MapPin, CheckCircle, ShoppingCart } from "lucide-react";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get("/settings");
            setSettings(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setSaveSuccess(false);
            await api.put("/settings", settings);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error(err);
            alert("خطا در ذخیره تنظیمات");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-vita-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <AlertCircle size={48} className="mb-4 text-red-500" />
                <p>خطا در دریافت تنظیمات</p>
                <button onClick={fetchSettings} className="mt-4 text-vita-600 hover:underline">تلاش مجدد</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Store Information Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                        <Store size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">اطلاعات فروشگاه</h2>
                        <p className="text-sm text-gray-500">تنظیمات عمومی سایت و فروشگاه</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Store Name */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Store size={18} className="text-gray-400" />
                            نام فروشگاه
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                            value={settings.storeName || ''}
                            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                            placeholder="نام فروشگاه خود را وارد کنید"
                        />
                    </div>

                    {/* Store Email */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Mail size={18} className="text-gray-400" />
                            ایمیل فروشگاه
                        </label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                            value={settings.storeEmail || ''}
                            onChange={(e) => setSettings({ ...settings, storeEmail: e.target.value })}
                            placeholder="example@store.com"
                            dir="ltr"
                        />
                    </div>

                    {/* Store Phone */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Phone size={18} className="text-gray-400" />
                            شماره تماس
                        </label>
                        <input
                            type="tel"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                            value={settings.storePhone || ''}
                            onChange={(e) => setSettings({ ...settings, storePhone: e.target.value })}
                            placeholder="021-12345678"
                            dir="ltr"
                        />
                    </div>

                    {/* Store Address */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <MapPin size={18} className="text-gray-400" />
                            آدرس فروشگاه
                        </label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                            value={settings.storeAddress || ''}
                            onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                            placeholder="آدرس کامل فروشگاه"
                        />
                    </div>
                </div>
            </div>

            {/* AI Settings Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600 shadow-sm">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">تنظیمات هوش مصنوعی</h2>
                        <p className="text-sm text-gray-500">مدیریت دستیار هوشمند و محدودیت‌ها</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Enabled Toggle */}
                    <div className="col-span-full flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${settings.aiConfig?.enabled ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <span className="font-bold text-gray-700">فعال‌سازی دستیار هوشمند</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.aiConfig?.enabled || false}
                                onChange={(e) => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, enabled: e.target.checked } })}
                            />
                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:right-[unset] rtl:after:right-[2px] rtl:after:left-[unset] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {/* User Daily Limit */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <MessageSquare size={18} className="text-gray-400" />
                            محدودیت پیام روزانه کاربر
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                value={settings.aiConfig?.userDailyLimit || 20}
                                onChange={(e) => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, userDailyLimit: Number(e.target.value) } })}
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">پیام</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-1">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            تعداد پیام‌هایی که هر کاربر می‌تواند در طول ۲۴ ساعت ارسال کند
                        </p>
                    </div>

                    {/* Max Tokens */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <Zap size={18} className="text-gray-400" />
                            حداکثر توکن پاسخ
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                value={settings.aiConfig?.maxTokens || 500}
                                onChange={(e) => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, maxTokens: Number(e.target.value) } })}
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">Token</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                            حداکثر طول پاسخ هوش مصنوعی (1000 توکن ≈ 750 کلمه)
                        </p>
                    </div>
                </div>
            </div>

            {/* Cart Settings Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 shadow-sm">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">تنظیمات سبد خرید</h2>
                        <p className="text-sm text-gray-500">مدیریت ماندگاری و انقضای سبد خرید</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Cart Persist Toggle */}
                    <div className="col-span-full flex items-center justify-between p-5 bg-gray-50 rounded-2xl border border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${settings.cartConfig?.persistCart !== false ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <div>
                                <span className="font-bold text-gray-700">ماندگاری سبد خرید</span>
                                <p className="text-xs text-gray-400 mt-1">سبد خرید کاربران مهمان در مرورگر ذخیره شود</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.cartConfig?.persistCart !== false}
                                onChange={(e) => setSettings({ ...settings, cartConfig: { ...settings.cartConfig, persistCart: e.target.checked } })}
                            />
                            <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:right-[unset] rtl:after:right-[2px] rtl:after:left-[unset] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    {/* Cart Expiration Days */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            <ShoppingCart size={18} className="text-gray-400" />
                            مدت نگهداری سبد خرید
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                                value={settings.cartConfig?.cartExpirationDays ?? 30}
                                onChange={(e) => setSettings({ ...settings, cartConfig: { ...settings.cartConfig, cartExpirationDays: Number(e.target.value) } })}
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">روز</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-1">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            تعداد روزهایی که سبد خرید در مرورگر باقی می‌ماند (۰ = بی‌نهایت)
                        </p>
                    </div>
                </div>
            </div>

            {/* Info Box */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border border-amber-100">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <AlertCircle size={20} className="text-amber-600" />
                    توجه مهم
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>برای تنظیم <strong>درگاه‌های پرداخت</strong> (ZarinPal و Sadad)، از تب <strong>"درگاه‌های پرداخت"</strong> استفاده کنید</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>تنظیمات هوش مصنوعی تنها در صورت وارد کردن API Key فعال می‌شود</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>اطلاعات فروشگاه در ایمیل‌های سیستمی و فاکتورها استفاده می‌شود</span>
                    </li>
                </ul>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-vita-600 hover:bg-vita-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    <Save size={20} />
                    {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
                </button>

                {saveSuccess && (
                    <div className="flex items-center gap-2 text-green-600 font-bold animate-fade-in">
                        <CheckCircle size={20} />
                        تنظیمات با موفقیت ذخیره شد
                    </div>
                )}
            </div>
        </div>
    );
}
