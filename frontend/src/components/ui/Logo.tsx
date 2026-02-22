/* eslint-disable @next/next/no-img-element */

import { cn } from "@/lib/utils";

type LogoProps = {
    className?: string;
};

export const Logo = ({ className }: LogoProps) => {
    return (
        /* w-28 = 112px on mobile, w-40 = 160px on md+ — replaces clamp() for Edge Android compat */
        <div className={cn("h-10 w-28 xs:w-32 md:h-16 md:w-64 flex-shrink-0", className)}>
            <picture className="block h-full w-full">
                <source srcSet="/logo-text-dark.png" media="(prefers-color-scheme: dark)" />
                <img
                    src="/logo-text.png"
                    alt="EKGKala Logo"
                    width={256}
                    height={64}
                    className="block h-full w-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                />
            </picture>
        </div>
    );
};
