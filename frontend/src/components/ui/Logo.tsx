import { cn } from "@/lib/utils";

type LogoProps = {
    className?: string;
};

export const Logo = ({ className }: LogoProps) => {
    return (
        /* Explicit dimensions preserve 929:316 tightly cropped aspect ratio cleanly with zero background box */
        <div className={cn("h-10 xs:h-11 md:h-14 w-auto flex-shrink-0 flex items-center justify-center", className)}>
            <picture className="block h-full w-auto">
                <source srcSet="/logo-text-dark.png" media="(prefers-color-scheme: dark)" />
                <img
                    src="/logo-text.png"
                    alt="ای کا جی کالا | ekgkala"
                    width={929}
                    height={316}
                    className="block h-full w-auto object-contain object-right"
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                />
            </picture>
        </div>
    );
};
