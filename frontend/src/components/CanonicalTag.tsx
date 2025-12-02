"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Dynamic Canonical Tag
 * 
 * این کامپوننت canonical tag را به صورت داینامیک به head اضافه می‌کند
 */
export default function CanonicalTag() {
    const pathname = usePathname();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

    useEffect(() => {
        if (!siteUrl || !pathname) return;

        // Remove existing canonical tags
        const existingCanonical = document.querySelector('link[rel="canonical"]');
        if (existingCanonical) {
            existingCanonical.remove();
        }

        // Create new canonical tag
        const canonical = document.createElement("link");
        canonical.rel = "canonical";
        canonical.href = `${siteUrl}${pathname}`;
        document.head.appendChild(canonical);

        // Cleanup on unmount
        return () => {
            const linkToRemove = document.querySelector(`link[rel="canonical"][href="${siteUrl}${pathname}"]`);
            if (linkToRemove) {
                linkToRemove.remove();
            }
        };
    }, [pathname, siteUrl]);

    return null; // This component doesn't render anything
}
