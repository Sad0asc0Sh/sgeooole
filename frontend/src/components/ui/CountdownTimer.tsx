"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
    targetDate: string;
    className?: string;
    showSeconds?: boolean;
    onExpire?: () => void;
}

export default function CountdownTimer({ targetDate, className = "", showSeconds = true, onExpire }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date();

            if (difference > 0) {
                return {
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60),
                };
            }
            // Trigger onExpire if provided
            if (onExpire) {
                onExpire();
            }
            return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        };

        setTimeLeft(calculateTimeLeft());

        const timer = setInterval(() => {
            const tl = calculateTimeLeft();
            setTimeLeft(tl);
            if (tl.days === 0 && tl.hours === 0 && tl.minutes === 0 && tl.seconds === 0) {
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [targetDate]);

    // Format with leading zeros
    const format = (num: number) => num.toString().padStart(2, "0");

    // Debug logging
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`CountdownTimer target: ${targetDate}, now: ${new Date().toISOString()}`);
        }
    }, [targetDate]);

    // If more than 24 hours (1 day), show days
    if (timeLeft.days > 0) {
        return (
            <div className={`flex items-center gap-1 font-bold ${className}`} dir="rtl">
                <span>{timeLeft.days}</span>
                <span className="text-[10px] font-normal">روز</span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1 font-mono text-sm font-bold tracking-widest ${className}`} dir="ltr">
            <span>{format(timeLeft.hours)}</span>
            <span>:</span>
            <span>{format(timeLeft.minutes)}</span>
            {showSeconds && (
                <>
                    <span>:</span>
                    <span>{format(timeLeft.seconds)}</span>
                </>
            )}
        </div>
    );
}
