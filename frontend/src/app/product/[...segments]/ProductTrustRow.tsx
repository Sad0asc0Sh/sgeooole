import { Truck, Headphones, RotateCcw, ShieldCheck } from "lucide-react";

const TRUST_ITEMS = [
    { icon: Truck, label: "امکان تحویل اکسپرس" },
    { icon: Headphones, label: "۲۴ ساعته، ۷ روز هفته" },
    { icon: RotateCcw, label: "هفت روز ضمانت بازگشت کالا" },
    { icon: ShieldCheck, label: "ضمانت اصل بودن کالا" },
] as const;

/**
 * Four-service trust row (mobile140 PDP style).
 * 2 columns on small phones, 4 columns from sm up.
 */
export default function ProductTrustRow() {
    return (
        <section aria-label="خدمات خرید" className="border-t border-gray-100 px-3 pt-4 pb-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center justify-center gap-2 py-2">
                        <Icon size={40} strokeWidth={1.4} className="text-gray-400" aria-hidden />
                        <span className="text-center text-xs font-bold text-gray-500 leading-5">{label}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
