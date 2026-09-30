type PromotionBadgeTone = "timed" | "curated" | "limited" | "campaign" | "discount" | "neutral";

type PromotionBadgeProps = {
  label: string;
  tone?: PromotionBadgeTone;
  /** فونت سیال: متناسب با عرض کانتینر کوئری والد، خودش کوچک/بزرگ می‌شود */
  fluid?: boolean;
};

const toneClassNames: Record<PromotionBadgeTone, string> = {
  timed: "border-transparent bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-white shadow-sm",
  curated: "border-ekg-200 bg-ekg-50 text-ekg-700",
  limited: "border-red-200 bg-red-50 text-red-600",
  campaign: "border-blue-100 bg-blue-50 text-blue-700",
  discount: "border-kala-200 bg-white text-kala-700",
  neutral: "border-gray-200 bg-white text-gray-600",
};

export default function PromotionBadge({ label, tone = "neutral", fluid = false }: PromotionBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border font-bold leading-none whitespace-nowrap ${fluid ? "max-w-full overflow-hidden text-ellipsis px-[0.8em] py-[0.45em] text-[clamp(7px,5cqi,10px)]" : "px-2 py-1 text-[10px]"} ${toneClassNames[tone]}`}>
      {label}
    </span>
  );
}
