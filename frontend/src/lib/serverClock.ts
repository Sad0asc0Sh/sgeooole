/**
 * ساعت سرور — منبع واحد برای همه‌ی تصمیم‌های «منقضی شد؟».
 *
 * مشکل: فرانت انقضای تخفیف را با ساعت دستگاه می‌سنجید؛ اگر ساعت گوشی جلوتر
 * از سرور باشد (یا snapshot قدیمی/کش‌شده دیر map شود) کارت قیمت تخفیفی را
 * بعد از پایان هم نگه می‌داشت. بک‌اند حالا `serverNow` را در پاسخ
 * لیست/جزئیات می‌فرستد (هدر Date هم همیشه هست) و این ماژول آفست را نگه می‌دارد.
 *
 * قرارداد:
 * - offsetMs = serverTime - clientTime (میانگین ساده، بدون پیچیدگی NTP)
 * - getServerNow() = Date.now() + offsetMs
 * - همه‌ی resolvePricing / resolveProductPromotion / getNextPromotionExpiry /
 *   usePromotionBoundary / CountdownTimer از همین تابع استفاده می‌کنند.
 * - مرز دقیق: endTime == now یعنی تمام‌شده (مقایسه‌ی `>` برای زنده‌بودن).
 */

let offsetMs = 0;

export function getServerClockOffset(): number {
  return offsetMs;
}

/** ساعت تصحیح‌شده‌ی فعلی (میلی‌ثانیه‌ی epoch). */
export function getServerNow(): number {
  return Date.now() + offsetMs;
}

function toTime(value: string | number | Date | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const t = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return Number.isFinite(t) ? (t as number) : null;
}

/**
 * آفست را از یک زمان سرور به‌روز می‌کند. تغییرات بزرگ ناگهانی (>۲۴ ساعت)
 * نادیده گرفته می‌شوند تا یک پاسخ خراب ساعت را به‌هم نریزد.
 */
export function updateServerClock(serverTime: string | number | Date | undefined | null): void {
  const t = toTime(serverTime);
  if (t === null) return;
  const next = t - Date.now();
  if (!Number.isFinite(next)) return;
  if (Math.abs(next - offsetMs) > 24 * 3600 * 1000 && offsetMs !== 0) return;
  if (Math.abs(next) > 7 * 24 * 3600 * 1000) return;
  offsetMs = next;
}

/** استخراج serverNow از بدنه‌ی پاسخ‌های بک‌اند (لیست/جزئیات/خطا). */
export function updateServerClockFromPayload(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const root = payload as Record<string, unknown>;
  const direct = root.serverNow;
  if (typeof direct === "string" || typeof direct === "number") {
    updateServerClock(direct);
    return;
  }
  const data = root.data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).serverNow;
    if (typeof nested === "string" || typeof nested === "number") {
      updateServerClock(nested);
    }
  }
}

export function resetServerClock(): void {
  offsetMs = 0;
}
