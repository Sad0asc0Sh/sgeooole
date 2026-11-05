import { bannerAltText, BRANDED_BANNER_ALT } from "./bannerAlt";

describe("bannerAltText", () => {
  it("replaces a meaningless Latin placeholder title (e.g. Cctv) with the branded alt", () => {
    expect(bannerAltText({ title: "Cctv" })).toBe(BRANDED_BANNER_ALT);
    expect(bannerAltText({ alt: "", title: "Cctv" })).toBe(BRANDED_BANNER_ALT);
    expect(bannerAltText({ alt: "banner 2", title: "x" })).toBe(BRANDED_BANNER_ALT);
  });

  it("keeps a real Persian alt or title untouched", () => {
    expect(bannerAltText({ alt: "بنر دوربین مداربسته", title: "Cctv" })).toBe("بنر دوربین مداربسته");
    expect(bannerAltText({ title: "جشنواره فروش تابستانه" })).toBe("جشنواره فروش تابستانه");
  });

  it("falls back for missing banners and honours a custom fallback", () => {
    expect(bannerAltText(null)).toBe(BRANDED_BANNER_ALT);
    expect(bannerAltText(undefined, "بنر تبلیغاتی")).toBe("بنر تبلیغاتی");
    expect(bannerAltText({ title: "Cctv" }, "بنر اصلی فروشگاه")).toBe("بنر اصلی فروشگاه");
  });
});
