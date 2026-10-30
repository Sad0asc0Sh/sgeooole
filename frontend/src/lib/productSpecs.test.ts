import { buildProductSpecs } from "./productSpecs";

describe("buildProductSpecs", () => {
  it("prefers full-text specifications and keeps their order", () => {
    const specs = buildProductSpecs({
      specifications: {
        "نوع دستگاه": "پنل دزدگیر اماکن سیم‌کارتی",
        "تعداد زون": "5 زون قابل برنامه‌ریزی",
        "مدت ضبط پیام": "24 ثانیه",
      },
      properties: [{ label: "تعداد زون", value: "5 زون" }],
    });

    expect(specs.map((s) => s.label)).toEqual(["نوع دستگاه", "تعداد زون", "مدت ضبط پیام"]);
    // متن کامل specifications بر مقدار باکت‌شده‌ی properties مقدم است
    expect(specs[1].value).toBe("5 زون قابل برنامه‌ریزی");
  });

  it("supports array-shaped specifications from the API", () => {
    const specs = buildProductSpecs({
      specifications: [
        { label: "رزولوشن", value: "4 مگاپیکسل" },
        { name: "نوع باتری", value: "لیتیوم-یون" },
        { key: "وزن", value: "1.5 کیلوگرم" },
        { label: "", value: "بدون برچسب" },
      ],
    });
    expect(specs).toEqual([
      { label: "رزولوشن", value: "4 مگاپیکسل" },
      { label: "نوع باتری", value: "لیتیوم-یون" },
      { label: "وزن", value: "1.5 کیلوگرم" },
    ]);
  });

  it("falls back to properties and adds guarantee only when missing", () => {
    const specs = buildProductSpecs({
      properties: [
        { label: "نوع اتصال", value: "بی‌سیم" },
        { label: "فرکانس کاری", value: "433 مگاهرتز" },
      ],
      guarantee: "36 ماه گارانتی سایلکس",
    });
    expect(specs).toEqual([
      { label: "نوع اتصال", value: "بی‌سیم" },
      { label: "فرکانس کاری", value: "433 مگاهرتز" },
      { label: "گارانتی", value: "36 ماه گارانتی سایلکس" },
    ]);

    // اگر «گارانتی» از قبل در specifications باشد، تکراری اضافه نمی‌شود
    const withGuarantee = buildProductSpecs({
      specifications: { "مدت گارانتی": "36 ماه گارانتی سایلکس" },
      guarantee: "36 ماه گارانتی سایلکس",
    });
    expect(withGuarantee.filter((s) => s.label === "گارانتی")).toHaveLength(0);
  });

  it("deduplicates labels regardless of spacing/case and drops empty values", () => {
    const specs = buildProductSpecs({
      specifications: [{ label: "ABS  Body", value: "دارد" }],
      properties: [
        { label: "abs body", value: "مقدار تکراری" },
        { label: "خالی", value: "   " },
      ],
    });
    expect(specs).toHaveLength(1);
    expect(specs[0].value).toBe("دارد");
  });

  it("returns an empty array when nothing is provided", () => {
    expect(buildProductSpecs({})).toEqual([]);
    expect(buildProductSpecs({ specifications: {} })).toEqual([]);
  });

  it("collapses synonym labels so SG8-S shows 9 rows, not 13", () => {
    // specifications = جدول کامل با برچسب خام؛ properties = فست با برچسب استاندارد
    const specifications = {
      "نوع دستگاه": "پنل دزدگیر اماکن سیم‌کارتی",
      "تعداد زون": "5 زون قابل برنامه‌ریزی",
      "حالت‌های قابل تعریف برای زون": "8 حالت عملکرد",
      "تعداد رله خروجی": "4 رله کنترلی",
      "فرکانس ریموت": "433.92 MHz",
      "نوع کد ریموت": "Hopping Code",
      "مدت ضبط پیام": "24 ثانیه",
      "تعداد مدیران سیستم": "4 مدیر (Admin)",
      "گارانتی": "36 ماه گارانتی سایلکس",
    };
    const properties = [
      { label: "تعداد رله", value: "4 رله" },
      { label: "تعداد زون", value: "5 زون" },
      { label: "فرکانس کاری", value: "433 مگاهرتز" },
      { label: "نوع کاربری", value: "پنل دزدگیر اماکن سیم‌کارتی" },
      { label: "نوع کددهی", value: "هاپینگ کد (Hopping)" },
    ];

    const specs = buildProductSpecs({ specifications, properties });

    expect(specs).toHaveLength(9);
    // برچسب و متن کامل specifications برنده است
    expect(specs.find((s) => s.label === "فرکانس ریموت")?.value).toBe("433.92 MHz");
    expect(specs.some((s) => s.label === "فرکانس کاری")).toBe(false);
    expect(specs.some((s) => s.label === "نوع کددهی")).toBe(false);
    expect(specs.some((s) => s.label === "تعداد رله")).toBe(false);
    expect(specs.some((s) => s.label === "نوع کاربری")).toBe(false);
  });
});
