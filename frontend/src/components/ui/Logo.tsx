import { cn } from "@/lib/utils";

/**
 * Tiny (144-byte) 929x316 all-transparent PNG used strictly as an intrinsic
 * aspect-ratio & accessible alt-text carrier inside `.ekg-logo-composite`.
 * Because the visible `e G |` base layer and `k kala` Force-Dark mask layer
 * both live inline in `globals.css`, all parts of the logo render atomically
 * in the same frame and cannot be dragged apart.
 */
export const LOGO_RATIO_PLACEHOLDER =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA6EAAAE8AQMAAAAL8iXdAAAAA1BMVEUAAACnej3aAAAAAXRSTlMAQObYZgAAADtJREFUeNrtwTEBAAAAwqD1T20ND6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+DJGoAAEixGYRAAAAAElFTkSuQmCC";

type LogoProps = {
    className?: string;
};

export const Logo = ({ className }: LogoProps) => {
    return (
        /*
         * Transparent, box-free cropped lockup (929x316):
         * - Fallback <img> serves complete monolithic /logo-text.png only when CSS fails or mask-image is unsupported
         *   (`loading="lazy"` avoids an unused 170 KB preload when hidden via `display: none !important`).
         * - Modern CSS composite layer paints BOTH `e G |` (inline CSS background-image) AND Force-Dark-invertible
         *   #0e1d45 `k kala` (inline CSS mask-image) from the same stylesheet, eliminating split loading and drag separation.
         */
        <div className={cn("h-10 md:h-14 w-auto flex-shrink-0 flex items-center justify-center select-none", className)}>
            <img
                src="/logo-text.png"
                alt="ای کا جی کالا | ekgkala"
                width={929}
                height={316}
                draggable={false}
                className="ekg-logo-fallback h-10 md:h-14 w-auto object-contain object-right pointer-events-none select-none"
                loading="lazy"
                decoding="sync"
            />
            <span className="ekg-logo-composite" style={{ display: "none" }}>
                <img
                    src={LOGO_RATIO_PLACEHOLDER}
                    alt="ای کا جی کالا | ekgkala"
                    width={929}
                    height={316}
                    draggable={false}
                    className="ekg-logo-base block h-10 md:h-14 w-auto object-contain object-right pointer-events-none select-none"
                    decoding="sync"
                />
                <span aria-hidden="true" className="ekg-logo-ink-mask" />
            </span>
        </div>
    );
};
