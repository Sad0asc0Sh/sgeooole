"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, CreditCard, Package, AlertCircle, Loader2, Plus, Check, Edit2, Home, Phone, User, Trash2, CheckCircle2, FileText, Hash, Building2, UserCheck, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/hooks/useCart";
import { orderService, CreateOrderRequest, OrderItem, ShippingAddress } from "@/services/orderService";
import { authService, User as UserType } from "@/services/authService";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import api from "@/lib/api";

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

export default function CheckoutPage() {
    const router = useRouter();
    const { cartItems, totalPrice, totalOriginalPrice, totalProfit, isEmpty } = useCart();

    // Coupon State
    const [discount, setDiscount] = useState(0);
    const [couponCode, setCouponCode] = useState("");

    // User & Address State
    const [user, setUser] = useState<UserType | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [loadingAddresses, setLoadingAddresses] = useState(true);

    // Payment Method
    const [paymentMethod, setPaymentMethod] = useState<"online" | "cod">("online");

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
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

    // Shipping State
    const [shippingMethods, setShippingMethods] = useState<any[]>([]);
    const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string | null>(null);
    const [loadingShipping, setLoadingShipping] = useState(true);

    // Active Gateway State
    const [availableGateways, setAvailableGateways] = useState<any[]>([]);
    const [selectedGateway, setSelectedGateway] = useState<string>("");

    // Pricing Calculations
    const selectedMethod = shippingMethods.find(m => m._id === selectedShippingMethodId);
    const shippingPrice = selectedMethod ? selectedMethod.cost : 0;
    const taxPrice = 0;
    const finalTotalPrice = Math.max(0, totalPrice + shippingPrice + taxPrice - discount);
    const totalSavings = (totalProfit || 0) + discount;

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                console.log("Fetching public settings...");
                const res = await api.get('/settings/public');
                console.log("Settings response:", res.data);

                if (res.data.success) {
                    const config = res.data.data.paymentConfig;
                    const defaultGateway = config?.activeGateway || 'zarinpal';

                    // Build list of available gateways
                    const gateways = [];

                    if (config?.zarinpal?.isActive) {
                        gateways.push({ id: 'zarinpal', name: 'زرین‌پال', icon: '⚡' });
                    }

                    if (config?.sadad?.isActive) {
                        gateways.push({ id: 'sadad', name: 'سداد (ملی)', icon: '🏦' });
                    }

                    setAvailableGateways(gateways);

                    // Set default selection
                    if (gateways.some(g => g.id === defaultGateway)) {
                        setSelectedGateway(defaultGateway);
                    } else if (gateways.length > 0) {
                        setSelectedGateway(gateways[0].id);
                    }
                }
            } catch (err) {
                console.error("Error fetching settings:", err);
            }
        };
        fetchSettings();
    }, []);

    // Load addresses, shipping methods, and coupon on mount
    useEffect(() => {
        loadUserData();
        loadShippingMethods();
        loadAppliedCoupon();
    }, []);

    const loadAppliedCoupon = async () => {
        const code = localStorage.getItem("appliedCoupon");
        if (code) {
            try {
                const { default: api } = await import("@/lib/api");
                const res = await api.get(`/coupons/validate/${code}?totalPrice=${totalPrice}`);
                if (res.data.success) {
                    setDiscount(res.data.data.discount);
                    setCouponCode(code);
                }
            } catch (err) {
                console.error("Invalid coupon in storage", err);
                localStorage.removeItem("appliedCoupon");
            }
        }
    };

    const loadShippingMethods = async () => {
        try {
            setLoadingShipping(true);
            const { default: api } = await import("@/lib/api");
            const res = await api.get('/shipping');
            if (res.data.success) {
                const activeMethods = res.data.data.filter((m: any) => m.isActive);
                setShippingMethods(activeMethods);
                if (activeMethods.length > 0) {
                    setSelectedShippingMethodId(activeMethods[0]._id);
                }
            }
        } catch (err) {
            console.error("Error loading shipping methods", err);
        } finally {
            setLoadingShipping(false);
        }
    };

    const loadUserData = async () => {
        try {
            setLoadingAddresses(true);
            const profileData = await authService.getProfile();
            setUser(profileData);

            // Map addresses
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

            // Auto-select default
            if (!selectedAddressId) {
                const defaultAddress = userAddresses.find((addr: any) => addr.isDefault);
                if (defaultAddress) {
                    setSelectedAddressId(defaultAddress._id);
                } else if (userAddresses.length > 0) {
                    setSelectedAddressId(userAddresses[0]._id);
                }
            }

            setLoadingAddresses(false);
        } catch (err: any) {
            console.error("[CHECKOUT] Error loading user data:", err);
            setError(err.message || "خطا در بارگذاری اطلاعات کاربر");
            setLoadingAddresses(false);
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

    // Sheet Handlers
    const handleOpenAdd = () => {
        setEditingAddress(null);
        setIsRecipientMe(true);

        // Initialize Buyer Info
        const userSplit = splitName(user?.name || "");
        setBuyerInfo({
            firstName: userSplit.firstName,
            lastName: userSplit.lastName,
            mobile: user?.mobile || "",
            nationalCode: "" // Always require user to enter if not saved
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

    const handleOpenEdit = (e: React.MouseEvent, addr: Address) => {
        e.stopPropagation();
        setEditingAddress(addr);

        // Check if recipient matches buyer (or is undefined/legacy)
        const isMe = (!addr.recipientName || (addr.recipientName === addr.fullName && addr.recipientPhone === addr.mobile));
        setIsRecipientMe(isMe);

        // Buyer Info (Load from address record)
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

    const handleSubmitAddress = async () => {
        // 1. Validate Buyer Info
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

        // 2. Validate Address Info
        if (!addressInfo.province || !addressInfo.city || !addressInfo.address || !addressInfo.plaque || !addressInfo.postalCode) {
            alert("لطفا اطلاعات آدرس (استان، شهر، آدرس، پلاک، کد پستی) را کامل کنید");
            return;
        }

        // 3. Validate Recipient Info (if !isRecipientMe)
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

                if (!editingAddress && updatedAddresses.length === 1) {
                    setSelectedAddressId(updatedAddresses[0]._id);
                }

                setSheetOpen(false);
            }
        } catch (err: any) {
            alert(err.message || "خطا در ذخیره آدرس");
        } finally {
            setSubmitLoading(false);
        }
    };

    // Handle Order Submission
    const handlePlaceOrder = async () => {
        if (!selectedAddressId) {
            setError("لطفاً آدرس تحویل را انتخاب کنید");
            return;
        }

        if (isEmpty) {
            setError("سبد خرید شما خالی است");
            return;
        }

        try {
            setIsSubmitting(true);
            setError(null);

            const selectedAddress = addresses.find(addr => addr._id === selectedAddressId);
            if (!selectedAddress) {
                setError("آدرس انتخاب شده معتبر نیست");
                return;
            }

            const orderItems: OrderItem[] = cartItems.map((item) => ({
                product: item.id,
                name: item.name,
                quantity: item.qty,
                image: item.image,
                price: item.price,
            }));

            const shippingAddress: ShippingAddress = {
                fullName: selectedAddress.fullName,
                phone: selectedAddress.mobile,
                province: selectedAddress.province,
                city: selectedAddress.city,
                address: selectedAddress.address,
                postalCode: selectedAddress.postalCode,
                isDefault: selectedAddress.isDefault,
                mobile: selectedAddress.mobile,
                nationalCode: selectedAddress.nationalCode,
                recipientName: selectedAddress.recipientName,
                recipientPhone: selectedAddress.recipientPhone,
                recipientNationalCode: selectedAddress.recipientNationalCode,
            };

            const orderData: CreateOrderRequest = {
                orderItems,
                shippingAddress,
                paymentMethod,
                itemsPrice: totalPrice,
                shippingPrice,
                shippingMethod: selectedMethod?.name,
                taxPrice,
                totalPrice: finalTotalPrice,
                totalDiscount: totalSavings,
            };

            // Step 1: Create the order
            const response = await orderService.create(orderData);

            if (response.success && response.data) {
                const orderId = response.data._id;

                // Step 2: If online payment, initiate payment
                if (paymentMethod === "online") {
                    try {
                        const { default: api } = await import("@/lib/api");
                        // Pass selected gateway if available
                        const paymentResponse = await api.post(`/orders/${orderId}/pay`, {
                            gateway: selectedGateway
                        });

                        if (paymentResponse.data.success && paymentResponse.data.data.paymentUrl) {
                            // Redirect to Gateway
                            window.location.href = paymentResponse.data.data.paymentUrl;
                        } else {
                            setError("خطا در ایجاد درخواست پرداخت");
                            setIsSubmitting(false);
                        }
                    } catch (payErr: any) {
                        console.error("[CHECKOUT] Payment error:", payErr);
                        setError(payErr?.response?.data?.message || "خطا در اتصال به درگاه پرداخت");
                        setIsSubmitting(false);
                    }
                } else {
                    // Cash on delivery - go directly to order page
                    router.push(`/profile/orders/${orderId}`);
                }
            } else {
                setError(response.message || "خطا در ثبت سفارش");
            }
        } catch (err: any) {
            console.error("[CHECKOUT] Error placing order:", err);
            setError(err.message || "خطا در ثبت سفارش");
        } finally {
            // Don't set isSubmitting to false if redirecting to payment
            if (paymentMethod !== "online") {
                setIsSubmitting(false);
            }
        }
    };

    if (isEmpty) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-6 px-4">
                    <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center">
                        <Package className="text-amber-500" size={40} />
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-gray-800 mb-2">سبد خرید خالی است</h2>
                        <p className="text-gray-500 text-sm">برای تکمیل خرید، ابتدا محصولی به سبد خرید اضافه کنید</p>
                    </div>
                    <Link href="/" className="px-6 py-3 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors">
                        بازگشت به فروشگاه
                    </Link>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50 pb-32">
                {/* Header */}
                <header className="bg-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <h1 className="font-bold text-lg text-gray-900">تکمیل خرید</h1>
                    <Link href="/cart" className="p-2 bg-gray-100 rounded-full">
                        <ChevronLeft size={20} />
                    </Link>
                </header>

                <div className="p-4 space-y-4">
                    {/* Step 1: Shipping Address */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                    <MapPin size={16} className="text-amber-600" />
                                </div>
                                <h2 className="font-bold text-gray-900">آدرس تحویل گیرنده</h2>
                            </div>
                            <button
                                onClick={handleOpenAdd}
                                className="flex items-center gap-1 text-xs text-amber-600 font-bold hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full transition-colors"
                            >
                                <Plus size={14} />
                                افزودن آدرس
                            </button>
                        </div>

                        {loadingAddresses ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="animate-spin text-amber-600" size={24} />
                            </div>
                        ) : addresses.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                <p className="text-sm text-gray-500 mb-3 font-medium">هنوز آدرسی ثبت نشده است</p>
                                <button
                                    onClick={handleOpenAdd}
                                    className="px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition-colors"
                                >
                                    ثبت اولین آدرس
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {addresses.map((addr) => (
                                    <div
                                        key={addr._id}
                                        onClick={() => setSelectedAddressId(addr._id!)}
                                        className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === addr._id
                                            ? "border-amber-500 bg-amber-50 shadow-sm"
                                            : "border-gray-100 hover:border-gray-200 bg-gray-50"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-bold text-gray-900 text-sm">{addr.title}</span>
                                                    {addr.isDefault && (
                                                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                                                            پیش‌فرض
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-600 leading-relaxed mb-2">
                                                    {addr.province}، {addr.city}، {addr.address}
                                                    {addr.plaque && `، پلاک ${addr.plaque}`}
                                                    {addr.unit && `، واحد ${addr.unit}`}
                                                </p>
                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <User size={12} /> {addr.fullName}
                                                    </span>
                                                    <span className="flex items-center gap-1 font-mono">
                                                        <Phone size={12} /> {addr.mobile}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 items-end">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedAddressId === addr._id ? "border-amber-500 bg-amber-500" : "border-gray-300"
                                                    }`}>
                                                    {selectedAddressId === addr._id && <Check size={12} className="text-white" />}
                                                </div>

                                                <button
                                                    onClick={(e) => handleOpenEdit(e, addr)}
                                                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-100 rounded-lg transition-colors mt-1"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Step 2: Shipping Method */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <Package size={16} className="text-amber-600" />
                            </div>
                            <h2 className="font-bold text-gray-900">روش ارسال</h2>
                        </div>

                        {loadingShipping ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="animate-spin text-amber-600" size={24} />
                            </div>
                        ) : shippingMethods.length === 0 ? (
                            <div className="text-center py-4 text-gray-500 text-sm">
                                هیچ روش ارسالی یافت نشد.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {shippingMethods.map((method) => (
                                    <label
                                        key={method._id}
                                        className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedShippingMethodId === method._id ? "border-amber-500 bg-amber-50 shadow-sm" : "border-gray-100 bg-gray-50"
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="shippingMethod"
                                            value={method._id}
                                            checked={selectedShippingMethodId === method._id}
                                            onChange={() => setSelectedShippingMethodId(method._id)}
                                            className="w-4 h-4 text-amber-600 focus:ring-amber-500 accent-amber-600"
                                        />
                                        <div className="flex-1">
                                            <span className="block text-sm font-bold text-gray-900">{method.name}</span>
                                            {method.description && (
                                                <span className="text-xs text-gray-500 mt-0.5 block">{method.description}</span>
                                            )}
                                        </div>
                                        <div className="text-sm font-bold text-gray-900">
                                            {method.cost === 0 ? "رایگان" : `${method.cost.toLocaleString("fa-IR")} تومان`}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Step 3: Payment Method */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <CreditCard size={16} className="text-amber-600" />
                            </div>
                            <h2 className="font-bold text-gray-900">روش پرداخت</h2>
                        </div>

                        <div className="space-y-3">
                            <label
                                className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "online" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-gray-100 bg-gray-50"
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="online"
                                    checked={paymentMethod === "online"}
                                    onChange={(e) => setPaymentMethod(e.target.value as "online" | "cod")}
                                    className="w-4 h-4 text-amber-600 focus:ring-amber-500 accent-amber-600"
                                />
                                <div className="flex-1">
                                    <span className="block text-sm font-bold text-gray-900">پرداخت اینترنتی</span>
                                    <span className="text-xs text-gray-500 mt-0.5 block">پرداخت آنلاین با کلیه کارت‌های بانکی</span>

                                    {/* Gateway Selection (Only visible if Online Payment is selected) */}
                                    {paymentMethod === "online" && availableGateways.length > 0 && (
                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {availableGateways.map((gateway) => (
                                                <label
                                                    key={gateway.id}
                                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${selectedGateway === gateway.id
                                                        ? "border-amber-500 bg-amber-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                        }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="gateway"
                                                        value={gateway.id}
                                                        checked={selectedGateway === gateway.id}
                                                        onChange={() => setSelectedGateway(gateway.id)}
                                                        className="w-3 h-3 text-amber-600 accent-amber-600"
                                                    />
                                                    <span className="text-sm text-gray-700">{gateway.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </label>

                            <label
                                className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod === "cod" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-gray-100 bg-gray-50"
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="paymentMethod"
                                    value="cod"
                                    checked={paymentMethod === "cod"}
                                    onChange={(e) => setPaymentMethod(e.target.value as "online" | "cod")}
                                    className="w-4 h-4 text-amber-600 focus:ring-amber-500 accent-amber-600"
                                />
                                <div className="flex-1">
                                    <span className="block text-sm font-bold text-gray-900">پرداخت در محل</span>
                                    <span className="text-xs text-gray-500 mt-0.5 block">پرداخت وجه هنگام تحویل کالا</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Step 3: Order Summary */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <Package size={16} className="text-amber-600" />
                            </div>
                            <h2 className="font-bold text-gray-900">خلاصه سفارش</h2>
                        </div>

                        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1">
                            {cartItems.map((item, index) => {
                                const variantKey = item.variantOptions?.map((v) => `${v.name}:${v.value}`).join('|') || 'no-variant';
                                const itemKey = `${String(item.id ?? index)}-${item.color || 'no-color'}-${variantKey}`;
                                return (
                                    <div key={itemKey} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-none">
                                        <div className="relative w-14 h-14 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                                            <Image src={item.image} alt={item.name} fill className="object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-800 truncate mb-1">{item.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">تعداد: {item.qty}</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-gray-900">
                                            {(item.price * item.qty).toLocaleString("fa-IR")} <span className="text-[10px] font-normal text-gray-400">تومان</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="space-y-2 pt-4 border-t border-gray-100">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>جمع کالاها ({cartItems.length} کالا)</span>
                                <span>{totalPrice.toLocaleString("fa-IR")} تومان</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>هزینه ارسال</span>
                                <span>{shippingPrice.toLocaleString("fa-IR")} تومان</span>
                            </div>
                            {totalSavings > 0 && (
                                <div className="flex justify-between text-sm text-red-500 font-bold">
                                    <span>سود شما از این خرید</span>
                                    <span>{totalSavings.toLocaleString("fa-IR")} تومان</span>
                                </div>
                            )}
                            {discount > 0 && (
                                <div className="flex justify-between text-xs text-gray-400">
                                    <span>کد تخفیف ({couponCode})</span>
                                    <span>{discount.toLocaleString("fa-IR")} - تومان</span>
                                </div>
                            )}
                            <div className="flex justify-between text-base font-black text-gray-900 pt-3 border-t border-gray-100 mt-2">
                                <span>مبلغ قابل پرداخت</span>
                                <span className="text-amber-600">{finalTotalPrice.toLocaleString("fa-IR")} تومان</span>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                            <p className="text-sm text-red-700 font-medium">{error}</p>
                        </div>
                    )}
                </div>

                {/* Submit Button (Static at the end) */}
                <div className="pt-6 px-8 pb-8">
                    <button
                        onClick={handlePlaceOrder}
                        disabled={isSubmitting || !selectedAddressId}
                        className={`w-full py-3 rounded-xl font-bold text-base text-white transition-all duration-300 flex items-center justify-center gap-2 ${isSubmitting || !selectedAddressId
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:via-amber-700 hover:to-amber-800 shadow-lg shadow-amber-200 hover:shadow-xl hover:shadow-amber-300 transform hover:-translate-y-1 active:scale-95 active:translate-y-0"
                            }`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>در حال ثبت...</span>
                            </>
                        ) : (
                            <>
                                <span>ثبت نهایی سفارش</span>
                                <ChevronLeft size={20} className="animate-pulse" />
                            </>
                        )}
                    </button>
                </div>


                {/* Add/Edit Address Sheet */}
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
                                    <UserCheck size={18} className="text-amber-600" />
                                    مشخصات شما (خریدار)
                                </h3>
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1.5">نام <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={buyerInfo.firstName}
                                                onChange={(e) => setBuyerInfo({ ...buyerInfo, firstName: e.target.value })}
                                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1.5">نام خانوادگی <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={buyerInfo.lastName}
                                                onChange={(e) => setBuyerInfo({ ...buyerInfo, lastName: e.target.value })}
                                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
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
                                                className={`w-full border rounded-xl p-3 text-sm outline-none transition-all text-left ${user?.mobile ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-white border-gray-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
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
                                                className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
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
                                    <MapPin size={18} className="text-amber-600" />
                                    مشخصات آدرس
                                </h3>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">عنوان آدرس (مثال: خانه)</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={addressInfo.title}
                                            onChange={(e) => setAddressInfo({ ...addressInfo, title: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
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
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5">شهر <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={addressInfo.city}
                                            onChange={(e) => setAddressInfo({ ...addressInfo, city: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">آدرس پستی <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={addressInfo.address}
                                        onChange={(e) => setAddressInfo({ ...addressInfo, address: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all min-h-[80px]"
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
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-8 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-center"
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
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-8 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-center"
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
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
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
                                        <User size={18} className="text-amber-600" />
                                        گیرنده سفارش خودم هستم
                                    </div>
                                    <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                        <input
                                            type="checkbox"
                                            checked={isRecipientMe}
                                            onChange={(e) => setIsRecipientMe(e.target.checked)}
                                            className="peer absolute w-0 h-0 opacity-0"
                                        />
                                        <span className="block w-12 h-7 bg-gray-300 rounded-full shadow-inner peer-checked:bg-amber-500 transition-colors duration-300"></span>
                                        <span className="absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform peer-checked:translate-x-5 transition-transform duration-300"></span>
                                    </div>
                                </label>

                                <div className={`overflow-hidden transition-all duration-500 ease-in-out ${!isRecipientMe ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="space-y-4 pt-4">
                                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <User size={18} className="text-amber-600" />
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
                                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">نام خانوادگی <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="text"
                                                        value={recipientInfo.lastName}
                                                        onChange={(e) => setRecipientInfo({ ...recipientInfo, lastName: e.target.value })}
                                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all"
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
                                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
                                                        dir="ltr"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-500 mb-1.5">کد ملی <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="text"
                                                        value={recipientInfo.nationalCode}
                                                        onChange={(e) => setRecipientInfo({ ...recipientInfo, nationalCode: e.target.value })}
                                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-left"
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
                                    className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                />
                                <label htmlFor="isDefault" className="text-sm text-gray-700 font-medium">تنظیم به عنوان آدرس پیش‌فرض</label>
                            </div>

                            <button
                                onClick={handleSubmitAddress}
                                disabled={submitLoading}
                                className="w-full bg-amber-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-amber-200 mt-4 active:scale-95 transition-all"
                            >
                                {submitLoading ? "در حال ذخیره..." : "ثبت آدرس"}
                            </button>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </ProtectedRoute>
    );
}
