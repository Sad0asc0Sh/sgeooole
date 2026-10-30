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
});
