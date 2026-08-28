import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * The storefront's single section header.
 * ============================================================================
 * Replaces two headers that gave the same page two visual personalities:
 *
 *   - `SectionTitle`, which drew a skewed translucent gold bar *behind* the
 *     text like a highlighter pen. On a technical store that reads as novelty,
 *     and against Persian descenders it clipped the text.
 *   - `PromotionHeader`, a separate, better-structured header used only by the
 *     promotion rails — so promotion sections and product sections looked like
 *     they came from two different sites.
 *
 * Hierarchy here comes from weight, size and a single 3px inline-start rule.
 * That rule is the one piece of consistent brand furniture on the page, and it
 * is directional (start edge), so it reinforces RTL reading order instead of
 * fighting it.
 */

type SectionHeaderProps = {
    title: string;
    /** One factual sentence. Optional — silence is better than filler. */
    description?: string;
    actionHref?: string;
    actionLabel?: string;
    /** Countdown or other live status, rendered next to the action. */
    aside?: ReactNode;
    /** `h2` by default; `h3` when nested inside another titled section. */
    as?: "h2" | "h3";
    /** Ties the heading to its scroll region via aria-labelledby. */
    id?: string;
};

export default function SectionHeader({
    title,
    description,
    actionHref,
    actionLabel,
    aside,
    as: Heading = "h2",
    id,
}: SectionHeaderProps) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 border-s-[3px] border-kala-500 ps-3">
                <Heading
                    id={id}
                    className="text-balance text-[17px] font-bold leading-7 text-ink md:text-[19px]"
                >
                    {title}
                </Heading>
                {description ? (
                    <p className="mt-1 max-w-xl text-[12px] leading-6 text-ink-subtle md:text-[13px]">
                        {description}
                    </p>
                ) : null}
            </div>

            {aside || (actionHref && actionLabel) ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                    {aside}
                    {actionHref && actionLabel ? (
                        <Link
                            href={actionHref}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-kala-700"
                        >
                            <span>{actionLabel}</span>
                            {/* RTL: "forward" points to the inline-end, i.e. left. */}
                            <ChevronLeft size={14} aria-hidden="true" />
                        </Link>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
