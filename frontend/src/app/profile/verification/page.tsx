"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowRight, User, Phone, CreditCard, Building2, Save,
    CheckCircle2, XCircle, Landmark, MapPin, Edit2, Plus, AlertCircle, ShieldCheck
} from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { authService, User as UserType } from "@/services/authService";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getBankFromSheba } from "@/utils/bankUtils";

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

    // Change Email State
    const [emailOtpSheetOpen, setEmailOtpSheetOpen] = useState(false);
    const [emailToVerify, setEmailToVerify] = useState("");
    const [emailOtp, setEmailOtp] = useState(["", "", "", ""]);
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [emailVerifying, setEmailVerifying] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        surname: "",
        gender: "",
        nationalCode: "",
        birthDate: "",
        birthPlace: "",
        landline: "",
        secondMobile: "",
        email: "",
        shebaNumber: "",
        bankName: "", // Derived/Readonly
        isLegal: false,
        companyName: "",
        companyNationalId: "",
        companyRegistrationId: "",
        companyLandline: "",
        companyProvince: "",
        companyCity: ""
    });

    // Bank Detection State
    const [detectedBank, setDetectedBank] = useState<any>(null);

    // Address State
    const [primaryAddress, setPrimaryAddress] = useState<any>(null);

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
                let fullName = userData.name || "";

                // Smart Sync: If profile name is incomplete but address has a full name, use address name
                // This fixes the issue where user updates name in Address section but Profile section shows old/partial data
                if (userData.addresses && userData.addresses.length > 0) {
                    const defaultAddr = userData.addresses.find((a: any) => a.isDefault) || userData.addresses[0];
                    // If address name is significantly longer (likely contains surname), use it
                    const addressName = defaultAddr?.fullName || defaultAddr?.recipientName;
                    if (addressName && addressName.trim().length > fullName.trim().length) {
                        fullName = addressName;
                    }
                    setPrimaryAddress(defaultAddr);
                }

                const nameParts = fullName.split(" ");
                const firstName = nameParts[0] || "";
                const lastName = nameParts.slice(1).join(" ") || "";

                setFormData({
                    name: firstName,
                    surname: lastName,
                    gender: userData.gender || "",
                    nationalCode: userData.nationalCode || "",
                    birthDate: userData.birthDate
                        ? (typeof userData.birthDate === 'string'
                            ? userData.birthDate
                            : userData.birthDate.toISOString())
                        : "",
                    birthPlace: userData.birthPlace || "",
                    landline: userData.landline || "",
                    secondMobile: userData.secondMobile || "",
                    email: userData.email || "",
                    shebaNumber: userData.shebaNumber || "",
                    bankName: "",
                    isLegal: userData.isLegal || false,
                    companyName: userData.companyName || "",
                    companyNationalId: userData.companyNationalId || "",
                    companyRegistrationId: userData.companyRegistrationId || "",
                    companyLandline: userData.companyLandline || "",
                    companyProvince: userData.companyProvince || "",
                    companyCity: userData.companyCity || ""
                });

                if (userData.shebaNumber) {
                    const bank = getBankFromSheba(userData.shebaNumber);
                    setDetectedBank(bank);
                }

            } catch (err: any) {
                setError(err.message || "خطا در دریافت اطلاعات");
            } finally {
                setLoading(false);
            }
        };
        loadUser();
    }, [router]);

    // Detect Bank on Sheba Change
    useEffect(() => {
        const bank = getBankFromSheba(formData.shebaNumber);
        setDetectedBank(bank);
        setFormData(prev => ({ ...prev, bankName: bank ? bank.name : "" }));
    }, [formData.shebaNumber]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleDateChange = (date: any) => {
        if (date) {
            setFormData(prev => ({
                ...prev,
                birthDate: date.toDate().toISOString()
            }));
        } else {
            setFormData(prev => ({ ...prev, birthDate: "" }));
        }
    };

    // Calculate Profile Completion
    const completionPercentage = useMemo(() => {
        const fields = [
            formData.name,
            formData.surname,
            formData.nationalCode,
            formData.birthDate,
            formData.email,
            formData.landline,
            formData.shebaNumber,
            primaryAddress // Count address as a field
        ];
        const filled = fields.filter(f => f && (typeof f === 'object' ? Object.keys(f).length > 0 : f.toString().length > 0)).length;
        return Math.round((filled / fields.length) * 100);
    }, [formData, primaryAddress]);

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
            if (response.success) {
                const updatedUser = await authService.getProfile();
                setUser(updatedUser);
                setBindMobileSheetOpen(false);
                setBindOtpSent(false);
                setBindOtp(["", "", "", ""]);
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

    // Email OTP Handlers
    const startEmailVerification = async (email: string) => {
        const normalizedEmail = email.trim().toLowerCase();

        if (user?.googleId) {
            alert("کاربران گوگل امکان تغییر ایمیل را ندارند");
            return;
        }

        if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
            alert("لطفا ایمیل معتبر وارد کنید");
            return;
        }

        try {
            setEmailSending(true);
            setEmailToVerify(normalizedEmail);
            setEmailOtp(["", "", "", ""]);
            setEmailOtpSent(false);
            setEmailOtpSheetOpen(true);
            await authService.sendEmailOtp(normalizedEmail);
            setEmailOtpSent(true);
        } catch (err: any) {
            alert(err.message || "خطا در ارسال کد تایید");
        } finally {
            setEmailSending(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        const code = emailOtp.join("");
        if (code.length !== 4) {
            alert("لطفا کد تایید ۴ رقمی را وارد کنید");
            return;
        }
        try {
            setEmailVerifying(true);
            const response = await authService.verifyEmailOtp(emailToVerify, code);
            if (response.success) {
                const updatedUser = await authService.getProfile();
                setUser(updatedUser);
                setEmailOtpSheetOpen(false);
                setEmailOtpSent(false);
                setEmailOtp(["", "", "", ""]);
                setSuccess("ایمیل با موفقیت ثبت شد");
            }
        } catch (err: any) {
            alert(err.message || "کد تایید نامعتبر است");
        } finally {
            setEmailVerifying(false);
        }
    };

    const handleEmailOtpChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;
        const newOtp = [...emailOtp];
        newOtp[index] = value;
        setEmailOtp(newOtp);
        if (value && index < 3) {
            const nextInput = document.getElementById(`email-otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(null);

        const combinedName = `${formData.name} ${formData.surname}`.trim();
        const nextEmail = formData.email.trim().toLowerCase();
        const currentEmail = (user?.email || "").trim().toLowerCase();
        const shouldVerifyEmail = !!nextEmail && nextEmail !== currentEmail && !user?.googleId;

        try {
            // 1. Update Profile
            await authService.updateProfile({
                name: combinedName,
                gender: formData.gender as UserType["gender"],
                nationalCode: formData.nationalCode,
                birthDate: formData.birthDate,
                birthPlace: formData.birthPlace,
                landline: formData.landline,
                secondMobile: formData.secondMobile,
                shebaNumber: formData.shebaNumber,
                isLegal: formData.isLegal,
                companyName: formData.companyName,
                companyNationalId: formData.companyNationalId,
                companyRegistrationId: formData.companyRegistrationId,
                companyLandline: formData.companyLandline,
                companyProvince: formData.companyProvince,
                companyCity: formData.companyCity,
            });

            // 2. Sync to Address (if exists)
            if (primaryAddress && primaryAddress._id) {
                // If name changed, update the primary address too
                if (primaryAddress.fullName !== combinedName) {
                    try {
                        await authService.updateAddress(primaryAddress._id, {
                            ...primaryAddress,
                            fullName: combinedName,
                            // Only update recipient if it was same as buyer (or empty)
                            recipientName: (primaryAddress.recipientName === primaryAddress.fullName || !primaryAddress.recipientName)
                                ? combinedName
                                : primaryAddress.recipientName
                        });
                    } catch (addrErr) {
                        console.error("Failed to sync address name:", addrErr);
                        // Don't fail the whole operation if address sync fails
                    }
                }
            }

            if (shouldVerifyEmail) {
                setSuccess("اطلاعات ذخیره شد. برای ثبت ایمیل، کد تایید را وارد کنید.");
                await startEmailVerification(nextEmail);
            } else {
                setSuccess("اطلاعات با موفقیت ذخیره شد");
            }

            // Reload user to get fresh state
            const updatedUser = await authService.getProfile();
            setUser(updatedUser);

            // Re-evaluate primary address from fresh data
            if (updatedUser.addresses && updatedUser.addresses.length > 0) {
                const defaultAddr = updatedUser.addresses.find((a: any) => a.isDefault) || updatedUser.addresses[0];
                setPrimaryAddress(defaultAddr);
            }

            window.scrollTo(0, 0);
        } catch (err: any) {
            setError(err.message || "خطا در ذخیره اطلاعات");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-kala-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
            {/* Mobile Header */}
            <div className="lg:hidden bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
                <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200 transition-colors">
                    <ArrowRight size={20} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">اطلاعات حساب کاربری</h1>
            </div>

            <div className="lg:max-w-7xl lg:mx-auto lg:px-6 lg:pt-8">
                <div className="lg:grid lg:grid-cols-12 lg:gap-8">

                    {/* ============================================ */}
                    {/* LEFT SIDEBAR (Desktop Only) */}
                    {/* ============================================ */}
                    <aside className="hidden lg:block lg:col-span-4 space-y-6">
                        {/* Profile Card */}
                        <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-5 -mb-5 blur-xl"></div>

                            <div className="relative z-10 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-white/20 p-1 backdrop-blur-sm">
                                    <div className="w-full h-full rounded-full bg-white overflow-hidden">
                                        {user?.avatar ? (
                                            <img src={user.avatar} alt={user.name || "User"} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                                                <User size={24} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg">{user?.name || "کاربر مهمان"}</h2>
                                    <p className="text-white/80 font-mono text-sm mt-1">{user?.mobile}</p>
                                </div>
                            </div>
                        </div>

                        {/* Completion Chart */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                            <div className="relative w-32 h-32 mb-4">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle cx="64" cy="64" r="56" stroke="#f3f4f6" strokeWidth="8" fill="none" />
                                    <circle
                                        cx="64" cy="64" r="56"
                                        stroke="#8b5cf6"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeDasharray="351.86"
                                        strokeDashoffset={351.86 - (351.86 * completionPercentage) / 100}
                                        className="transition-all duration-1000 ease-out"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-3xl font-black text-gray-800">{completionPercentage}%</span>
                                </div>
                            </div>
                            <h3 className="font-bold text-gray-800">تکمیل پروفایل</h3>
                        </div>

                        {/* Verification Status */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-700">ایمیل تایید شد</span>
                                {user?.email && user.email.trim().toLowerCase() === formData.email.trim().toLowerCase()
                                    ? <CheckCircle2 className="text-green-500" size={20} />
                                    : <XCircle className="text-gray-300" size={20} />}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-700">موبایل تایید شد</span>
                                {user?.mobile ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-gray-300" size={20} />}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-700">هویت تایید شد</span>
                                {user?.nationalCode ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-gray-300" size={20} />}
                            </div>
                        </div>
                    </aside>

                    {/* ============================================ */}
                    {/* MAIN CONTENT FORM */}
                    {/* ============================================ */}
                    <main className="lg:col-span-8">
                        <form onSubmit={handleSubmit} className="space-y-6 p-4 lg:p-0">

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

                            {/* Account Type Switch */}
                            <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Building2 size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 text-base">نوع حساب</p>
                                        <p className="text-xs text-gray-400 mt-1">شخص حقیقی یا حقوقی</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm font-bold ${!formData.isLegal ? 'text-blue-600' : 'text-gray-400'}`}>شخص حقیقی</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="isLegal"
                                            checked={formData.isLegal}
                                            onChange={handleChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                    <span className={`text-sm font-bold ${formData.isLegal ? 'text-blue-600' : 'text-gray-400'}`}>شخص حقوقی</span>
                                </div>
                            </div>

                            {/* Legal Entity Info - Only shown when isLegal is true */}
                            {formData.isLegal && (
                                <div className="bg-white p-5 lg:p-8 rounded-2xl shadow-sm border border-blue-100 ring-2 ring-blue-50">
                                    <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg mb-6">
                                        <Building2 className="text-blue-600" />
                                        اطلاعات شرکت / سازمان
                                    </h2>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <Input
                                            label="نام شرکت / سازمان"
                                            name="companyName"
                                            value={formData.companyName}
                                            onChange={handleChange}
                                            placeholder="نام رسمی شرکت"
                                        />
                                        <Input
                                            label="شناسه ملی شرکت"
                                            name="companyNationalId"
                                            value={formData.companyNationalId}
                                            onChange={handleChange}
                                            placeholder="۱۱ رقم"
                                            maxLength={11}
                                        />
                                        <Input
                                            label="شماره ثبت شرکت"
                                            name="companyRegistrationId"
                                            value={formData.companyRegistrationId}
                                            onChange={handleChange}
                                            placeholder="شماره ثبت"
                                        />
                                        <Input
                                            label="تلفن ثابت شرکت"
                                            name="companyLandline"
                                            value={formData.companyLandline}
                                            onChange={handleChange}
                                            placeholder="با پیش‌شماره"
                                        />
                                        <Input
                                            label="استان"
                                            name="companyProvince"
                                            value={formData.companyProvince}
                                            onChange={handleChange}
                                            placeholder="استان محل ثبت"
                                        />
                                        <Input
                                            label="شهر"
                                            name="companyCity"
                                            value={formData.companyCity}
                                            onChange={handleChange}
                                            placeholder="شهر محل ثبت"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Personal Info */}
                            <div className="bg-white p-5 lg:p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg mb-6">
                                    <User className="text-purple-600" />
                                    اطلاعات شخصی
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <Input label="نام" name="name" value={formData.name} onChange={handleChange} placeholder="نام خود را وارد کنید" />
                                    <Input label="نام خانوادگی" name="surname" value={formData.surname} onChange={handleChange} placeholder="نام خانوادگی" />
                                    <Input label="کد ملی" name="nationalCode" value={formData.nationalCode} onChange={handleChange} maxLength={10} placeholder="۱۰ رقم بدون خط تیره" />

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">جنسیت</label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                        >
                                            <option value="">انتخاب کنید</option>
                                            <option value="male">مرد</option>
                                            <option value="female">زن</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">موبایل تایید شده</label>
                                        <div className="relative">
                                            <input
                                                value={user?.mobile || ""}
                                                disabled
                                                className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-sm text-gray-500 cursor-not-allowed"
                                            />
                                            {user?.mobile && <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500" size={16} />}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2">تاریخ تولد</label>
                                        <DatePicker
                                            value={formData.birthDate ? new Date(formData.birthDate) : ""}
                                            onChange={handleDateChange}
                                            calendar={persian}
                                            locale={persian_fa}
                                            calendarPosition="bottom-right"
                                            inputClass="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                                            placeholder="انتخاب تاریخ"
                                        />
                                    </div>

                                    <Input label="محل تولد" name="birthPlace" value={formData.birthPlace} onChange={handleChange} placeholder="شهر محل تولد" />
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div className="bg-white p-5 lg:p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg mb-6">
                                    <Phone className="text-green-600" />
                                    اطلاعات تماس
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <Input
                                        label="ایمیل"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        dir="ltr"
                                        placeholder="example@mail.com"
                                        disabled={!!user?.googleId}
                                        className={user?.googleId ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                                    />
                                    <Input label="تلفن ثابت" name="landline" value={formData.landline} onChange={handleChange} placeholder="با پیش‌شماره" />
                                    <Input label="شماره موبایل دوم" name="secondMobile" value={formData.secondMobile} onChange={handleChange} placeholder="اختیاری" />

                                    {/* Address Section - Integrated */}
                                    <div className="lg:col-span-3 mt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="block text-xs font-bold text-gray-500">آدرس ثبت شده</label>
                                            <Link href="/profile/addresses" className="text-xs text-kala-600 font-bold hover:underline flex items-center gap-1">
                                                <Edit2 size={14} />
                                                مدیریت آدرس‌ها
                                            </Link>
                                        </div>

                                        {primaryAddress ? (
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-start gap-3">
                                                <MapPin className="text-gray-400 shrink-0 mt-1" size={20} />
                                                <div>
                                                    <p className="text-sm text-gray-800 font-medium leading-relaxed">
                                                        {primaryAddress.province}، {primaryAddress.city}، {primaryAddress.address}
                                                        {primaryAddress.plaque && `، پلاک ${primaryAddress.plaque}`}
                                                        {primaryAddress.unit && `، واحد ${primaryAddress.unit}`}
                                                    </p>
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                        <span>کد پستی: {primaryAddress.postalCode}</span>
                                                        <span>گیرنده: {primaryAddress.recipientName || primaryAddress.fullName || user?.name || `${formData.name} ${formData.surname}`.trim() || "—"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center">
                                                <MapPin className="text-gray-300 mb-2" size={32} />
                                                <p className="text-sm text-gray-500 mb-3">هنوز آدرسی ثبت نکرده‌اید</p>
                                                <Link
                                                    href="/profile/addresses"
                                                    className="text-xs bg-white border border-gray-300 text-gray-700 font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                                                >
                                                    <Plus size={14} />
                                                    افزودن آدرس جدید
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Financial Info */}
                            <div className="bg-white p-5 lg:p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2 text-lg mb-6">
                                    <CreditCard className="text-orange-500" />
                                    اطلاعات مالی
                                </h2>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <Input
                                        label="شماره شبا"
                                        name="shebaNumber"
                                        value={formData.shebaNumber}
                                        onChange={handleChange}
                                        dir="ltr"
                                        placeholder="IR000000000000000000000000"
                                        className="font-mono tracking-widest text-center"
                                    />
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-500 mb-2">نام بانک</label>
                                        <div className="relative">
                                            <input
                                                value={formData.bankName || "نامشخص"}
                                                disabled
                                                className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 font-bold cursor-not-allowed"
                                            />
                                            {detectedBank && (
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-500">{detectedBank.name}</span>
                                                    <Landmark size={18} style={{ color: detectedBank.color }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
                            >
                                {saving ? (
                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <Save size={20} />
                                        ذخیره اطلاعات
                                    </>
                                )}
                            </button>
                        </form>
                    </main>
                </div>
            </div>

            {/* Bind Mobile Sheet (Mobile Only) */}
            <Sheet open={bindMobileSheetOpen} onOpenChange={setBindMobileSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">افزودن شماره موبایل</SheetTitle>
                    </SheetHeader>
                    {/* ... (Keep existing bind mobile logic) ... */}
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
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-kala-500 focus:ring-1 focus:ring-kala-500 outline-none transition-all text-left"
                                            dir="ltr"
                                            placeholder="09xxxxxxxxx"
                                            maxLength={11}
                                        />
                                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>
                                <button onClick={handleSendBindOtp} disabled={bindLoading || !bindMobile} className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4">
                                    {bindLoading ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به شماره {bindMobile} ارسال شد.</p>
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
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-kala-500 focus:ring-4 focus:ring-kala-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button onClick={handleVerifyBindOtp} disabled={bindLoading} className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4">
                                    {bindLoading ? "در حال بررسی..." : "تایید و ثبت شماره"}
                                </button>
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Email OTP Sheet */}
            <Sheet
                open={emailOtpSheetOpen}
                onOpenChange={(open) => {
                    setEmailOtpSheetOpen(open);
                    if (!open) {
                        setEmailOtpSent(false);
                        setEmailOtp(["", "", "", ""]);
                        setEmailToVerify("");
                    }
                }}
            >
                <SheetContent side="bottom" className="rounded-t-[2rem] p-6 pb-24">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-center text-lg font-bold text-gray-800">تایید ایمیل</SheetTitle>
                    </SheetHeader>

                    <div className="space-y-4">
                        {!emailOtpSent ? (
                            <>
                                <div className="text-center">
                                    <p className="text-sm text-gray-600">برای تایید ایمیل، کد را ارسال کنید.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">ایمیل</label>
                                    <input
                                        type="email"
                                        value={emailToVerify || formData.email}
                                        disabled
                                        dir="ltr"
                                        className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-sm text-gray-500 cursor-not-allowed text-left"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => startEmailVerification(emailToVerify || formData.email)}
                                    disabled={emailSending || !(emailToVerify || formData.email)}
                                    className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4"
                                >
                                    {emailSending ? "در حال ارسال..." : "ارسال کد تایید"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-600">کد تایید به ایمیل {emailToVerify} ارسال شد.</p>
                                </div>
                                <div className="flex justify-center gap-3 mb-6" dir="ltr">
                                    {emailOtp.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`email-otp-${index}`}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleEmailOtpChange(index, e.target.value)}
                                            className="w-12 h-12 border-2 border-gray-200 rounded-xl text-center text-xl font-bold focus:border-kala-500 focus:ring-4 focus:ring-kala-100 outline-none transition-all"
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleVerifyEmailOtp}
                                    disabled={emailVerifying}
                                    className="w-full bg-kala-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-kala-200 mt-4"
                                >
                                    {emailVerifying ? "در حال بررسی..." : "تایید و ثبت ایمیل"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => startEmailVerification(emailToVerify)}
                                    disabled={emailSending}
                                    className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3.5 rounded-xl mt-3"
                                >
                                    {emailSending ? "در حال ارسال..." : "ارسال مجدد کد"}
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
            <label className="block text-xs font-bold text-gray-500 mb-2">{label}</label>
            <input
                className={`w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all ${className}`}
                {...props}
            />
        </div>
    );
}
