export type PromotionCopyKey =
  | "promotion.section.timed.title"
  | "promotion.section.timed.description"
  | "promotion.section.curated.title"
  | "promotion.section.curated.description"
  | "promotion.action.viewAll"
  | "promotion.action.viewAllOpportunities"
  | "promotion.reason.timed.label"
  | "promotion.reason.curated.label"
  | "promotion.reason.limitedStock.label"
  | "promotion.reason.campaign.label"
  | "promotion.reason.discount.label"
  | "countdown.unit.day"
  | "countdown.unit.hour"
  | "countdown.unit.minute"
  | "countdown.unit.second";

const PROMOTION_COPY_FA: Record<PromotionCopyKey, string> = {
  "promotion.section.timed.title": "فرصت‌های زمان‌دار",
  "promotion.section.timed.description": "پیشنهادهای زمان‌دار با موجودی محدود",
  "promotion.section.curated.title": "پیشنهادهای منتخب",
  "promotion.section.curated.description": "فرصت خرید حرفه‌ای برای مدت محدود",
  "promotion.action.viewAll": "مشاهده همه",
  "promotion.action.viewAllOpportunities": "مشاهده همه فرصت‌ها",
  "promotion.reason.timed.label": "زمان‌دار",
  "promotion.reason.curated.label": "منتخب",
  "promotion.reason.limitedStock.label": "موجودی محدود",
  "promotion.reason.campaign.label": "کمپین فعال",
  "promotion.reason.discount.label": "تخفیف فعال",
  "countdown.unit.day": "روز",
  "countdown.unit.hour": "ساعت",
  "countdown.unit.minute": "دقیقه",
  "countdown.unit.second": "ثانیه",
};

export function getPromotionCopy(key: PromotionCopyKey): string {
  return PROMOTION_COPY_FA[key];
}
