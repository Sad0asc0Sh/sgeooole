"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    MapPin, Plus, Edit2, Trash2, CheckCircle2, ChevronRight, Home, Phone, User, FileText, Hash, Building2, UserCheck
} from "lucide-react";
import { authService, User as UserType } from "@/services/authService";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Address {
    _id?: string;
    title: string;
    fullName: string;
    mobile: string;
    nationalCode: string;
    province: string;
    city: string;
    address: string;
    plaque: string;
    unit: string;
    postalCode: string;
    isDefault: boolean;
    recipientName?: string;
    recipientPhone?: string;
    recipientNationalCode?: string;
}

export default function AddressesPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserType | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Sheet State
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [submitLoading, setSubmitLoading] = useState(false);

    // Form State
    const [isRecipientMe, setIsRecipientMe] = useState(true);

    // Buyer Info
    const [buyerInfo, setBuyerInfo] = useState({
        firstName: "",
        lastName: "",
        mobile: "",
        nationalCode: ""
    });

    // Address Info
    const [addressInfo, setAddressInfo] = useState({
        title: "",
        province: "",
        city: "",
        address: "",
        plaque: "",
        unit: "",
        postalCode: "",
        isDefault: false
    });

    // Recipient Info
    const [recipientInfo, setRecipientInfo] = useState({
        firstName: "",
        lastName: "",
        mobile: "",
        nationalCode: ""
    });

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            setLoading(true);
            const profileData = await authService.getProfile();
            setUser(profileData);
            // @ts-ignore
            const userAddresses = (profileData.addresses || []).map((addr: any) => ({
                ...addr,
                fullName: addr.fullName, // Buyer Name
                mobile: addr.mobile, // Buyer Mobile
                nationalCode: addr.nationalCode || "", // Buyer National Code
                recipientName: addr.recipientName || addr.fullName, // Fallback for legacy
                recipientPhone: addr.recipientPhone || addr.mobile, // Fallback for legacy
                recipientNationalCode: addr.recipientNationalCode || addr.nationalCode || "",
                plaque: addr.plaque || "",
                unit: addr.unit || ""
            }));
            setAddresses(userAddresses);
            setLoading(false);
        } catch (err: any) {
            console.error("Profile load error:", err);
            setError(err.message || "خطا در دریافت اطلاعات");
            setLoading(false);
        }
    };

    // Helper to split full name
    const splitName = (fullName: string) => {
        if (!fullName) return { firstName: "", lastName: "" };
        const parts = fullName.trim().split(" ");
        if (parts.length === 1) return { firstName: parts[0], lastName: "" };
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        return { firstName, lastName };
    };

    const handleOpenAdd = () => {
        setEditingAddress(null);
        setIsRecipientMe(true);

        const userSplit = splitName(user?.name || "");
        setBuyerInfo({
            firstName: userSplit.firstName,
            lastName: userSplit.lastName,
            mobile: user?.mobile || "",
            nationalCode: ""
        });

        setAddressInfo({
            title: "",
            province: "",
            city: "",
            address: "",
            plaque: "",
            unit: "",
            postalCode: "",
            isDefault: addresses.length === 0
        });

        setRecipientInfo({
            firstName: "",
            lastName: "",
            mobile: "",
            nationalCode: ""
        });

        setSheetOpen(true);
    };

    const handleOpenEdit = (addr: Address) => {
        setEditingAddress(addr);

        // Check if recipient matches buyer (or is undefined/legacy)
        const isMe = (!addr.recipientName || (addr.recipientName === addr.fullName && addr.recipientPhone === addr.mobile));
        setIsRecipientMe(isMe);

        const buyerSplit = splitName(addr.fullName || "");
        setBuyerInfo({
            firstName: buyerSplit.firstName,
            lastName: buyerSplit.lastName,
            mobile: addr.mobile || "",
            nationalCode: addr.nationalCode || ""
        });

        setAddressInfo({
            title: addr.title,
            province: addr.province,
            city: addr.city,
            address: addr.address,
            plaque: addr.plaque,
            unit: addr.unit,
            postalCode: addr.postalCode,
            isDefault: addr.isDefault
        });

        if (!isMe) {
            const recipientSplit = splitName(addr.recipientName || "");
            setRecipientInfo({
                firstName: recipientSplit.firstName,
                lastName: recipientSplit.lastName,
                mobile: addr.recipientPhone || "",
                nationalCode: addr.recipientNationalCode || ""
            });
        } else {
            setRecipientInfo({ firstName: "", lastName: "", mobile: "", nationalCode: "" });
        }

        setSheetOpen(true);
    };

    const handleSubmit = async () => {
        if (!buyerInfo.firstName || !buyerInfo.lastName) {
            alert("لطفا نام و نام خانوادگی خود (خریدار) را وارد کنید");
            return;
        }
        if (!buyerInfo.mobile) {
            alert("شماره موبایل خریدار الزامی است");
            return;
        }
        if (!buyerInfo.nationalCode || buyerInfo.nationalCode.length !== 10) {
            alert("کد ملی خریدار الزامی است و باید ۱۰ رقم باشد");
            return;
        }

        if (!addressInfo.province || !addressInfo.city || !addressInfo.address || !addressInfo.plaque || !addressInfo.postalCode) {
            alert("لطفا اطلاعات آدرس (استان، شهر، آدرس، پلاک، کد پستی) را کامل کنید");
            return;
        }

        const buyerFullName = `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim();

        let finalRecipientName = buyerFullName;
        let finalRecipientPhone = buyerInfo.mobile;
        let finalRecipientNationalCode = buyerInfo.nationalCode;

        if (!isRecipientMe) {
            if (!recipientInfo.firstName || !recipientInfo.lastName) {
                alert("لطفا نام و نام خانوادگی گیرنده را وارد کنید");
                return;
            }
            if (!recipientInfo.mobile) {
                alert("شماره موبایل گیرنده الزامی است");
                return;
            }
            if (!recipientInfo.nationalCode || recipientInfo.nationalCode.length !== 10) {
                alert("کد ملی گیرنده الزامی است و باید ۱۰ رقم باشد");
                return;
            }
            finalRecipientName = `${recipientInfo.firstName} ${recipientInfo.lastName}`.trim();
            finalRecipientPhone = recipientInfo.mobile;
            finalRecipientNationalCode = recipientInfo.nationalCode;
        }

        try {
            setSubmitLoading(true);

            const payload = {
                ...addressInfo,
                fullName: buyerFullName, // Always Buyer Name
                mobile: buyerInfo.mobile, // Always Buyer Mobile
                nationalCode: buyerInfo.nationalCode, // Always Buyer National Code
                recipientName: finalRecipientName,
                recipientPhone: finalRecipientPhone,
                recipientNationalCode: finalRecipientNationalCode,
                phone: finalRecipientPhone // For delivery contact
            };

            let response;
            if (editingAddress && editingAddress._id) {
                response = await authService.updateAddress(editingAddress._id, payload);
            } else {
                response = await authService.addAddress(payload);
            }

            if (response.success) {
                const updatedAddresses = response.data.map((addr: any) => ({
                    ...addr,
                    fullName: addr.fullName,
                    mobile: addr.mobile,
                    nationalCode: addr.nationalCode || "",
                    recipientName: addr.recipientName || addr.fullName,
                    recipientPhone: addr.recipientPhone || addr.mobile,
                    recipientNationalCode: addr.recipientNationalCode || addr.nationalCode || "",
                    plaque: addr.plaque || "",
                    unit: addr.unit || ""
                }));
                setAddresses(updatedAddresses);
                setSheetOpen(false);
            }
        } catch (err: any) {
            alert(err.message || "خطا در ذخیره آدرس");
        } finally {
            setSubmitLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("آیا از حذف این آدرس اطمینان دارید؟")) return;
        try {
            const response = await authService.deleteAddress(id);
            if (response.success) {
                const updatedAddresses = response.data.map((addr: any) => ({
                    ...addr,
                    fullName: addr.fullName,
                    mobile: addr.mobile,
                    nationalCode: addr.nationalCode || "",
                    recipientName: addr.recipientName || addr.fullName,
                    recipientPhone: addr.recipientPhone || addr.mobile,
                    recipientNationalCode: addr.recipientNationalCode || addr.nationalCode || "",
                    plaque: addr.plaque || "",
                    unit: addr.unit || ""
                }));
                setAddresses(updatedAddresses);
            }
        } catch (err: any) {
            alert(err.message || "خطا در حذف آدرس");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
                <Link href="/profile" className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronRight size={24} />
                </Link>
                <h1 className="font-bold text-lg text-gray-800">مدیریت آدرس‌ها</h1>
            </div>

            <div className="p-4 space-y-4">
                {addresses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
                            <MapPin size={32} />
                        </div>
                        <p className="text-gray-500 font-medium mb-6">هنوز آدرسی ثبت نکرده‌اید</p>
                        <button
                            onClick={handleOpenAdd}
                            className="bg-vita-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-vita-200 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Plus size={20} />
                            افزودن آدرس جدید
                        </button>
                    </div>
                ) : (
                    <>
                        {addresses.map((addr) => (
                            <div key={addr._id} className={`bg-white rounded-2xl p-5 border transition-all ${addr.isDefault ? 'border-vita-500 shadow-md shadow-vita-100' : 'border-gray-100 shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-800 text-base">{addr.title}</span>
                                        {addr.isDefault && (
                                            <span className="bg-vita-50 text-vita-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <CheckCircle2 size={10} /> پیش‌فرض
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenEdit(addr)}
                                            className="p-2 text-gray-400 hover:text-vita-600 hover:bg-vita-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => addr._id && handleDelete(addr._id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-gray-500 mb-4">
                                    <div className="flex items-start gap-2">
                                        <MapPin size={16} className="mt-0.5 shrink-0 text-gray-400" />
                                        <p className="leading-relaxed">
                                            {addr.province}، {addr.city}، {addr.address}
                                            {addr.plaque && `، پلاک ${addr.plaque}`}
                                            {addr.unit && `، واحد ${addr.unit}`}
                                            <br />
                                            <span className="text-xs text-gray-400 font-mono mt-1 block">کد پستی: {addr.postalCode}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50">
                                        <div className="flex items-center gap-1.5">
                                            <User size={14} className="text-gray-400" />
                                            <span className="text-xs">{addr.fullName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Phone size={14} className="text-gray-400" />
                                            <span className="text-xs font-mono">{addr.mobile}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={handleOpenAdd}
                            className="w-full bg-white border-2 border-dashed border-gray-300 text-gray-500 font-bold py-4 rounded-2xl hover:border-vita-500 hover:text-vita-600 hover:bg-vita-50 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            افزودن آدرس جدید
                        </button>
                    </>
                )}
            </div>

            {/* Add/Edit Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[2rem] p-0 max-h-[90vh] overflow-y-auto pb-24">
                    <div className="p-6 sticky top-0 bg-white z-10 border-b">
                        <SheetHeader>
                            <SheetTitle className="text-center text-lg font-bold text-gray-800">
                                {editingAddress ? "ویرایش آدرس" : "افزودن آدرس جدید"}
                            </SheetTitle>
                        </SheetHeader>
                    </div>

                    <div className="p-6 space-y-8">

                        {/* 1. Buyer Information */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <UserCheck size={18} className="text-vita-600" />
                                مشخصات شما (خریدار)
                            </h3>
                            <div className="bg-vita-50 p-4 rounded-xl border border-vita-100 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">نام <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={buyerInfo.firstName}
                                            onChange={(e) => setBuyerInfo({ ...buyerInfo, firstName: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">نام خانوادگی <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={buyerInfo.lastName}
                                            onChange={(e) => setBuyerInfo({ ...buyerInfo, lastName: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل <span className="text-red-500">*</span></label>
                                        <input
                                            type="tel"
                                            value={buyerInfo.mobile}
                                            onChange={(e) => setBuyerInfo({ ...buyerInfo, mobile: e.target.value })}
                                            disabled={!!user?.mobile}
                                            className={`w-full border rounded-xl p-3 text-sm outline-none transition-all text-left ${user?.mobile ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-white border-gray-200 focus:border-vita-500 focus:ring-1 focus:ring-vita-500"
                                                }`}
                                            dir="ltr"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">کد ملی <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={buyerInfo.nationalCode}
                                            onChange={(e) => setBuyerInfo({ ...buyerInfo, nationalCode: e.target.value })}
                                            className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-left"
                                            dir="ltr"
                                            maxLength={10}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Address Information */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <MapPin size={18} className="text-vita-600" />
                                مشخصات آدرس
                            </h3>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">عنوان آدرس (مثال: خانه)</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={addressInfo.title}
                                        onChange={(e) => setAddressInfo({ ...addressInfo, title: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                        placeholder="مثال: خانه"
                                    />
                                    <Home size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">استان <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={addressInfo.province}
                                        onChange={(e) => setAddressInfo({ ...addressInfo, province: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">شهر <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={addressInfo.city}
                                        onChange={(e) => setAddressInfo({ ...addressInfo, city: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">آدرس پستی <span className="text-red-500">*</span></label>
                                <textarea
                                    value={addressInfo.address}
                                    onChange={(e) => setAddressInfo({ ...addressInfo, address: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all min-h-[80px]"
                                    placeholder="خیابان، کوچه، ..."
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">پلاک <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={addressInfo.plaque}
                                            onChange={(e) => setAddressInfo({ ...addressInfo, plaque: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-8 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-center"
                                        />
                                        <Hash size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">واحد</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={addressInfo.unit}
                                            onChange={(e) => setAddressInfo({ ...addressInfo, unit: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-8 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-center"
                                        />
                                        <Building2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">کد پستی <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={addressInfo.postalCode}
                                        onChange={(e) => setAddressInfo({ ...addressInfo, postalCode: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-left"
                                        dir="ltr"
                                        maxLength={10}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Recipient Toggle & Info */}
                        <div className="space-y-4 pt-2 border-t border-gray-100">
                            <label className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200 cursor-pointer">
                                <div className="text-sm font-bold text-gray-800 flex items-center gap-2 select-none">
                                    <User size={18} className="text-vita-600" />
                                    گیرنده سفارش خودم هستم
                                </div>
                                <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                    <input
                                        type="checkbox"
                                        checked={isRecipientMe}
                                        onChange={(e) => setIsRecipientMe(e.target.checked)}
                                        className="peer absolute w-0 h-0 opacity-0"
                                    />
                                    <span className="block w-12 h-7 bg-gray-300 rounded-full shadow-inner peer-checked:bg-vita-500 transition-colors duration-300"></span>
                                    <span className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform duration-300"></span>
                                </div>
                            </label>

                            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${!isRecipientMe ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="space-y-4 pt-4">
                                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <User size={18} className="text-vita-600" />
                                        مشخصات گیرنده
                                    </h3>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5">نام <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={recipientInfo.firstName}
                                                    onChange={(e) => setRecipientInfo({ ...recipientInfo, firstName: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5">نام خانوادگی <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={recipientInfo.lastName}
                                                    onChange={(e) => setRecipientInfo({ ...recipientInfo, lastName: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل <span className="text-red-500">*</span></label>
                                                <input
                                                    type="tel"
                                                    value={recipientInfo.mobile}
                                                    onChange={(e) => setRecipientInfo({ ...recipientInfo, mobile: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-left"
                                                    dir="ltr"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1.5">کد ملی <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={recipientInfo.nationalCode}
                                                    onChange={(e) => setRecipientInfo({ ...recipientInfo, nationalCode: e.target.value })}
                                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-vita-500 focus:ring-1 focus:ring-vita-500 outline-none transition-all text-left"
                                                    dir="ltr"
                                                    maxLength={10}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="isDefault"
                                checked={addressInfo.isDefault}
                                onChange={(e) => setAddressInfo({ ...addressInfo, isDefault: e.target.checked })}
                                className="w-5 h-5 rounded border-gray-300 text-vita-600 focus:ring-vita-500"
                            />
                            <label htmlFor="isDefault" className="text-sm text-gray-700 font-medium">تنظیم به عنوان آدرس پیش‌فرض</label>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={submitLoading}
                            className="w-full bg-vita-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-vita-200 mt-4 active:scale-95 transition-all"
                        >
                            {submitLoading ? "در حال ذخیره..." : "ثبت آدرس"}
                        </button>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
