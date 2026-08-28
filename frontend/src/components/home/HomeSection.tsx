import type { ReactNode } from "react";

/**
 * Homepage section frame.
 * ============================================================================
 * The previous version delegated to a `home-section.tokens.ts` module whose
 * container and background strategies both resolved to `""`, and whose spacing
 * scale was `py-0.5 / py-1 / py-2`. Two consequences:
 *
 *   1. Every child component owned its own container and its own horizontal
 *      padding, so no two sections had aligned vertical edges. That misalignment
 *      is the single biggest reason the page read as "a stack of widgets".
 *   2. With 2–8px between sections and a `border-b` on most children, the page
 *      was a run of hairlines with no breathing room and no grouping.
 *
 * So this now does the two things a section frame should actually do: own the
 * content measure, and own the vertical rhythm. The token indirection is gone —
 * an abstraction that maps three inputs to empty strings costs more than it
 * saves.
 *
 * Tone assignment is what creates the page's shape. Alternating sunken and
 * plain surfaces groups related sections into bands, so the eye gets landmarks
 * on the way down instead of an undifferentiated scroll.
 */

type HomeSectionTone =
    /** White. The default resting surface. */
    | "plain"
    /** Faint navy-tinted grey. Groups a section apart without a border. */
    | "sunken"
    /** Deep navy, light text. Reserved for the closing brand statement. */
    | "inverse";

type HomeSectionProps = {
    children: ReactNode;
    tone?: HomeSectionTone;
    /** Skip the content shell for full-bleed children (the hero). */
    bleed?: boolean;
    /** Tightens vertical padding for short, dense sections. */
    compact?: boolean;
    /** Accessible name, so the section becomes a real landmark. */
    label?: string;
    /** Or point at an existing heading's id instead of duplicating its text. */
    labelledBy?: string;
};

const TONE_CLASS: Record<HomeSectionTone, string> = {
    plain: "bg-surface",
    sunken: "bg-surface-sunken",
    inverse: "bg-surface-inverse text-ink-inverse",
};

export default function HomeSection({
    children,
    tone = "plain",
    bleed = false,
    compact = false,
    label,
    labelledBy,
}: HomeSectionProps) {
    return (
        <section
            aria-label={labelledBy ? undefined : label}
            aria-labelledby={labelledBy}
            className={[
                // `empty:hidden` matters: several children legitimately render
                // null (no active flash deals, no brands configured). Without
                // it the page would show bands of empty padding.
                "w-full empty:hidden",
                TONE_CLASS[tone],
                compact ? "py-6 md:py-8" : "py-8 md:py-12",
            ].join(" ")}
        >
            {bleed ? children : <div className="page-shell">{children}</div>}
        </section>
    );
}
