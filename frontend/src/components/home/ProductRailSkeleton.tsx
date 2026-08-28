/**
 * Loading placeholder for a product rail.
 * ============================================================================
 * Extracted because the homepage previously defined four different rail
 * skeletons — one inline in `page.tsx`, one in `ProductRailContainer`, plus two
 * ad-hoc `animate-pulse h-48 bg-white rounded-xl mx-4` divs. None matched the
 * real rail's geometry, so every section visibly jumped when data arrived.
 *
 * The proportions here deliberately mirror `ProductCard` at compact density:
 * square media, two title lines, one price line. Matching geometry is what makes
 * the swap invisible, which is the only reason to render a skeleton at all.
 */
export default function ProductRailSkeleton({ title }: { title: string }) {
    return (
        <div className="space-y-5" aria-busy="true" aria-live="polite">
            {/* Announced once, so assistive tech says "loading X" rather than
                reading a screenful of empty boxes. */}
            <span className="sr-only-text">{`در حال بارگذاری ${title}`}</span>

            <div className="border-s-[3px] border-line ps-3" aria-hidden="true">
                <div className="skeleton h-5 w-40 rounded" />
                <div className="skeleton mt-2 h-3 w-56 rounded" />
            </div>

            <div className="flex gap-3 overflow-hidden" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="w-[46%] shrink-0 overflow-hidden rounded-xl border border-line-soft sm:w-[30%] lg:w-[22%] xl:w-[17%]"
                    >
                        <div className="skeleton aspect-square w-full" />
                        <div className="space-y-2 p-2.5">
                            <div className="skeleton h-3 w-full rounded" />
                            <div className="skeleton h-3 w-2/3 rounded" />
                            <div className="skeleton mt-3 h-4 w-1/2 rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
