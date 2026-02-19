/* eslint-disable @next/next/no-img-element */

import { cn } from "@/lib/utils";

type LogoProps = {
    className?: string;
};

export const Logo = ({ className }: LogoProps) => {
    return (
        <div className={cn("h-10 w-[clamp(110px,38vw,160px)] md:h-16 md:w-64", className)}>
            <picture className="block h-full w-full">
                <source srcSet="/logo-text-dark.png" media="(prefers-color-scheme: dark)" />
                <img
                    src="/logo-text.png"
                    alt="EKGKala Logo"
                    className="block h-full w-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
            </picture>
        </div>
    );
};
