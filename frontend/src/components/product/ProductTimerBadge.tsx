"use client";

import { useState } from "react";
import Countdown from "@/components/ui/Countdown";

interface ProductTimerBadgeProps {
    targetDate: string;
    className?: string;
}

/**
 * Remaining-time badge overlaid on a product image.
 *
 * Positioned bottom-inline-start (not centre-top) so it never covers the
 * product itself — recognising the device is the primary job of that image, and
 * a badge across the middle of a camera housing actively harms it.
 *
 * Urgency colour is decided inside `Countdown` from the real remaining time,
 * so a card can no longer choose to look urgent when it is not.
 */
export default function ProductTimerBadge({ targetDate, className = "" }: ProductTimerBadgeProps) {
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className={`absolute bottom-2 start-2 z-20 max-w-[calc(100%-1rem)] ${className}`}>
            <Countdown
                targetDate={targetDate}
                variant="pill"
                onExpire={() => setIsVisible(false)}
                className="shadow-e1 backdrop-blur-sm"
            />
        </div>
    );
}
