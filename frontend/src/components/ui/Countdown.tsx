"use client";

import { useEffect, useMemo, useState } from "react";
import { getPromotionCopy } from "@/lib/promotions/promotionCopy";

type CountdownVariant = "promotion" | "compact" | "hero" | "inline" | "badge";

type CountdownProps = {
  targetDate?: string | Date | number;
  variant?: CountdownVariant;
  onExpire?: () => void;
};

type TimeParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

const getTargetTime = (targetDate?: string | Date | number) => {
  if (!targetDate) return NaN;
  return new Date(targetDate).getTime();
};

const getTimeParts = (targetDate?: string | Date | number): TimeParts => {
  const targetTime = getTargetTime(targetDate);
  if (!Number.isFinite(targetTime)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const remaining = targetTime - Date.now();
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  return {
    days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
    hours: Math.floor((remaining / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((remaining / (1000 * 60)) % 60),
    seconds: Math.floor((remaining / 1000) % 60),
    isExpired: false,
  };
};

const formatFa = (value: number, minimumIntegerDigits = 1) =>
  new Intl.NumberFormat("fa-IR", {
    useGrouping: false,
    minimumIntegerDigits,
  }).format(value);

export default function Countdown({
  targetDate,
  variant = "inline",
  onExpire,
}: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeParts>(() => getTimeParts(targetDate));

  useEffect(() => {
    const update = () => {
      const next = getTimeParts(targetDate);
      setTimeLeft(next);
      if (next.isExpired) {
        onExpire?.();
      }
      return next;
    };

    update();
    const interval = setInterval(() => {
      const next = update();
      if (next.isExpired) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onExpire]);

  const units = useMemo(
    () => [
      {
        key: "days",
        value: timeLeft.days,
        label: getPromotionCopy("countdown.unit.day"),
        digits: 1,
        emphasis: "strong",
      },
      {
        key: "hours",
        value: timeLeft.hours,
        label: getPromotionCopy("countdown.unit.hour"),
        digits: 2,
        emphasis: "strong",
      },
      {
        key: "minutes",
        value: timeLeft.minutes,
        label: getPromotionCopy("countdown.unit.minute"),
        digits: 2,
        emphasis: "normal",
      },
      {
        key: "seconds",
        value: timeLeft.seconds,
        label: getPromotionCopy("countdown.unit.second"),
        digits: 2,
        emphasis: "soft",
      },
    ],
    [timeLeft]
  );

  if (timeLeft.isExpired) return null;

  if (variant === "promotion" || variant === "hero") {
    return (
      <div
        className="grid grid-cols-4 gap-1.5 sm:gap-2"
        dir="rtl"
        aria-label={`${formatFa(timeLeft.days)} ${getPromotionCopy("countdown.unit.day")} ${formatFa(timeLeft.hours, 2)} ${getPromotionCopy("countdown.unit.hour")} ${formatFa(timeLeft.minutes, 2)} ${getPromotionCopy("countdown.unit.minute")} ${formatFa(timeLeft.seconds, 2)} ${getPromotionCopy("countdown.unit.second")}`}
      >
        {units.map((unit) => (
          <div
            key={unit.key}
            className="min-w-[54px] rounded-xl border border-ekg-100 bg-white/85 px-2 py-2 text-center shadow-sm"
          >
            <div
              className={`leading-none ${unit.emphasis === "soft"
                ? "text-sm font-bold text-ekg-600"
                : "text-base font-black text-ekg-900"
                }`}
            >
              {formatFa(unit.value, unit.digits)}
            </div>
            <div className="mt-1 text-[10px] font-medium text-ekg-500 leading-none">
              {unit.label}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === "compact" || variant === "badge") {
    const compactUnits = timeLeft.days > 0
      ? units.slice(0, 2)
      : timeLeft.hours > 0
        ? units.slice(1, 3)
        : units.slice(2, 4);

    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-ekg-100 bg-white/90 px-2 py-1 text-[10px] font-bold text-ekg-700" dir="rtl">
        {compactUnits.map((unit, index) => (
          <span key={unit.key} className="inline-flex items-center gap-0.5 whitespace-nowrap">
            {index > 0 && <span className="text-ekg-300">•</span>}
            <span>{formatFa(unit.value, unit.digits)}</span>
            <span className="font-medium text-ekg-500">{unit.label}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-ekg-700" dir="rtl">
      {timeLeft.days > 0 && (
        <span>{formatFa(timeLeft.days)} {getPromotionCopy("countdown.unit.day")}</span>
      )}
      <span>{formatFa(timeLeft.hours, 2)} {getPromotionCopy("countdown.unit.hour")}</span>
      <span>{formatFa(timeLeft.minutes, 2)} {getPromotionCopy("countdown.unit.minute")}</span>
    </span>
  );
}
