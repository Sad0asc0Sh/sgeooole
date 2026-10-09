import { buildProductUrl, encodeRedirectPath } from "./paths";

// Regression coverage for the plain-text 500 on legacy product URLs:
// permanentRedirect() writes the target into a Location header, and Node
// rejects non-ASCII header values (ERR_INVALID_CHAR). Best-seller cards
// used to generate legacy /product/<ObjectId>/… links, so every tap on the
// «پرفروش‌ترین‌ها» rail hit that redirect — and crashed instead of 308ing.
describe("encodeRedirectPath", () => {
  it("keeps ASCII-only paths untouched", () => {
    expect(encodeRedirectPath("/product/KY-0008061/some-slug-123")).toBe(
      "/product/KY-0008061/some-slug-123",
    );
    expect(encodeRedirectPath("/")).toBe("/");
  });

  it("percent-encodes a raw Persian slug so the result is header-safe ASCII", () => {
    const raw = "/product/KY-0008061/ماژول-ریموتگ-بتا";
    const encoded = encodeRedirectPath(raw);

    // A Location header value must be printable ASCII only.
    expect(encoded).toMatch(/^[\x20-\x7E]*$/);
    expect(encoded.startsWith("/product/KY-0008061/")).toBe(true);
    expect(encoded).not.toContain("ماژول");
  });

  it("round-trips: decoding each segment restores the original path", () => {
    const raw = "/product/KY-0008061/ماژول-ریموتگ-بتامناسب-برای-ریموتی";
    const encoded = encodeRedirectPath(raw);
    const decoded = encoded
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    expect(decoded).toBe(raw);
  });

  it("encodes the exact URL buildProductUrl produces for a Persian slug", () => {
    const url = buildProductUrl({
      id: "6aac1427784c4750566d5dfd",
      productCode: "KY-0008061",
      slug: "ماژول-ریموتگ-بتا",
    } as any);
    expect(url).toBe("/product/ky-0008061/ماژول-ریموتگ-بتا");

    const encoded = encodeRedirectPath(url);
    expect(encoded).toMatch(/^[\x20-\x7E]*$/);
    expect(encoded).toBe(
      `/product/ky-0008061/${encodeURIComponent("ماژول-ریموتگ-بتا")}`,
    );
  });
});

describe("buildProductUrl", () => {
  it("prefers productCode over the Mongo _id (canonical format)", () => {
    expect(
      buildProductUrl({
        id: "6aac1427784c4750566d5dfd",
        productCode: "KY-0008061",
        slug: "some-slug",
      } as any),
    ).toBe("/product/ky-0008061/some-slug");
  });
});
