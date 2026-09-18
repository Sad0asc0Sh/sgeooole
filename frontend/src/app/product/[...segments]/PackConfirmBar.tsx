"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, ArrowRight, Package, TriangleAlert } from "lucide-react";
import api from "@/lib/api";

interface WizardLite {
    active: boolean;
    complete: boolean;
    title: string;
    currentIndex: number;
    progress: { done: number; total: number };
}

interface StateData {
    wizard: (WizardLite & { phase?: string }) | null;
    validForStep: { ok: boolean; reason?: string; name?: string } | null;
    stepTitle: string;
}

export default function PackConfirmBar({ productId }: { productId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromPack = searchParams.get("pack") === "1";

    const [state, setState] = useState<StateData | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!fromPack) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get("/chat/pack/state", { params: { productId } });
                if (!cancelled) setState(res.data?.data || null);
            } catch {
                if (!cancelled) setState(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [fromPack, productId]);

    if (!fromPack || loading || !state?.wizard?.active) return null;

    const valid = state.validForStep?.ok === true;

    const handleConfirm = async () => {
        if (confirming) return;
        setConfirming(true);
        setError(null);
        try {
            const res = await api.post("/chat/pack/action", { action: "select", productId });
            const d = res.data?.data;
            if (!res.data?.success) throw new Error(res.data?.message || "خطا در ثبت انتخاب");
            // تحویل به چت: بعد از بازگشت، پیام‌ها الصاق و شیت باز می‌شود
            try {
                sessionStorage.setItem("ekg_pack_pending", JSON.stringify({
                    userMessage: d?.userMessage || "",
                    message: d?.message || "",
                    wizard: d?.wizard || null,
                    package: d?.package || null,
                    usage: d?.usage || null,
                }));
            } catch { /* ignore */ }
            router.back();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "خطا در ثبت انتخاب. لطفاً دوباره تلاش کنید.";
            setError(msg);
            setConfirming(false);
        }
    };

    const handleBack = () => router.back();

    return (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-3" style={{ paddingBottom: "calc(var(--bottom-nav-total-height, 0px) + 0.75rem)" }}>
            <div className="mx-auto max-w-2xl rounded-2xl border border-kala-200 bg-white/95 backdrop-blur shadow-[0_8px_30px_rgba(0,0,0,0.15)] p-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 mb-2">
                    <Package size={15} className="text-kala-600 shrink-0" />
                    <span className="text-[12px] font-black text-gray-800 truncate">
                        {state.wizard.title} — قدم «{state.stepTitle}»
                    </span>
                </div>

                {valid ? (
                    <p className="text-[11px] text-gray-500 leading-5 mb-2">
                        این کالا برای همین قدم مناسب است. با «تأیید نهایی» به پک اضافه می‌شود و قدم بعدی باز می‌گردد.
                    </p>
                ) : (
                    <p className="flex items-start gap-1.5 text-[11px] leading-5 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 mb-2">
                        <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                        {state.validForStep?.reason || "این کالا برای قدم فعلی مناسب نیست."}
                    </p>
                )}

                {error && (
                    <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-2.5 py-1.5 mb-2">{error}</p>
                )}

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-[12px] font-bold hover:border-gray-400 transition-all cursor-pointer"
                    >
                        <ArrowRight size={14} />
                        بازگشت
                    </button>
                    {valid && (
                        <button
                            onClick={handleConfirm}
                            disabled={confirming}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-kala-500 hover:bg-kala-600 text-white text-[13px] font-black transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                        >
                            {confirming ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    در حال ثبت...
                                </>
                            ) : (
                                <>
                                    <Check size={15} strokeWidth={3} />
                                    تأیید نهایی و ادامه پک
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
