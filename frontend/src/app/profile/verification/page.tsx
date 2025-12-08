"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight, User, Phone, MapPin, CreditCard, Building2, Save,
    Calendar as CalendarIcon, Mail, ShieldCheck, AlertCircle
} from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { authService, User as UserType } from "@/services/authService";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export default function VerificationPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserType | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Bind Mobile State
    const [bindMobileSheetOpen, setBindMobileSheetOpen] = useState(false);
    const [bindMobile, setBindMobile] = useState("");
    const [bindOtp, setBindOtp] = useState(["", "", "", ""]);
    const [bindOtpSent, setBindOtpSent] = useState(false);
    const [bindLoading, setBindLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        nationalCode: "",
        birthDate: "",
        landline: "",
        province: "",
        city: "",
        shebaNumber: "",
        isLegal: false,
        companyName: "",
        companyNationalId: "",
        companyRegistrationId: "",
        companyLandline: "",
        companyProvince: "",
        companyCity: ""
    });

    useEffect(() => {
        const loadUser = async () => {
            try {
                if (!authService.isAuthenticated()) {
                    router.push("/login");
                    return;
                }
                const userData = await authService.getProfile();
                setUser(userData);

                // Initialize form
                setFormData({
                    name: userData.name || "",
                    email: userData.email || "",
                    nationalCode: userData.nationalCode || "",
                    birthDate: userData.birthDate
                        ? (typeof userData.birthDate === 'string'
                            ? userData.birthDate
                            : userData.birthDate.toISOString())
                        : "",
                    landline: userData.landline || "",
                    province: userData.province || "",
                    city: userData.city || "",
                    shebaNumber: userData.shebaNumber || "",
                    isLegal: userData.isLegal || false,
                    companyName: userData.companyName || "",
                    companyNationalId: userData.companyNationalId || "",
                    companyRegistrationId: userData.companyRegistrationId || "",
                    companyLandline: userData.companyLandline || "",
                    companyProvince: userData.companyProvince || "",
                    companyCity: userData.companyCity || ""
                });
            } catch (err: any) {
                setError(err.message || "خطا در دریافت اطلاعات");
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, [router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleDateChange = (date: any) => {
        if (date) {
            // Convert to JS Date and then to ISO string for backend
            // date.toDate() returns a JS Date object
            setFormData(prev => ({
                ...prev,
                birthDate: date.toDate().toISOString()
            }));
        } else {
            setFormData(prev => ({ ...prev, birthDate: "" }));
        }
    };

    // Bind Mobile Handlers
    const handleSendBindOtp = async () => {
        if (!bindMobile || bindMobile.length !== 11 || !bindMobile.startsWith("09")) {
            alert("لطفا شماره موبایل معتبر وارد کنید");
            return;
        }
        try {
            setBindLoading(true);
            await authService.sendBindOtp(bindMobile);
            setBindOtpSent(true);
        } catch (err: any) {
            alert(err.message || "خطا در ارسال کد تایید");
        } finally {
            setBindLoading(false);
        }
    };

    const handleVerifyBindOtp = async () => {
        const code = bindOtp.join("");
        if (code.length !== 4) {
            alert("لطفا کد تایید ۴ رقمی را وارد کنید");
            return;
        }
        try {
            setBindLoading(true);
            const response = await authService.verifyBindOtp(bindMobile, code);
            if (response.success && response.data?.user) {
                setUser(response.data.user);
                setBindMobileSheetOpen(false);
                setSuccess("شماره موبایل با موفقیت ثبت شد");
            }
        } catch (err: any) {
            alert(err.message || "کد تایید نامعتبر است");
        } finally {
            setBindLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;
        const newOtp = [...bindOtp];
        newOtp[index] = value;
        setBindOtp(newOtp);
        if (value && index < 3) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !bindOtp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        // Basic Validation
        if (!formData.name) {
            setError("نام و نام خانوادگی الزامی است");
            setSaving(false);
            return;
        }
        if (formData.nationalCode && !/^\d{10}$/.test(formData.nationalCode)) {
            setError("کد ملی باید ۱۰ رقم باشد");
            setSaving(false);
            return;
        }
        if (formData.shebaNumber && !/^IR\d{24}$/.test(formData.shebaNumber)) {
            setError("شماره شبا باید با IR شروع شده و ۲۶ کاراکتر باشد");
            setSaving(false);
            return;
        }

        try {
            await authService.updateProfile(formData);
            setSuccess("اطلاعات با موفقیت ذخیره شد");
            // Refresh user data
            const updatedUser = await authService.getProfile();
            setUser(updatedUser);
            window.scrollTo(0, 0);
        } catch (err: any) {
            setError(err.message || "خطا در ذخیره اطلاعات");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">در حال بارگذاری...</div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <Link
                    href="/profile"
                    className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors"
                >
                    <ArrowRight size={20} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">اطلاعات حساب کاربری</h1>
            </div>

            <form onSubmit={handleSubmit} className="p-4 max-w-lg mx-auto space-y-6">

                {/* Status Messages */}
                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border border-red-100">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 text-green-600 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border border-green-100">
                        <ShieldCheck size={20} />
                        {success}
                    </div>
                )}

                {/* Legal Person Switch */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800 text-sm">شخص حقوقی</p>
                            <p className="text-xs text-gray-400">ثبت اطلاعات شرکت یا سازمان</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            name="isLegal"
                            checked={formData.isLegal}
                            onChange={handleChange}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* Personal Info */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <User size={18} className="text-vita-500" />
                        اطلاعات شخصی
                    </h2>

                    <div className="space-y-3">
                        <div className="relative">
                            <Input
                                label="نام و نام خانوادگی"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="مثال: علی محمدی"
                                disabled={!!user?.googleId}
                                className={user?.googleId ? "opacity-60 cursor-not-allowed" : ""}
                            />
                            {user?.googleId && (
                                <p className="text-[10px] text-amber-500 mt-1 px-1">نامی که ابتدا اضافه کردید قابل تغییر نیست.</p>
                            )}
                        </div>
                        <Input
                            label="کد ملی"
                            name="nationalCode"
                            value={formData.nationalCode}
                            onChange={handleChange}
                            placeholder="۱۰ رقم بدون خط تیره"
                            maxLength={10}
                            type="tel"
                        />

                        {/* Solar Date Picker */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 pr-1">تاریخ تولد</label>
                            <div className="w-full">
                                <DatePicker
                                    value={formData.birthDate ? new Date(formData.birthDate) : ""}
                                    onChange={handleDateChange}
                                    calendar={persian}
                                    locale={persian_fa}
                                    calendarPosition="bottom-right"
                                    inputClass="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    placeholder="انتخاب تاریخ تولد"
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <Input
                                label="ایمیل"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="example@domain.com"
                                dir="ltr"
                                disabled={!!user?.googleId}
                                className={user?.googleId ? "opacity-60 cursor-not-allowed" : ""}
                            />
                            {user?.googleId && (
                                <p className="text-[10px] text-amber-500 mt-1 px-1">ایمیل حساب گوگل قابل تغییر نیست.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <Phone size={18} className="text-vita-500" />
                        اطلاعات تماس
                    </h2>

                    <div className="space-y-3">
                        {/* Mobile Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 pr-1">شماره موبایل</label>
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={user?.mobile || ""}
                                        disabled
                                        readOnly
                                        className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-sm text-gray-500 cursor-not-allowed outline-none"
                                        dir="ltr"
                                        placeholder="شماره موبایل ثبت نشده"
                                    />
                                </div>
                                {!user?.mobile && (
                                    <button
                                        type="button"
                                        onClick={() => setBindMobileSheetOpen(true)}
                                        className="bg-vita-500 text-white text-xs font-bold px-4 rounded-xl shadow-sm hover:bg-vita-600 transition-colors"
                                    >
                                        افزودن
                                    </button>
                                )}
                            </div>
                            {user?.mobile && (
                                <p className="text-[10px] text-gray-400 mt-1 pr-1">امکان تغییر شماره موبایل وجود ندارد.</p>
                            )}
                        </div>

                        <Input
                            label="تلفن ثابت"
                            name="landline"
                            value={formData.landline}
                            onChange={handleChange}
                            placeholder="به همراه کد شهر"
                            type="tel"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                label="استان"
                                name="province"
                                value={formData.province}
                                onChange={handleChange}
                            />
                            <Input
                                label="شهر"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </div>

                {/* Financial Info */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                        <CreditCard size={18} className="text-vita-500" />
                        اطلاعات مالی
                    </h2>

                    <Input
                        label="شماره شبا"
                        name="shebaNumber"
                        value={formData.shebaNumber}
                        onChange={handleChange}
                        placeholder="IR000000000000000000000000"
                        dir="ltr"
                        className="font-mono text-center tracking-widest"
                    />
                    <p className="text-[10px] text-gray-400 pr-1">جهت بازگشت وجه در صورت لغو سفارش</p>
                </div>

                {/* Legal Info Section */}
                {formData.isLegal && (
                    <div className="bg-blue-50 p-5 rounded-2xl shadow-sm border border-blue-100 space-y-4">
                        <h2 className="font-bold text-blue-800 flex items-center gap-2 text-sm">
                            <Building2 size={18} />
                            اطلاعات حقوقی
                        </h2>

                        <div className="space-y-3">
                            <Input
                                label="نام شرکت / سازمان"
                                name="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                            />
                            <Input
                                label="شناسه ملی"
                                name="companyNationalId"
                                value={formData.companyNationalId}
                                onChange={handleChange}
                                maxLength={11}
                            />
                            <Input
                                label="شماره ثبت"
                                name="companyRegistrationId"
                                value={formData.companyRegistrationId}
                                onChange={handleChange}
                            />
                            <Input
                                label="تلفن ثابت شرکت"
                                name="companyLandline"
                                value={formData.companyLandline}
                                onChange={handleChange}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="استان دفتر مرکزی"
                                    name="companyProvince"
                                    value={formData.companyProvince}
                                    onChange={handleChange}
                                />
                                <Input
                                    label="شهر دفتر مرکزی"
                                    name="companyCity"
                                    value={formData.companyCity}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-vita-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-vita-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <Save size={20} />
                            ثبت و ذخیره اطلاعات
                        </>
                    )}
                </button>
            </form>

            {/* Bind Mobile Sheet */}
            <Sheet open={bindMobileSheetOpen} onOpenChange={setBindMobileSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">افزودن شماره موبایل</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        {!bindOtpSent ? (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={bindMobile}
                                            onChange={(e) => setBindMobile(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-left"
                                            dir="ltr"
                                            placeholder="09xxxxxxxxx"
                                            maxLength={11}
                                        />
                                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2">
                                        یک کد تایید برای احراز هویت به این شماره ارسال خواهد شد.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSendBindOtp}
                                    disabled={bindLoading || !bindMobile}
                                    className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bindLoading ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به شماره {bindMobile} ارسال شد.</p>
                                    <button onClick={() => setBindOtpSent(false)} className="text-xs text-vita-500 font-bold mt-1">ویرایش شماره</button>
                                </div>
                                <div className="flex justify-center gap-3 mb-6" dir="ltr">
                                    {bindOtp.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`otp-${index}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-vita-500 focus:ring-4 focus:ring-vita-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button
                                    onClick={handleVerifyBindOtp}
                                    disabled={bindLoading || bindOtp.some(d => !d)}
                                    className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {bindLoading ? "در حال بررسی..." : "تایید و ثبت شماره"}
                                </button>
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function Input({ label, className, ...props }: any) {
    return (
        <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 pr-1">{label}</label>
            <input
                className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all ${className}`}
                {...props}
            />
        </div>
    );
}
