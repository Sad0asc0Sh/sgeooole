"use client";

import { useEffect, useMemo, useState } from "react";
import {
  durationTickInterval,
  faDurationPhrase,
  faDurationSegments,
  getDurationParts,
} from "@/lib/persian";

/**
 * The storefront's only countdown.
 * ============================================================================
 * Replaces two components that disagreed with each other:
 *
 *   - the old `Countdown`, which rendered four boxes including «۰ روز» for a
 *     four-hour offer, and re-rendered every second forever
 *   - the old `CountdownTimer`, which rendered `03:41:22` in Latin digits, LTR,
 *     monospace, and collapsed "۱ روز و ۲۳ ساعت" to a bare "۱ روز"
 *
 * Persian time model, applied everywhere:
 *   - at most two adjacent units, starting at the first meaningful one
 *   - Persian numerals and Persian unit words, never a digital clock
 *   - never an accumulated hour count for a multi-day offer
 *
 * Ticking is proportional to what is actually visible: once a minute above a
 * day, twice a minute above an hour, once a second in the final hour.
 */

type CountdownVariant =
  /** Segmented cells. Section headers where the offer window is the headline. */
  | "panel"
  /** Single inline pill. Product cards and dense metadata rows. */
  | "pill"
  /** Bare text, inherits colour and size. Prose and tight overlays. */
  | "inline";

type CountdownProps = {
  targetDate?: string | Date | number;
  variant?: CountdownVariant;
  /** Short Persian lead-in, e.g. «پایان تا». Omitted when not supplied. */
  prefix?: string;
  className?: string;
  onExpire?: () => void;
};

export default function Countdown({
  targetDate,
  variant = "inline",
  prefix,
  className = "",
  onExpire,
}: CountdownProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const parts = getDurationParts(targetDate, Date.now());
    if (parts.isExpired) {
      onExpire?.();
      return;
    }

    let timeoutId: number | undefined;

    const schedule = () => {
      const current = Date.now();
      const next = getDurationParts(targetDate, current);

      setNow(current);

      if (next.isExpired) {
        onExpire?.();
        return;
      }

      const interval = durationTickInterval(targetDate, current);
      // Land just after the boundary so the displayed value is never stale by
      // a frame, and never fire faster than the display can change.
      timeoutId = window.setTimeout(schedule, Math.min(interval, next.totalMs + 50));
    };

    const interval = durationTickInterval(targetDate, Date.now());
    timeoutId = window.setTimeout(schedule, Math.min(interval, parts.totalMs + 50));

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [targetDate, onExpire]);

  const parts = useMemo(() => getDurationParts(targetDate, now), [targetDate, now]);
  const segments = useMemo(() => faDurationSegments(targetDate, now), [targetDate, now]);
  const phrase = useMemo(() => faDurationPhrase(targetDate, now), [targetDate, now]);

  if (parts.isExpired) return null;

  // The urgency signal is derived from real remaining time, not from a prop, so
  // no caller can dress a three-day offer up as "ending now".
  const isFinalHour = parts.days === 0 && parts.hours === 0;

  // One accessible sentence for the whole widget. Screen readers get the full
  // phrase instead of reading isolated digits and unit labels.
  const accessibleLabel = prefix ? `${prefix} ${phrase}` : `${phrase} باقی مانده`;

  if (variant === "panel") {
    return (
      <div
        className={`inline-flex items-center gap-2 ${className}`}
        role="timer"
        aria-label={accessibleLabel}
      >
        {prefix ? (
          <span className="text-[11px] font-medium text-ink-subtle" aria-hidden="true">
            {prefix}
          </span>
        ) : null}

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className={`min-w-[46px] rounded-lg border px-2 py-1.5 text-center ${
                isFinalHour
                  ? "border-signal-urgent/25 bg-signal-urgent-soft"
                  : "border-line bg-surface"
              }`}
            >
              <div
                className={`text-[15px] font-bold leading-none tabular-nums ${
                  isFinalHour ? "text-signal-urgent" : "text-ink"
                }`}
              >
                {segment.value}
              </div>
              <div className="mt-1 text-[10px] font-medium leading-none text-ink-faint">
                {segment.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight ${
          isFinalHour
            ? "border-signal-urgent/25 bg-signal-urgent-soft text-signal-urgent"
            : "border-line bg-surface text-ink-muted"
        } ${className}`}
        role="timer"
        aria-label={accessibleLabel}
      >
        <span className="truncate" aria-hidden="true">
          {phrase}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
      role="timer"
      aria-label={accessibleLabel}
    >
      <span aria-hidden="true">{prefix ? `${prefix} ${phrase}` : phrase}</span>
    </span>
  );
}
