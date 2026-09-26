"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
    ShoppingCart,
    Check,
    Package,
    Loader2,
    ChevronLeft,
    BadgePercent,
} from "lucide-react";
import { useCartStore, type BundleCartItem } from "@/store/cartStore";
import type { ChatPackage, ChatProduct } from "./AIChatSheet";

const fa = (n: number | undefined): string => Number(n || 0).toLocaleString("fa-IR");

function formatFaPrice(n: number | undefined): string {
    return Number(n || 0).toLocaleString("fa-IR");
}

function resolveChatImage(src: string | undefined): string {
    if (!src || !src.trim()) return "/placeholder.svg";
    const s = src.trim();
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("/")) {
        try {
            const base =
                (typeof process !== "undefined" &&
                    (process as unknown as { env?: Record<string, string> })?.env?.NEXT_PUBLIC_API_URL) ||
                "https://www.ekgkala.ir/api";
            return `${String(base).replace(/\/api\/?$/, "")}${s}`;
        } catch {
            return s;
        }
    }
    return s;
}

/** ساخت برچسب‌های خلاصه از محاسبات قطعی موتور + اقلام */
function buildBadges(pkg: ChatPackage): string[] {
    const badges: string[] = [];
    const anyPkg = pkg as unknown as {
        requirements?: {
            camerasCount?: number;
            nightVision?: string;
            environment?: string;
            retentionDays?: number;
            tech?: string;
            resolution?: string;
        };
        calculations?: {
            storage?: { requiredTb?: number; hddPlan?: { drives?: Array<{ capacityGb: number; qty: number }> } };
            cable?: { totalMeters?: number; cableKind?: string };
            power?: { supplyAmps?: number; switchPorts?: number; recommendedSupply?: string };
            recorder?: { channelsRecommended?: number };
        };
    };
    const req = anyPkg.requirements || {};
    const calc = anyPkg.calculations || {};

    if (req.camerasCount) {
        const form =
            req.environment === "indoor"
                ? "سقفی"
                : req.environment === "mixed"
                    ? "ترکیبی"
                    : "بولت";
        badges.push(`${fa(req.camerasCount)} دوربین ${form}`);
    }

    const hdd = calc.storage?.hddPlan?.drives?.[0];
    if (hdd?.capacityGb) {
        const tb = hdd.capacityGb / 1000;
        const label = tb >= 1 ? `${fa(Math.round(tb * 10) / 10)} ترابایت` : `${fa(hdd.capacityGb)} گیگ`;
        badges.push(`هارد ${label} بنفش`);
    } else if (calc.storage?.requiredTb) {
        badges.push(`هارد ${fa(calc.storage.requiredTb)} ترابایت`);
    }

    if (calc.cable?.totalMeters) {
        badges.push(`${fa(calc.cable.totalMeters)} متر کابل`);
    }

    if (calc.power?.supplyAmps) {
        badges.push(`پاور صنعتی ${fa(calc.power.supplyAmps)} آمپر`);
    } else if (calc.power?.switchPorts) {
        badges.push(`سوئیچ ${fa(calc.power.switchPorts)} پورت`);
    }

    if (calc.recorder?.channelsRecommended) {
        badges.push(`دستگاه ${fa(calc.recorder.channelsRecommended)} کانال`);
    }

    // fallback از عنوان بخش‌ها
    if (badges.length === 0) {
        for (const sec of pkg.sections.slice(0, 4)) {
            const opt = sec.options.find((o) => o.id === sec.defaultId) || sec.options[0];
            const qty = (sec as unknown as { recommendedQty?: number })?.recommendedQty || 1;
            if (opt) badges.push(qty > 1 ? `${fa(qty)}× ${sec.title}` : sec.title);
        }
    }

    return badges.slice(0, 5);
}

function extractLines(pkg: ChatPackage): Array<{ key: string; title: string; opt: ChatProduct; qty: number }> {
    const out: Array<{ key: string; title: string; opt: ChatProduct; qty: number }> = [];
    for (const sec of pkg.sections) {
        const def =
            sec.options.find((o) => o.id === sec.defaultId && o.inStock) ||
            sec.options.find((o) => o.inStock) ||
            sec.options[0];
        if (!def) continue;
        const qty = Math.max(
            1,
            Number((sec as unknown as { recommendedQty?: number })?.recommendedQty) ||
            Number((def as unknown as { recommendedQty?: number })?.recommendedQty) ||
            1,
        );
        out.push({ key: sec.key, title: sec.title, opt: def, qty });
    }
    return out;
}

function toBundleItem(opt: ChatProduct, qty: number): BundleCartItem {
    return {
        productId: String(opt.id),
        quantity: qty,
        price: Number(opt.price) || 0,
        name: opt.name,
        title: opt.name,
        image: resolveChatImage(opt.image),
        oldPrice: opt.oldPrice,
        discount: 0,
        variantOptions: opt.defaultVariantOptions,
    };
}

