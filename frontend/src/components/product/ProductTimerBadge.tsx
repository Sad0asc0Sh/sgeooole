"use client";

import { useState } from "react";
import CountdownTimer from "@/components/ui/CountdownTimer";

interface ProductTimerBadgeProps {
    targetDate: string;
    color?: string;
    className?: string;
}

export default function ProductTimerBadge({ targetDate, color = "text-gray-700", className = "" }: ProductTimerBadgeProps) {
    const [isVisible, setIsVisible] = useState(true);

    const handleExpire = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none ${className}`}>
            <div className="bg-white/95 backdrop-blur-sm px-2 py-1 rounded-md shadow-sm border border-gray-100 flex items-center justify-center gap-1">
                <CountdownTimer
                    targetDate={targetDate}
                    showSeconds={true}
                    className={`text-[11px] font-bold ${color}`}
                    onExpire={handleExpire}
                />
            </div>
        </div>
    );
}
