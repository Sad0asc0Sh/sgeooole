import {
  buildQuickFilters,
  isBareNegativeValue,
  quickFilterKey,
  type QuickFilterSourceProperty,
} from "./quickFilters";

const prop = (
  name: string,
  values: Array<[string, number]>,
  extra: Partial<QuickFilterSourceProperty> = {},
): QuickFilterSourceProperty => ({
  name,
  values: values.map(([value, count]) => ({ value, count })),
  ...extra,
});

describe("quickFilterKey / isBareNegativeValue", () => {
  it("makes Persian/Arabic digits, ZWNJ and parentheses comparable", () => {
    expect(quickFilterKey("۱۲ ولت")).toBe("12 ولت");
    expect(quickFilterKey("بی‌سیم")).toBe("بیسیم");
    expect(quickFilterKey("پلاستیک فشرده (ABS)")).toBe("پلاستیک فشرده");
  });

  it("flags bare negatives and property-named negatives («بدون ریموت» under «ریموت»), but keeps «بدون سیم»", () => {
    expect(isBareNegativeValue("ندارد")).toBe(true);
    expect(isBareNegativeValue(" خیر ")).toBe(true);
    expect(isBareNegativeValue("-")).toBe(true);
    // «بدون سیم» یعنی بی‌سیم؛ ویژگی مثبت است و نباید حذف شود
    expect(isBareNegativeValue("بدون سیم", "نوع اتصال")).toBe(false);
    expect(isBareNegativeValue("بدون سیم")).toBe(false);
    // بدون آرگومان نام ویژگی، عبارت دوکلمه‌ای منفی تکی نیست؛ اما برای ویژگی هم‌نام («ریموت») منفی است
    expect(isBareNegativeValue("بدون ریموت")).toBe(false);
    expect(isBareNegativeValue("بدون ریموت", "ریموت")).toBe(true);
    expect(isBareNegativeValue("دارد")).toBe(false);
  });
});

describe("buildQuickFilters — meaning", () => {
  it("prefixes the property name so «دارد» is never shown alone", () => {
    const pills = buildQuickFilters([prop("ضد آب", [["دارد", 5], ["ندارد", 7]])], {}, { total: 20 });
    expect(pills.map((pill) => pill.label)).toEqual(["ضد آب: دارد"]);
    expect(pills[0].prefix).toBe("ضد آب");
    expect(pills[0].value).toBe("دارد");
  });

  it("never emits a bare «ندارد» or «بدون ریموت» pill under «ریموت» (the reported bug)", () => {
    const pills = buildQuickFilters([prop("ریموت", [["بدون ریموت", 2], ["ندارد", 2], ["یک ریموت", 1]])], {}, { total: 12 });
    expect(pills.map((pill) => pill.value)).toEqual(["یک ریموت"]);
    expect(pills.some((pill) => pill.value === "ندارد")).toBe(false);
    expect(pills.some((pill) => pill.value === "بدون ریموت")).toBe(false);
  });

  it("omits the prefix when the value already names the property or when property is identity («نوع کاربری»)", () => {
    const pills = buildQuickFilters(
      [
        prop("نوع کاربری", [["گیرنده ریموت و رله فرمان", 4], ["مدار فرمان کرکره برقی", 4]]),
        prop("ریموت", [["یک ریموت", 3]]),
      ],
      {},
      { total: 12 },
    );
    expect(pills[0].prefix).toBeNull();
    expect(pills[0].label).toBe("گیرنده ریموت و رله فرمان");
    expect(pills[2].prefix).toBeNull();
    expect(pills[2].label).toBe("یک ریموت");
  });

  it("keeps a bare negative the user has explicitly selected, so it can be undone", () => {
    const pills = buildQuickFilters([prop("ریموت", [["ندارد", 2], ["یک ریموت", 1]])], { "ریموت": ["ندارد"] }, { total: 12 });
    const negative = pills.find((pill) => pill.value === "ندارد");
    expect(negative).toBeDefined();
    expect(negative?.selected).toBe(true);
    expect(negative?.label).toBe("ریموت: ندارد");
  });
});

