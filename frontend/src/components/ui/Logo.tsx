/* eslint-disable @next/next/no-img-element */

export const Logo = () => {
    return (
        <div className="h-16 w-64">
            <picture className="block h-full w-full">
                <source srcSet="/logo-text-dark.png" media="(prefers-color-scheme: dark)" />
                <img
                    src="/logo-text.png"
                    alt="EKGKala Logo"
                    className="h-full w-full object-contain"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                />
            </picture>
        </div>
    );
};
