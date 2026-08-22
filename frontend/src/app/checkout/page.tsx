"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, MapPin, CreditCard, Package, AlertCircle, Loader2, Plus, Check, Edit2, Home, Phone, User, Hash, Building2, UserCheck, Tag, CheckCircle2, X, Store, ShieldCheck } from "lucide-react";
import Link from "next/link";
import ResilientImage from "@/components/ui/ResilientImage";
import { useCart } from "@/hooks/useCart";
import { orderService, CreateOrderRequest, OrderItem, ShippingAddress } from "@/services/orderService";
import { authService, User as UserType } from "@/services/authService";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import api from "@/lib/api";
import { normalizeIranMobile, toDigitsOnly } from "@/lib/normalization";
import AddressLocationFields from "@/components/checkout/AddressLocationFields";
import { normalizeIranLocationText } from "@/lib/iranLocations";

interface Address {
    _id?: string;
    title: string;
    fullName: string;
    mobile: string;
    nationalCode: string;
    province: string;
    city: string;
    provinceId?: number;
    cityId?: number;
    address: string;
    plaque: string;
    unit: string;
    postalCode: string;
    isDefault: boolean;
    recipientName?: string;
    recipientPhone?: string;
    recipientNationalCode?: string;
}

interface AddressFormState {
    title: string;
    province: string;
    city: string;
    provinceId?: number;
    cityId?: number;
    address: string;
    plaque: string;
    unit: string;
    postalCode: string;
    isDefault: boolean;
}

