/**
 * Accessible, indexable alt text for admin-managed banners.
 *
 * Banner titles come from the admin panel and are sometimes meaningless
 * Latin placeholders (the homepage hero banners carried title "Cctv",
 * which was rendered verbatim as the images' alt text and repeated all
 * over the homepage for crawlers). Rule: use the admin-provided alt/title
 * when it contains Persian/Arabic script (a real description); otherwise
 * fall back to a branded descriptive alt instead of leaking the raw
 * placeholder into the page.
 */
const PERSIAN_SCRIPT = /[\u0600-\u06FF]/;

export const BRANDED_BANNER_ALT =
  "فروشگاه اینترنتی ای کا جی کالا (ekgkala) — مرجع تجهیزات امنیتی و کالای تکنولوژی";

export function bannerAltText(
  banner: { alt?: string | null; title?: string | null } | null | undefined,
  fallback: string = BRANDED_BANNER_ALT,
): string {
  const candidate = (banner?.alt || banner?.title || "").trim();
  if (candidate && PERSIAN_SCRIPT.test(candidate)) {
    return candidate;
  }
  return fallback;
}