interface ChatPackageCardProps {
    pkg: ChatPackage;
    /** ناوبری به سبد خرید بعد از موفقیت */
    onViewCart?: () => void;
}

/**
 * کارت پیش‌فاکتور پکیج — نمایش نهایی اقلام + دکمه «افزودن کامل پکیج به سبد خرید»
 */
export default function ChatPackageCard({ pkg, onViewCart }: ChatPackageCardProps) {
    const addBundleToCart = useCartStore((s) => s.addBundleToCart);

    const lines = useMemo(() => extractLines(pkg), [pkg]);
    const badges = useMemo(() => buildBadges(pkg), [pkg]);

    const totalPrice = useMemo(() => {
        const fromPkg = Number((pkg as unknown as { totalPrice?: number }).totalPrice) || 0;
        if (fromPkg > 0) return fromPkg;
        return lines.reduce((s, l) => s + Number(l.opt.price || 0) * l.qty, 0);
    }, [pkg, lines]);

    const oldTotal = useMemo(() => {
        return lines.reduce((s, l) => {
            const base = Number(l.opt.oldPrice || 0);
            return base > Number(l.opt.price || 0) ? s + base * l.qty : s;
        }, 0);
    }, [lines]);

    const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

    const handleAddAll = async () => {
        if (state === "loading" || lines.length === 0) return;
        setState("loading");
        try {
            const result = await addBundleToCart(lines.map((l) => toBundleItem(l.opt, l.qty)));
            if (result.ok || result.addedCount > 0) {
                setState("done");
            } else {
                setState("error");
            }
        } catch {
            setState("error");
        }
    };

    return (
        <div
            dir="rtl"
            className="w-full rounded-2xl border border-gray-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-500"
        >
            {/* هدر */}
            <div className="px-4 pt-4 pb-3 bg-gradient-to-l from-emerald-600 via-emerald-500 to-teal-500 text-white">
                <div className="flex items-start gap-2">
                    <Package size={18} className="shrink-0 mt-0.5 opacity-90" />
                    <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-black leading-6 line-clamp-2">{pkg.title || "پکیج کامل دوربین مداربسته"}</h3>
                        <p className="text-[10px] font-medium text-white/80 mt-0.5">
                            پیش‌فاکتور قطعی · محاسبه‌شده از موتور فنی
                        </p>
                    </div>
                </div>

                {/* نوار تگ‌ها */}
                {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {badges.map((b, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center px-2 py-1 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold text-white backdrop-blur-sm"
                            >
                                {b}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* لیست اقلام */}
            <ul className="divide-y divide-gray-100 px-1">
                {lines.map((l) => (
                    <li key={l.key} className="flex items-center gap-2.5 px-3 py-2.5">
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={resolveChatImage(l.opt.image)}
                                alt={l.opt.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                                }}
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-gray-800 leading-5 line-clamp-2">{l.opt.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{l.title}</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-0.5">
                            <span className="text-[10px] font-black text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                                ×{fa(l.qty)}
                            </span>
                            <span className="text-[11px] font-black text-gray-900">
                                {formatFaPrice(Number(l.opt.price || 0) * l.qty)}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>

            {/* قیمت */}
            <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100">
                {oldTotal > totalPrice && (
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                            <BadgePercent size={12} />
                            قیمت کل بدون تخفیف
                        </span>
                        <span className="text-[12px] text-gray-400 line-through">{formatFaPrice(oldTotal)}</span>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-gray-600">جمع پکیج ({fa(lines.length)} قلم)</span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-[18px] font-black text-gray-900">{formatFaPrice(totalPrice)}</span>
                        <span className="text-[10px] font-medium text-gray-500">تومان</span>
                    </div>
                </div>
            </div>

            {/* اکشن */}
            <div className="px-3 pb-3 pt-1 space-y-2">
                {state !== "done" ? (
                    <button
                        type="button"
                        onClick={handleAddAll}
                        disabled={state === "loading" || lines.length === 0}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-[13px] font-black shadow-[0_4px_14px_rgba(16,185,129,0.35)] transition-all active:scale-[0.98] cursor-pointer"
                    >
                        {state === "loading" ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                در حال افزودن به سبد…
                            </>
                        ) : (
                            <>
                                <ShoppingCart size={16} />
                                افزودن تمام پکیج به سبد خرید
                            </>
                        )}
                    </button>
                ) : (
                    <>
                        <div className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-black">
                            <Check size={16} className="text-emerald-600" />
                            پکیج به سبد اضافه شد ✓
                        </div>
                        <Link
                            href="/cart"
                            onClick={onViewCart}
                            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-800 text-[12px] font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            مشاهده سبد و تسویه حساب
                            <ChevronLeft size={14} />
                        </Link>
                    </>
                )}

                {state === "error" && (
                    <p className="text-[10px] text-red-600 text-center font-medium">
                        افزودن ناقص ماند. لطفاً دوباره تلاش کنید.
                    </p>
                )}
            </div>
        </div>
    );
}
