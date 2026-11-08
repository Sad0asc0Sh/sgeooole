import { cn } from "@/lib/utils";

type LogoProps = {
    className?: string;
};

export const Logo = ({ className }: LogoProps) => {
    return (
        /*
         * Transparent, box-free cropped lockup (929x316):
         * - Fallback <img> serves complete monolithic /logo-text.png before CSS applies or on legacy non-mask engines.
         * - Modern CSS-mask layer overlays Force-Dark-invertible #0e1d45 foreground ink onto crisp /logo-text-base.png:
         *   * White headers (Light mode & Edge Android OS-dark): renders original dark navy k & kala.
         *   * Force-Dark headers (Mi Browser Dark, Chrome Force Dark, Samsung Dark): auto-inverts k & kala to pure white.
         */
        <div className={cn("h-10 md:h-14 w-auto flex-shrink-0 flex items-center justify-center", className)}>
            <img
                src="/logo-text.png"
                alt="ای کا جی کالا | ekgkala"
                width={929}
                height={316}
                className="ekg-logo-fallback h-10 md:h-14 w-auto object-contain object-right"
                loading="eager"
                fetchPriority="high"
                decoding="sync"
            />
            <span className="ekg-logo-composite" style={{ display: "none" }}>
                <img
                    src="/logo-text-base.png"
                    alt="ای کا جی کالا | ekgkala"
                    width={929}
                    height={316}
                    className="ekg-logo-base block h-10 md:h-14 w-auto object-contain object-right"
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                />
                <span aria-hidden="true" className="ekg-logo-ink-mask" />
            </span>
        </div>
    );
};
