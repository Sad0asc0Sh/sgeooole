import { brandAltSuffix, isRawObjectId } from "./productData";

describe("brandAltSuffix — SEO guard against raw brand ObjectIds", () => {
  it("returns the ' برند X' suffix for a real brand name", () => {
    expect(brandAltSuffix("هیک ویژن")).toBe(" برند هیک ویژن");
    expect(brandAltSuffix({ name: "HiWatch", slug: "hiwatch" })).toBe(" برند HiWatch");
  });

  it("returns an empty suffix for a raw 24-hex ObjectId (unpopulated brand)", () => {
    expect(brandAltSuffix("665f1a2b3c4d5e6f7a8b9c0d")).toBe("");
    expect(brandAltSuffix({ name: "665f1a2b3c4d5e6f7a8b9c0d" })).toBe("");
  });

  it("returns an empty suffix for missing/empty/whitespace brands", () => {
    expect(brandAltSuffix(undefined)).toBe("");
    expect(brandAltSuffix(null)).toBe("");
    expect(brandAltSuffix("")).toBe("");
    expect(brandAltSuffix("   ")).toBe("");
    expect(brandAltSuffix({ name: "" })).toBe("");
    expect(brandAltSuffix({})).toBe("");
  });

  it("does not treat 23- or 25-character hex strings as ObjectIds", () => {
    expect(brandAltSuffix("665f1a2b3c4d5e6f7a8b9c0")).toBe(" برند 665f1a2b3c4d5e6f7a8b9c0");
    expect(isRawObjectId("665f1a2b3c4d5e6f7a8b9c0")).toBe(false);
    expect(isRawObjectId("665f1a2b3c4d5e6f7a8b9c0d")).toBe(true);
    expect(isRawObjectId("دوربین مداربسته")).toBe(false);
  });
});