export default function CheckoutPage() {
    const { cartItems, totalPrice, totalProfit, isEmpty } = useCart();

    // Coupon State
    const [discount, setDiscount] = useState(0);
    const [couponCode, setCouponCode] = useState("");
    const [inputCouponCode, setInputCouponCode] = useState("");
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [couponSuccess, setCouponSuccess] = useState<string | null>(null);

    // User & Address State
    const [user, setUser] = useState<UserType | null>(null);
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [loadingAddresses, setLoadingAddresses] = useState(true);

    // Only online payment is available. Cash on delivery is intentionally retired.
    const paymentMethod = "online" as const;

    // Delivery State
    const [deliveryOption, setDeliveryOption] = useState<"shipping" | "mashhad_special_pickup">("shipping");

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
    const [addressInfo, setAddressInfo] = useState<AddressFormState>({
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
    const selectedAddress = addresses.find((address) => address._id === selectedAddressId);
    const isMashhadAddress = Boolean(
        selectedAddress &&
        normalizeIranLocationText(selectedAddress.city) === "مشهد" &&
        normalizeIranLocationText(selectedAddress.province) === "خراسان رضوی"
    );
    const canUseMashhadSpecialPickup = Boolean(user?.isMashhadPickupEligible && isMashhadAddress);
    const isMashhadSpecialPickup = deliveryOption === "mashhad_special_pickup" && canUseMashhadSpecialPickup;
    const shippingPrice = isMashhadSpecialPickup ? 0 : (selectedMethod ? selectedMethod.cost : 0);
    const deliveryLabel = isMashhadSpecialPickup ? "تحویل حضوری ویژه مشهد" : selectedMethod?.name;
    const taxPrice = 0;
    const finalTotalPrice = Math.max(0, totalPrice + shippingPrice + taxPrice - discount);
    const totalSavings = (totalProfit || 0) + discount;

    useEffect(() => {
        if (!canUseMashhadSpecialPickup && deliveryOption === "mashhad_special_pickup") {
            setDeliveryOption("shipping");
        }
    }, [canUseMashhadSpecialPickup, deliveryOption]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                console.log("Fetching public settings...");
                const res = await api.get('/settings/public');
                console.log("Settings response:", res.data);

                if (res.data.success && res.data.data) {
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

    const loadAppliedCoupon = useCallback(async () => {
        const code = localStorage.getItem("appliedCoupon");
        if (code && totalPrice > 0) {
            try {
                const { default: api } = await import("@/lib/api");
                const res = await api.get(`/coupons/validate/${code}?totalPrice=${totalPrice}`);
                if (res.data.success) {
                    setDiscount(res.data.data.discount);
                    setCouponCode(code);
                    setInputCouponCode(code);
                    setCouponSuccess("کد تخفیف اعمال شد");
                }
            } catch (err) {
                console.error("Invalid coupon in storage", err);
                localStorage.removeItem("appliedCoupon");
            }
        }
    }, [totalPrice]);

    const handleApplyCoupon = async (codeToApply?: string) => {
        const targetCode = (codeToApply || inputCouponCode).trim();
        if (!targetCode) return;

        try {
            setCouponLoading(true);
            setCouponError(null);
            setCouponSuccess(null);

            const { default: api } = await import("@/lib/api");
            const res = await api.get(`/coupons/validate/${targetCode}?totalPrice=${totalPrice}`);

            if (res.data.success) {
                setDiscount(res.data.data.discount);
                setCouponCode(targetCode);
                setInputCouponCode(targetCode);
                setCouponSuccess("کد تخفیف با موفقیت اعمال شد");
                localStorage.setItem("appliedCoupon", targetCode);
            }
        } catch (err: any) {
            setCouponError(err.response?.data?.message || "کد تخفیف نامعتبر یا منقضی شده است");
            setDiscount(0);
            setCouponCode("");
            localStorage.removeItem("appliedCoupon");
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setDiscount(0);
        setCouponCode("");
        setInputCouponCode("");
        setCouponError(null);
        setCouponSuccess(null);
        localStorage.removeItem("appliedCoupon");
    };

    const loadShippingMethods = useCallback(async () => {
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
    }, []);

    const loadUserData = useCallback(async () => {
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
    }, [selectedAddressId]);

    // Load addresses, shipping methods, and coupon on mount
    useEffect(() => {
        loadUserData();
        loadShippingMethods();
        loadAppliedCoupon();
    }, [loadUserData, loadShippingMethods, loadAppliedCoupon]);

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
            provinceId: addr.provinceId,
            cityId: addr.cityId,
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
        if (!buyerInfo.firstName || !buyerInfo.lastName) {
            alert("Please enter buyer first and last name.");
            return;
        }

        const normalizedBuyerMobile = normalizeIranMobile(buyerInfo.mobile);
        if (!normalizedBuyerMobile) {
            alert("Buyer mobile number is invalid (example: 09123456789).");
            return;
        }

        const normalizedBuyerNationalCode = toDigitsOnly(buyerInfo.nationalCode);
        if (!/^\d{10}$/.test(normalizedBuyerNationalCode)) {
            alert("Buyer national code must be exactly 10 digits.");
            return;
        }

        const normalizedProvince = addressInfo.province.trim();
        const normalizedCity = addressInfo.city.trim();
        const normalizedAddress = addressInfo.address.trim();
        const normalizedPlaque = addressInfo.plaque.trim();
        const normalizedPostalCode = toDigitsOnly(addressInfo.postalCode);

        if (!normalizedProvince || !normalizedCity || !normalizedAddress || !normalizedPlaque || !normalizedPostalCode) {
            alert("Please complete province, city, address, plaque, and postal code.");
            return;
        }
        if (normalizedAddress.length < 10) {
            alert("Address must be at least 10 characters.");
            return;
        }
        if (!/^\d{10}$/.test(normalizedPostalCode)) {
            alert("Postal code must be exactly 10 digits.");
            return;
        }

        const buyerFullName = `${buyerInfo.firstName} ${buyerInfo.lastName}`.trim();

        let finalRecipientName = buyerFullName;
        let finalRecipientPhone = normalizedBuyerMobile;
        let finalRecipientNationalCode = normalizedBuyerNationalCode;

        if (!isRecipientMe) {
            if (!recipientInfo.firstName || !recipientInfo.lastName) {
                alert("Please enter recipient first and last name.");
                return;
            }

            const normalizedRecipientMobile = normalizeIranMobile(recipientInfo.mobile);
            if (!normalizedRecipientMobile) {
                alert("Recipient mobile number is invalid (example: 09123456789).");
                return;
            }

            const normalizedRecipientNationalCode = toDigitsOnly(recipientInfo.nationalCode);
            if (!/^\d{10}$/.test(normalizedRecipientNationalCode)) {
                alert("Recipient national code must be exactly 10 digits.");
                return;
            }

            finalRecipientName = `${recipientInfo.firstName} ${recipientInfo.lastName}`.trim();
            finalRecipientPhone = normalizedRecipientMobile;
            finalRecipientNationalCode = normalizedRecipientNationalCode;
        }

        try {
            setSubmitLoading(true);

            const payload = {
                ...addressInfo,
                fullName: buyerFullName,
                mobile: normalizedBuyerMobile,
                nationalCode: normalizedBuyerNationalCode,
                recipientName: finalRecipientName,
                recipientPhone: finalRecipientPhone,
                recipientNationalCode: finalRecipientNationalCode,
                province: normalizedProvince,
                city: normalizedCity,
                provinceId: addressInfo.provinceId,
                cityId: addressInfo.cityId,
                address: normalizedAddress,
                plaque: normalizedPlaque,
                postalCode: normalizedPostalCode,
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
            alert(err.message || "Failed to save address.");
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

        let redirectingToGateway = false;

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
                provinceId: selectedAddress.provinceId,
                cityId: selectedAddress.cityId,
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
                shippingMethod: deliveryLabel,
                fulfillmentType: isMashhadSpecialPickup ? "mashhad_special_pickup" : "shipping",
                taxPrice,
                totalPrice: finalTotalPrice,
                totalDiscount: totalSavings,
                couponCode: couponCode || undefined,
            };

            // Step 1: Create the order
            const response = await orderService.create(orderData);

            if (response.success && response.data) {
                // Clear coupon from localStorage upon successful order creation
                localStorage.removeItem("appliedCoupon");
                const orderId = response.data._id;

                // Step 2: Every checkout must proceed to the online payment gateway.
                try {
                    const { default: api } = await import("@/lib/api");
                    const paymentResponse = await api.post(`/orders/${orderId}/pay`, {
                        gateway: selectedGateway
                    });

                    if (paymentResponse.data.success && paymentResponse.data.data.paymentUrl) {
                        redirectingToGateway = true;
                        window.location.href = paymentResponse.data.data.paymentUrl;
                        return;
                    }

                    setError("خطا در ایجاد درخواست پرداخت");
                } catch (payErr: any) {
                    console.error("[CHECKOUT] Payment error:", payErr);
                    setError(payErr?.response?.data?.message || "خطا در اتصال به درگاه پرداخت");
                }
            } else {
                setError(response.message || "خطا در ثبت سفارش");
            }
        } catch (err: any) {
            console.error("[CHECKOUT] Error placing order:", err);
            setError(err.message || "خطا در ثبت سفارش");
        } finally {
            // Keep the loading state only while the browser is leaving for the gateway.
            if (!redirectingToGateway) {
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
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-sm md:static">
                    <h1 className="font-bold text-lg text-gray-900">تکمیل خرید</h1>
                    <Link href="/cart" className="p-2 bg-gray-100 rounded-full">
                        <ChevronLeft size={20} />
                    </Link>
                </header>

                {/* Content - 2 Column Layout on Desktop */}
                <div className="container mx-auto px-4 py-6 pb-32 lg:pb-6">
                    <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-6">

                        {/* Left Column: Order Summary (Mobile Bottom, Desktop 4 cols, Sticky) */}
                        <div className="lg:col-span-4">
                            <div className="lg:sticky lg:top-24 space-y-4">
                                {/* Order Summary */}
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
                                                        <ResilientImage src={item.image} alt={item.name} fill className="object-cover" />
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
                                            <span>{isMashhadSpecialPickup ? "هزینه تحویل حضوری" : "هزینه ارسال"}</span>
                                            <span className={isMashhadSpecialPickup ? "font-bold text-emerald-600" : ""}>
                                                {isMashhadSpecialPickup ? "رایگان" : `${shippingPrice.toLocaleString("fa-IR")} تومان`}
                                            </span>
                                        </div>
                                        {totalSavings > 0 && (
                                            <div className="flex justify-between text-sm text-red-500 font-bold">
                                                <span>سود شما از این خرید</span>
                                                <span>{totalSavings.toLocaleString("fa-IR")} تومان</span>
                                            </div>
                                        )}
                                        {discount > 0 && (
                                            <div className="flex justify-between text-xs text-green-600 font-medium">
                                                <span>کد تخفیف ({couponCode})</span>
                                                <span>{discount.toLocaleString("fa-IR")} - تومان</span>
                                            </div>
                                        )}

                                        {/* Coupon Input Box in Checkout */}
                                        <div className="pt-2 border-t border-gray-100 space-y-2">
                                            <div className="flex items-center gap-1.5 text-xs text-gray-700 font-bold mb-1">
                                                <Tag size={14} className="text-amber-600" />
                                                <span>کد تخفیف</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={inputCouponCode}
                                                    onChange={(e) => setInputCouponCode(e.target.value)}
                                                    placeholder="کد تخفیف خود را وارد کنید"
                                                    className={`flex-1 bg-gray-50 border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 transition-all ${couponError ? "border-red-300 bg-red-50" : discount > 0 ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                                                    disabled={couponLoading || discount > 0}
                                                />
                                                {discount > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveCoupon}
                                                        className="bg-red-50 text-red-600 text-xs font-bold px-3 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <X size={14} />
                                                        <span>حذف</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApplyCoupon()}
                                                        disabled={couponLoading || !inputCouponCode.trim()}
                                                        className="bg-amber-600 text-white text-xs font-bold px-4 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]"
                                                    >
                                                        {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "اعمال"}
                                                    </button>
                                                )}
                                            </div>

                                            {couponError && (
                                                <div className="flex items-center gap-1 text-[10px] text-red-500 mt-1">
                                                    <AlertCircle size={12} />
                                                    <span>{couponError}</span>
                                                </div>
                                            )}

                                            {couponSuccess && (
                                                <div className="flex items-center gap-1 text-[10px] text-green-600 mt-1">
                                                    <CheckCircle2 size={12} />
                                                    <span>{couponSuccess}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex justify-between text-base font-black text-gray-900 pt-3 border-t border-gray-100 mt-2">
                                            <span>مبلغ قابل پرداخت</span>
                                            <span className="text-amber-600">{finalTotalPrice.toLocaleString("fa-IR")} تومان</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Desktop Submit Button (Hidden on Mobile) */}
                                <button
                                    onClick={handlePlaceOrder}
                                    disabled={isSubmitting || !selectedAddressId}
                                    className={`hidden lg:flex w-full py-4 rounded-xl font-bold text-base text-white transition-all duration-300 items-center justify-center gap-2 ${isSubmitting || !selectedAddressId
                                        ? "bg-gray-300 cursor-not-allowed"
                                        : "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:via-amber-700 hover:to-amber-800 shadow-lg shadow-amber-200 hover:shadow-xl hover:shadow-amber-300 transform hover:-translate-y-1 active:scale-95 active:translate-y-0"
                                        }`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="animate-spin" size={20} />
                                            <span>در حال انتقال به پرداخت...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>ادامه و پرداخت آنلاین</span>
                                            <ChevronLeft size={20} className="animate-pulse" />
                                        </>
                                    )}
                                </button>

                                {error && (
                                    <div className="hidden lg:flex bg-red-50 border border-red-200 rounded-xl p-4 items-start gap-3">
                                        <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                                        <p className="text-sm text-red-700 font-medium">{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Forms (Mobile Top, Desktop 8 cols) */}
                        <div className="lg:col-span-8 space-y-4">
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

                            {/* Step 2: Delivery Option */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                        <Package size={16} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-900">روش تحویل</h2>
                                        <p className="text-[11px] text-gray-500 mt-0.5">هزینه و زمان تحویل بر اساس گزینهٔ انتخابی محاسبه می‌شود.</p>
                                    </div>
                                </div>

                                {loadingShipping ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="animate-spin text-amber-600" size={24} />
                                    </div>
                                ) : shippingMethods.length === 0 && !canUseMashhadSpecialPickup ? (
                                    <div className="text-center py-4 text-gray-500 text-sm">
                                        هیچ روش تحویلی یافت نشد.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {canUseMashhadSpecialPickup && (
                                            <label
                                                className={`relative flex items-center gap-3 overflow-hidden p-4 border-2 rounded-2xl cursor-pointer transition-all ${isMashhadSpecialPickup
                                                    ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100"
                                                    : "border-emerald-200 bg-gradient-to-l from-emerald-50 to-teal-50 hover:border-emerald-400"
                                                    }`}
                                            >
                                                <div className="absolute top-0 left-0 px-3 py-1 rounded-br-xl bg-emerald-600 text-white text-[10px] font-black">
                                                    ویژهٔ مشهد
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="deliveryOption"
                                                    value="mashhad_special_pickup"
                                                    checked={isMashhadSpecialPickup}
                                                    onChange={() => setDeliveryOption("mashhad_special_pickup")}
                                                    className="w-4 h-4 mt-4 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                                                />
                                                <div className="mt-3 w-11 h-11 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                                                    <Store size={21} />
                                                </div>
                                                <div className="flex-1 pt-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-black text-emerald-950">تحویل حضوری ویژه</span>
                                                        <ShieldCheck size={15} className="text-emerald-600" />
                                                    </div>
                                                    <span className="text-xs leading-5 text-emerald-800 mt-1 block">برای شما در مشهد فعال است؛ هزینه تحویل کاملاً رایگان است.</span>
                                                    <span className="text-[11px] text-emerald-700 mt-1 block">پرداخت سفارش همچنان فقط از طریق درگاه امن آنلاین انجام می‌شود.</span>
                                                </div>
                                                <div className="mt-3 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-black text-emerald-700 border border-emerald-200">
                                                    رایگان
                                                </div>
                                            </label>
                                        )}

                                        {shippingMethods.map((method) => (
                                            <label
                                                key={method._id}
                                                className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${deliveryOption === "shipping" && selectedShippingMethodId === method._id ? "border-amber-500 bg-amber-50 shadow-sm" : "border-gray-100 bg-gray-50 hover:border-gray-200"
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="deliveryOption"
                                                    value={method._id}
                                                    checked={deliveryOption === "shipping" && selectedShippingMethodId === method._id}
                                                    onChange={() => {
                                                        setSelectedShippingMethodId(method._id);
                                                        setDeliveryOption("shipping");
                                                    }}
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

                            {/* Step 3: Online Payment */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                        <CreditCard size={16} className="text-amber-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-gray-900">پرداخت امن آنلاین</h2>
                                        <p className="text-[11px] text-gray-500 mt-0.5">پس از ثبت سفارش، مستقیماً به درگاه پرداخت منتقل می‌شوید.</p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50 p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                                            <CreditCard size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="block text-sm font-black text-gray-900">پرداخت اینترنتی</span>
                                            <span className="text-xs text-gray-600 mt-0.5 block">تنها روش پرداخت فعال برای تمام سفارش‌ها</span>
                                        </div>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-amber-700 border border-amber-200">الزامی</span>
                                    </div>

                                    {availableGateways.length > 0 ? (
                                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {availableGateways.map((gateway) => (
                                                <label
                                                    key={gateway.id}
                                                    className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${selectedGateway === gateway.id
                                                        ? "border-amber-500 bg-white shadow-sm"
                                                        : "border-amber-100 bg-white/70 hover:border-amber-300"
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
                                    ) : (
                                        <p className="mt-3 text-xs text-amber-800">درگاه فعال به‌صورت خودکار هنگام ثبت سفارش انتخاب می‌شود.</p>
                                    )}
                                </div>
                            </div>

                            {/* Mobile Error */}
                            {error && (
                                <div className="lg:hidden bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                    <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Sticky Submit Button (Hidden on Desktop) */}
                <div className="lg:hidden fixed bottom-[65px] left-0 w-full bg-white border-t border-gray-200 p-4 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                    <button
                        onClick={handlePlaceOrder}
                        disabled={isSubmitting || !selectedAddressId}
                        className={`w-full py-3.5 rounded-xl font-bold text-base text-white transition-all duration-300 flex items-center justify-center gap-2 ${isSubmitting || !selectedAddressId
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 shadow-lg shadow-amber-200 active:scale-95"
                            }`}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>در حال انتقال به پرداخت...</span>
                            </>
                        ) : (
                            <>
                                <span>ادامه و پرداخت آنلاین</span>
                                <ChevronLeft size={20} />
                            </>
                        )}
                    </button>
                </div>


                {/* Add/Edit Address Sheet - Responsive: Center Modal on Desktop, Bottom Sheet on Mobile */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                    <SheetContent side="bottom" className="p-0 overflow-hidden lg:rounded-3xl lg:max-w-2xl lg:h-fit lg:max-h-[90vh] lg:top-1/2 lg:left-1/2 lg:-translate-y-1/2 lg:-translate-x-1/2 lg:bottom-auto lg:inset-x-auto lg:shadow-2xl sm:rounded-t-[2rem]">
                        <div className="flex flex-col h-full max-h-[90vh]">
                            <div className="p-6 sticky top-0 bg-white z-10 border-b flex-shrink-0">
                                <SheetHeader>
                                    <SheetTitle className="text-center text-lg font-bold text-gray-800">
                                        {editingAddress ? "ویرایش آدرس" : "افزودن آدرس جدید"}
                                    </SheetTitle>
                                </SheetHeader>
                            </div>

                            <div className="p-6 space-y-8 overflow-y-auto pb-32 lg:pb-8 flex-1">

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

                                    <AddressLocationFields
                                        value={addressInfo}
                                        onChange={(location) => setAddressInfo({ ...addressInfo, ...location })}
                                    />

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
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </ProtectedRoute>
    );
}


