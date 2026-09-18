"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, Package, ShoppingCart, Loader2, CircleAlert } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import type { Product } from "@/services/productService";
import type { ChatPackage, ChatProduct } from "./AIChatSheet";

function img(src: string | undefined): string {
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

const fa = (n: number | undefined): string => Number(n || 0).toLocaleString("fa-IR");

/** نگاشت گزینه چت به مدل Product برای سبد — قیمت از قبل نهایی است پس discount صفر تا دوباره تخفیف نخورد */
function toCartProduct(o: ChatProduct): Product {
    const image = img(o.image);
    return {
        id: o.id,
        name: o.name,
        title: o.name,
        slug: o.slug,
        productCode: o.productCode,
        price: Number(o.price) || 0,
        oldPrice: o.oldPrice,
        discount: 0,
        image,
        images: [image],
        category: o.category || "عمومی",
        rating: Number(o.rating) || 0,
        reviewCount: Number(o.reviewCount) || 0,
        countInStock: Number(o.countInStock) || 0,
    } as Product;
}

type SectionState = Record<string, { selectedId: string; qty: number; enabled: boolean }>;

export default function ChatPackageBuilder({ pkg }: { pkg: ChatPackage }) {
    const addToCart = useCartStore((s) => s.addToCart);

    const initial = useMemo<SectionState>(() => {
        const s: SectionState = {};
        for (const sec of pkg.sections) {
            const def = sec.options.find((o) => o.id === sec.defaultId && o.inStock) || sec.options.find((o) => o.inStock) || sec.options[0];
            s[sec.key] = { selectedId: def?.id || "", qty: 1, enabled: true };
        }
        return s;
    }, [pkg]);

    const [state, setState] = useState<SectionState>(initial);
    const [adding, setAdding] = useState(false);
    const [failed, setFailed] = useState<string[]>([]);
    const [succeeded, setSucceeded] = useState(false);

    const setSel = (key: string, selectedId: string) =>
        setState((p) => ({ ...p, [key]: { ...p[key], selectedId, qty: 1 } }));
    const setQty = (key: string, qty: number, max: number) =>
        setState((p) => ({ ...p, [key]: { ...p[key], qty: Math.min(Math.max(1, qty), Math.max(1, max)) } }));
    const setEnabled = (key: string, enabled: boolean) =>
        setState((p) => ({ ...p, [key]: { ...p[key], enabled } }));

    const lines = useMemo(() => {
        const out: Array<{ sec: (typeof pkg.sections)[number]; opt: ChatProduct; qty: number }> = [];
        for (const sec of pkg.sections) {
            const st = state[sec.key];
            if (!st?.enabled) continue;
            const opt = sec.options.find((o) => o.id === st.selectedId);
            if (!opt || !opt.inStock) continue;
            out.push({ sec, opt, qty: st.qty });
        }
        return out;
    }, [pkg, state]);

    const total = lines.reduce((s, l) => s + Number(l.opt.price || 0) * l.qty, 0);
    const totalCount = lines.reduce((s, l) => s + l.qty, 0);

    const handleAddAll = async () => {
        if (adding || lines.length === 0) return;
        setAdding(true);
        setFailed([]);
        setSucceeded(false);
        const bad: string[] = [];
        for (const l of lines) {
            try {
                await addToCart(toCartProduct(l.opt), l.qty, l.opt.defaultVariantOptions || undefined);
            } catch {
                bad.push(l.opt.name);
            }
        }
        setFailed(bad);
        setAdding(false);
        if (bad.length === 0) setSucceeded(true);
    };

    return (
        <div className="w-full rounded-2xl border border-kala-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* سربرگ بسته */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-l from-kala-500 to-kala-600 text-white">
                <Package size={16} className="shrink-0" />
                <span className="text-[13px] font-black truncate">{pkg.title}</span>
                <span className="mr-auto text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                    {pkg.sections.length} بخش
                </span>
            </div>

            <div className="flex flex-col gap-3 p-3">
                {pkg.sections.map((sec) => {
                    const st = state[sec.key];
                    const selected = sec.options.find((o) => o.id === st?.selectedId);
                    const maxQty = Math.min(Number(selected?.countInStock) || 1, 99);
                    return (
                        <div key={sec.key} className={`rounded-xl border ${st?.enabled ? "border-gray-200" : "border-dashed border-gray-200 bg-gray-50/60"} p-2.5`}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <button
                                    onClick={() => setEnabled(sec.key, !st?.enabled)}
                                    aria-label={st?.enabled ? `حذف ${sec.title} از پک` : `افزودن ${sec.title} به پک`}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer ${st?.enabled ? "bg-kala-500 border-kala-500 text-white" : "bg-white border-gray-300 text-transparent"}`}
                                >
                                    <Check size={13} strokeWidth={3} />
                                </button>
                                <span className={`text-[12px] font-black ${st?.enabled ? "text-gray-800" : "text-gray-400"}`}>
                                    {sec.title}
                                </span>
                                {sec.optional && (
                                    <span className="text-[9px] font-bold text-gray-400 border border-gray-200 rounded-full px-1.5 py-px">اختیاری</span>
                                )}
                            </div>
                            {sec.hint && st?.enabled && (
                                <p className="text-[10px] text-gray-400 leading-4 mb-2">{sec.hint}</p>
                            )}

                            {st?.enabled && (
                                <div className="flex flex-col gap-1.5">
                                    {sec.options.map((o) => {
                                        const isSel = o.id === st.selectedId;
                                        const disabled = !o.inStock;
                                        return (
                                            <button
                                                key={o.id}
                                                disabled={disabled}
                                                onClick={() => setSel(sec.key, o.id)}
                                                className={`flex items-center gap-2 p-1.5 rounded-xl border text-right transition-all cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-100" : isSel ? "border-kala-500 bg-kala-50/60 shadow-sm" : "bg-white hover:border-kala-300 border-gray-200"}`}
                                            >
                                                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSel ? "border-kala-500" : "border-gray-300"}`}>
                                                    {isSel && <span className="w-2 h-2 rounded-full bg-kala-500" />}
                                                </span>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={img(o.image)}
                                                    alt={o.name}
                                                    className="w-11 h-11 rounded-lg object-cover bg-gray-50 shrink-0"
                                                    loading="lazy"
                                                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                                                />
                                                <span className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-[11px] font-bold text-gray-800 leading-4 line-clamp-1">{o.name}</span>
                                                    <span className="text-[10px] text-gray-400 truncate">
                                                        {(o.brand ? o.brand + " • " : "") + (o.specs?.[0] ? `${o.specs[0].label}: ${o.specs[0].value}` : o.category || "")}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[11px] font-black text-gray-900">{fa(o.price)} <span className="text-[9px] font-medium text-gray-500">تومان</span></span>
                                                        {o.oldPrice && o.oldPrice > o.price && (
                                                            <span className="text-[9px] text-gray-400 line-through">{fa(o.oldPrice)}</span>
                                                        )}
                                                    </span>
                                                </span>
                                                <span className="flex flex-col items-end gap-1 shrink-0">
                                                    {o.id === sec.defaultId && !disabled && (
                                                        <span className="text-[8px] font-black text-kala-700 bg-kala-100 rounded-full px-1.5 py-px whitespace-nowrap">پیشنهاد هوش مصنوعی</span>
                                                    )}
                                                    <span className={`text-[9px] font-bold px-1.5 py-px rounded-full whitespace-nowrap ${o.inStock ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                                        {o.inStock ? `موجود (${fa(o.countInStock)})` : "ناموجود"}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}

                                    {/* تعداد */}
                                    {selected?.inStock && (
                                        <div className="flex items-center justify-between mt-1 pr-6">
                                            <span className="text-[10px] text-gray-500 font-medium">تعداد</span>
                                            <span className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setQty(sec.key, st.qty + 1, maxQty)}
                                                    disabled={st.qty >= maxQty}
                                                    aria-label="افزایش تعداد"
                                                    className="w-6 h-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-kala-400 disabled:opacity-40 cursor-pointer"
                                                >
                                                    <Plus size={12} />
                                                </button>
                                                <span className="text-[12px] font-black text-gray-800 min-w-[1.5rem] text-center">{fa(st.qty)}</span>
                                                <button
                                                    onClick={() => setQty(sec.key, st.qty - 1, maxQty)}
                                                    disabled={st.qty <= 1}
                                                    aria-label="کاهش تعداد"
                                                    className="w-6 h-6 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:border-kala-400 disabled:opacity-40 cursor-pointer"
                                                >
                                                    <Minus size={12} />
                                                </button>
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {pkg.missing && pkg.missing.length > 0 && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 leading-5">
                        فعلاً بدون موجودی: {pkg.missing.join("، ")} — به‌محض شارژ می‌توانید جداگانه اضافه کنید.
                    </p>
                )}

                {/* جمع کل + افزودن همه */}
                <div className="rounded-xl bg-gray-900 text-white p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-gray-300">جمع پک ({fa(totalCount)} قلم)</span>
                        <span className="text-[15px] font-black">{fa(total)} <span className="text-[10px] font-medium text-gray-300">تومان</span></span>
                    </div>
                    <button
                        onClick={handleAddAll}
                        disabled={adding || lines.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-kala-500 hover:bg-kala-600 text-white text-[13px] font-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {adding ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                در حال افزودن به سبد...
                            </>
                        ) : (
                            <>
                                <ShoppingCart size={16} />
                                افزودن همه به سبد خرید
                            </>
                        )}
                    </button>
                    {succeeded && (
                        <div className="flex flex-col gap-2 rounded-xl bg-green-500/15 border border-green-400/30 p-2.5 animate-in fade-in duration-300">
                            <span className="flex items-center gap-1.5 text-[11px] font-bold text-green-300">
                                <Check size={14} strokeWidth={3} />
                                همه اقلام تأییدشده به سبد خرید اضافه شد
                            </span>
                            <Link
                                href="/cart"
                                className="text-center py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-[12px] font-black transition-all"
                            >
                                مشاهده سبد خرید و تکمیل خرید
                            </Link>
                        </div>
                    )}
                    {failed.length > 0 && (
                        <p className="flex items-start gap-1.5 text-[10px] leading-5 text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-2.5 py-1.5">
                            <CircleAlert size={13} className="shrink-0 mt-0.5" />
                            افزودن این اقلام ناموفق بود، دوباره تلاش کنید: {failed.join("، ")}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
