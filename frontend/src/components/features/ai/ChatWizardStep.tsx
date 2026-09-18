"use client";

import { Check, Package, RotateCcw, ArrowRight, Forward, Loader2, BadgeCheck } from "lucide-react";
import type { ChatProduct } from "./AIChatSheet";

export interface ChatWizardOption extends ChatProduct {
    priceUpdatedAt?: string | null;
    priceUpdateCount?: number;
}

export interface ChatWizardStepView {
    key: string;
    title: string;
    hint?: string;
    optional?: boolean;
    status: string;
    options: ChatWizardOption[];
}

export interface ChatWizardSelection {
    stepKey: string;
    stepTitle: string;
    product: ChatProduct;
    qty: number;
}

export interface ChatWizard {
    active: boolean;
    complete: boolean;
    phase?: "needs" | "steps";
    domainId: string;
    title: string;
    steps: Array<{ key: string; title: string; optional?: boolean; status: string }>;
    currentIndex: number;
    current: ChatWizardStepView | null;
    selections: ChatWizardSelection[];
    missing?: string[];
    needsQuestions?: string[];
    needsRemaining?: number;
    progress: { done: number; total: number };
}

type PackAction = "skip-needs" | "skip" | "back" | "restart";

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

function FreshBadge({ count }: { count?: number }) {
    if (!count || count <= 0) return null;
    return (
        <span className="inline-flex items-center gap-0.5 text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-px whitespace-nowrap">
            <BadgeCheck size={10} />
            قیمت به‌روز
        </span>
    );
}

interface Props {
    wizard: ChatWizard;
    disabled?: boolean;
    loading?: boolean;
    onAction: (action: PackAction) => void;
    onNavigate: (url: string) => void;
}