describe("buildQuickFilters — usefulness", () => {
  it("drops values every result already has (count ≥ total)", () => {
    const pills = buildQuickFilters([prop("فرکانس کاری", [["433 مگاهرتز", 12]]), prop("جنس", [["پلاستیک", 5]])], {}, { total: 12 });
    expect(pills.map((pill) => pill.property)).toEqual(["جنس"]);
  });

  it("skips the no-op rule when total is unknown", () => {
    const pills = buildQuickFilters([prop("فرکانس کاری", [["433 مگاهرتز", 12]])]);
    expect(pills).toHaveLength(1);
  });

  it("collapses one fact listed twice with equal counts and keeps the shorter bucket", () => {
    const pills = buildQuickFilters(
      [prop("جنس بدنه", [["پلاستیک", 2], ["پلاستیک فشرده (ABS)", 2], ["آلومینیوم", 1]])],
      {},
      { total: 12 },
    );
    expect(pills.map((pill) => pill.value)).toEqual(["پلاستیک", "آلومینیوم"]);
  });

  it("does not merge values that merely share a substring or have different counts", () => {
    const sameWordsDifferentCount = buildQuickFilters(
      [prop("جنس", [["پلاستیک", 4], ["پلاستیک فشرده", 2]])],
      {},
      { total: 12 },
    );
    expect(sameWordsDifferentCount.map((pill) => pill.value)).toEqual(["پلاستیک", "پلاستیک فشرده"]);

    const digitsAreNotSubstrings = buildQuickFilters([prop("تعداد رله", [["2 رله", 3], ["12 رله", 3]])], {}, { total: 12 });
    expect(digitsAreNotSubstrings.map((pill) => pill.value)).toEqual(["2 رله", "12 رله"]);
  });

  it("never drops a selected value when collapsing duplicates or applying the per-property cap", () => {
    const pills = buildQuickFilters(
      [prop("جنس بدنه", [["پلاستیک", 2], ["پلاستیک فشرده (ABS)", 2], ["فلز", 2], ["شیشه", 2]])],
      { "جنس بدنه": ["شیشه"] },
      { total: 12 },
    );
    expect(pills.some((pill) => pill.value === "شیشه" && pill.selected)).toBe(true);
  });

  it("returns nothing when no property has a useful live value", () => {
    expect(buildQuickFilters([])).toEqual([]);
    expect(buildQuickFilters([prop("ریموت", [["ندارد", 4]]), prop("جنس", [["پلاستیک", 0]])], {}, { total: 8 })).toEqual([]);
  });
});

describe("buildQuickFilters — ranking and caps", () => {
  it("orders properties: selected, then pinned, then identity (نوع کاربری), then backend utilityScore, then coverage", () => {
    const pills = buildQuickFilters(
      [
        prop("پوشش بالا", [["الف", 9]]),
        prop("امتیاز بالا", [["ب", 3]], { utilityScore: 2 }),
        prop("نوع کاربری", [["گیرنده", 4]], { utilityScore: 1.1 }),
        prop("پین‌شده", [["ج", 1]], { isPinned: true }),
        prop("انتخاب‌شده", [["د", 1]]),
      ],
      { "انتخاب‌شده": ["د"] },
      { total: 20, maxProperties: 5 },
    );
    expect(pills.map((pill) => pill.property)).toEqual([
      "انتخاب‌شده",
      "پین‌شده",
      "نوع کاربری",
      "امتیاز بالا",
      "پوشش بالا",
    ]);
  });

  it("falls back to coverage when the API sends no utilityScore", () => {
    const pills = buildQuickFilters([prop("کم", [["الف", 2]]), prop("زیاد", [["ب", 9]])], {}, { total: 20 });
    expect(pills.map((pill) => pill.property)).toEqual(["زیاد", "کم"]);
  });

  it("shows at most 4 properties × 2 values = 8 pills, highest counts first", () => {
    const many = ["a", "b", "c", "d", "e"].map((name, index) =>
      prop(`ویژگی ${name}`, [[`x${name}`, 9 - index], [`y${name}`, 5], [`z${name}`, 4]], { utilityScore: 10 - index }),
    );
    const pills = buildQuickFilters(many, {}, { total: 50 });
    expect(pills).toHaveLength(8);
    expect(new Set(pills.map((pill) => pill.property)).size).toBe(4);
    expect(pills.map((pill) => pill.value)).toEqual(["xa", "ya", "xb", "yb", "xc", "yc", "xd", "yd"]);
  });

  it("keeps backend order on ties", () => {
    const pills = buildQuickFilters([prop("نوع کاربری", [["گیرنده", 4], ["مدار", 4]])], {}, { total: 12 });
    expect(pills.map((pill) => pill.value)).toEqual(["گیرنده", "مدار"]);
  });
});

describe("buildQuickFilters — the reported screenshot", () => {
  const facetsFromApi: QuickFilterSourceProperty[] = [
    prop("فرکانس کاری", [["433 مگاهرتز", 10]], { utilityScore: 0.35 }),
    prop("جنس بدنه", [["پلاستیک", 2], ["پلاستیک فشرده (ABS)", 2], ["آلومینیوم", 1], ["فلز", 1]], { utilityScore: 0.94 }),
    prop("نوع کاربری", [["گیرنده ریموت و رله فرمان", 4], ["مدار فرمان کرکره برقی", 4]], { utilityScore: 1.11 }),
    prop("ریموت", [["بدون ریموت", 2], ["ندارد", 2], ["یک ریموت", 1]], { utilityScore: 0.34 }),
  ];

  it("puts identity pills first without redundant prefix and eliminates «ندارد» and «بدون ریموت»", () => {
    const pills = buildQuickFilters(facetsFromApi, {}, { total: 12 });
    const labels = pills.map((pill) => pill.label);

    expect(labels[0]).toBe("گیرنده ریموت و رله فرمان");
    expect(labels[1]).toBe("مدار فرمان کرکره برقی");
    expect(labels).not.toContain("ندارد");
    expect(labels).not.toContain("بدون ریموت");
    expect(pills.some((pill) => pill.value === "ندارد")).toBe(false);
    expect(pills.some((pill) => pill.value === "پلاستیک فشرده (ABS)")).toBe(false);
    expect(labels).toContain("جنس بدنه: پلاستیک");
    expect(labels).toContain("یک ریموت");
  });
});
