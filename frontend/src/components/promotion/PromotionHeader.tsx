import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type PromotionHeaderProps = {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  countdown?: ReactNode;
};

export default function PromotionHeader({
  title,
  description,
  actionHref,
  actionLabel,
  countdown,
}: PromotionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 space-y-1.5 text-right">
        <h2 className="text-lg font-bold text-ekg-900 md:text-xl">
          {title}
        </h2>
        <p className="max-w-2xl text-xs font-medium leading-6 text-ekg-600 md:text-sm">
          {description}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center md:justify-end">
        {countdown}
        <Link
          href={actionHref}
          className="inline-flex items-center justify-center gap-1 rounded-full border border-kala-200 bg-white/80 px-3 py-2 text-xs font-bold text-kala-700 shadow-sm transition-colors hover:border-kala-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-kala-200"
        >
          <span>{actionLabel}</span>
          <ChevronLeft size={14} />
        </Link>
      </div>
    </div>
  );
}