export default function ChatWizardStep({ wizard, disabled, loading, onAction, onNavigate }: Props) {
    const stepNo = Math.min(wizard.currentIndex + 1, wizard.progress.total);
    const pct = wizard.progress.total > 0 ? Math.round((wizard.progress.done / wizard.progress.total) * 100) : 0;
    const busy = Boolean(disabled || loading);
    const cur = wizard.current;

    return (
        <div className="w-full rounded-2xl border border-kala-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* سربرگ + پیشرفت */}
            <div className="px-3.5 pt-2.5 pb-2 bg-gradient-to-l from-kala-500 to-kala-600 text-white">
                <div className="flex items-center gap-2">
                    <Package size={16} className="shrink-0" />
                    <span className="text-[13px] font-black truncate">{wizard.title}</span>
                    <span className="mr-auto text-[10px] font-bold bg-white/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                        {wizard.phase === "needs" ? "نیازسنجی" : `مرحله ${fa(stepNo)} از ${fa(wizard.progress.total)}`}
                    </span>
                    <button
                        onClick={() => onAction("restart")}
                        disabled={busy}
                        title="شروع دوباره پک"
                        className="p-1.5 rounded-full bg-white/15 hover:bg-white/30 transition-all disabled:opacity-40 cursor-pointer"
                    >
                        <RotateCcw size={13} />
                    </button>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
            </div>

            <div className="flex flex-col gap-2.5 p-3">
                {/* تأییدشده‌ها */}
                {wizard.selections.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-xl bg-green-50/70 border border-green-200/70 p-2">
                        {wizard.selections.map((s) => (
                            <span key={s.stepKey} className="flex items-center gap-1.5 text-[10px] font-bold text-green-800">
                                <Check size={12} strokeWidth={3} className="shrink-0 text-green-600" />
                                <span className="text-green-600 shrink-0">{s.stepTitle}:</span>
                                <span className="truncate">{s.product.name}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* فاز نیازسنجی: هنوز گزینه‌ای نیست — اول سوال‌ها در چت */}
                {wizard.phase === "needs" || (!cur && !wizard.complete) ? (
                    <div className="rounded-xl border border-dashed border-kala-300 bg-kala-50/50 p-3 flex flex-col gap-2">
                        <span className="text-[12px] font-black text-gray-800">اول چند سوال کوتاه تا دقیق‌ترین گزینه‌ها را بیاورم</span>
                        {(wizard.needsQuestions || []).length > 0 && (
                            <ul className="flex flex-col gap-1">
                                {(wizard.needsQuestions || []).map((q, i) => (
                                    <li key={i} className="text-[10px] text-gray-500 leading-4">• {q}</li>
                                ))}
                            </ul>
                        )}
                        <span className="text-[10px] text-gray-400">پاسخ‌ها را در همین چت بنویس (دکمه‌های آماده هم هست).</span>
                        <button
                            onClick={() => onAction("skip-needs")}
                            disabled={busy}
                            className="self-start text-[10px] font-bold text-kala-600 border border-kala-200 rounded-lg px-2.5 py-1.5 hover:bg-kala-50 transition-all disabled:opacity-40 cursor-pointer"
                        >
                            رد شدن از سوالات و نمایش گزینه‌ها
                        </button>
                    </div>
                ) : null}

                {/* مرحله فعلی */}
                {cur ? (
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] font-black text-gray-800">{cur.title}</span>
                            {cur.optional && (
                                <span className="text-[9px] font-bold text-gray-400 border border-gray-200 rounded-full px-1.5 py-px">اختیاری</span>
                            )}
                        </div>
                        {cur.hint && <p className="text-[10px] text-gray-400 leading-4 mb-2">{cur.hint}</p>}

                        <div className="flex flex-col gap-1.5">
                            {cur.options.map((o, i) => {
                                const out = !o.inStock;
                                return (
                                    <div
                                        key={o.id}
                                        className={`flex items-center gap-2 p-1.5 rounded-xl border bg-white ${out ? "opacity-55 border-gray-100" : "border-gray-200"}`}
                                    >
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
                                            <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                <span className="text-[11px] font-black text-gray-900">{fa(o.price)} <span className="text-[9px] font-medium text-gray-500">تومان</span></span>
                                                {o.oldPrice && o.oldPrice > o.price && (
                                                    <span className="text-[9px] text-gray-400 line-through">{fa(o.oldPrice)}</span>
                                                )}
                                                <FreshBadge count={o.priceUpdateCount} />
                                            </span>
                                            {i === 0 && !out && (
                                                <span className="text-[9px] font-bold text-kala-600">مرتب اول: تازه‌ترین قیمت</span>
                                            )}
                                        </span>
                                        <span className="flex flex-col items-stretch gap-1 shrink-0">
                                            <span className={`text-[9px] font-bold px-1.5 py-px rounded-full whitespace-nowrap text-center ${o.inStock ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                                {o.inStock ? `موجود (${fa(o.countInStock)})` : "ناموجود"}
                                            </span>
                                            <button
                                                onClick={() => onNavigate(`${o.url}?pack=1`)}
                                                disabled={busy || out}
                                                className="text-[10px] font-black text-center text-white bg-kala-500 rounded-lg px-2 py-1 hover:bg-kala-600 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
                                            >
                                                {loading ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={3} />}
                                                مشاهده و انتخاب
                                            </button>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                            {wizard.currentIndex > 0 && (
                                <button
                                    onClick={() => onAction("back")}
                                    disabled={busy}
                                    className="flex items-center gap-1 text-[10px] font-bold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:border-gray-400 transition-all disabled:opacity-40 cursor-pointer"
                                >
                                    <ArrowRight size={11} />
                                    مرحله قبل
                                </button>
                            )}
                            {cur.optional && (
                                <button
                                    onClick={() => onAction("skip")}
                                    disabled={busy}
                                    className="flex items-center gap-1 text-[10px] font-bold text-gray-500 border border-dashed border-gray-300 rounded-lg px-2.5 py-1.5 hover:border-gray-400 transition-all disabled:opacity-40 cursor-pointer"
                                >
                                    <Forward size={11} />
                                    رد شدن از این مرحله
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="text-[11px] text-gray-500 leading-5">همه مرحله‌ها تمام شد؛ بسته نهایی پایین نمایش داده می‌شود.</p>
                )}
            </div>
        </div>
    );
}
