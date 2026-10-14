type PromotionBadgeTone = "timed" | "curated" | "limited" | "campaign" | "discount" | "neutral";

type PromotionBadgeProps = {
  label: string;
  tone?: PromotionBadgeTone;
};

const toneClassNames: Record<PromotionBadgeTone, string> = {
  timed: "legacy-grad-timed border-transparent bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 text-white shadow-sm",
  curated: "border-ekg-200 bg-ekg-50 text-ekg-700",
  limited: "border-red-200 bg-red-50 text-red-600",
  campaign: "border-blue-100 bg-blue-50 text-blue-700",
  discount: "border-kala-200 bg-white text-kala-700",
  neutral: "border-gray-200 bg-white text-gray-600",
};

export default function PromotionBadge({ label, tone = "neutral" }: PromotionBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold leading-none whitespace-nowrap ${toneClassNames[tone]}`}>
      {label}
    </span>
  );
}
