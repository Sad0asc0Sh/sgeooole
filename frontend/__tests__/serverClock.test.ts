import {
  getServerNow,
  resetServerClock,
  updateServerClock,
  updateServerClockFromPayload,
} from "@/lib/serverClock";
import { resolvePricing } from "@/lib/pricing";
import { resolveProductPromotion } from "@/lib/promotions/productPromotion";

describe("serverClock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse("2026-09-30T10:00:00.000Z"));
    resetServerClock();
  });
  afterEach(() => {
    jest.useRealTimers();
    resetServerClock();
  });

  test("defaults to the device clock when no server time was seen", () => {
    expect(getServerNow()).toBe(Date.now());
  });

  test("applies the server offset to every expiry decision", () => {
    // Server is 5 minutes ahead of the device.
    updateServerClock("2026-09-30T10:05:00.000Z");
    expect(getServerNow()).toBe(Date.parse("2026-09-30T10:05:00.000Z"));

    // A flash deal ending at 10:03 server time is already over for the server,
    // even though the device clock (10:00) still thinks it is live.
    const endTime = "2026-09-30T10:03:00.000Z";
    expect(
      resolveProductPromotion({ price: 970000, discount: 3, isFlashDeal: true, flashDealEndTime: endTime }).kind,
    ).toBe("none");
    expect(
      resolvePricing({ price: 970000, compareAtPrice: 1000000, discount: 3, isFlashDeal: true, flashDealEndTime: endTime }).discount,
    ).toBe(0);
  });

  test("reads serverNow from list/detail payloads and the Date header", () => {
    updateServerClockFromPayload({ success: true, data: [], serverNow: "2026-09-30T10:02:00.000Z" });
    expect(getServerNow()).toBe(Date.parse("2026-09-30T10:02:00.000Z"));

    resetServerClock();
    updateServerClockFromPayload({ success: true, data: { price: 1, serverNow: "2026-09-30T10:04:00.000Z" } });
    expect(getServerNow()).toBe(Date.parse("2026-09-30T10:04:00.000Z"));

    resetServerClock();
    updateServerClock(new Date("2026-09-30T10:06:00.000Z").toUTCString());
    expect(getServerNow()).toBe(Date.parse("2026-09-30T10:06:00.000Z"));
  });

  test("ignores invalid server times", () => {
    updateServerClock("not-a-date");
    updateServerClockFromPayload({ success: true });
    updateServerClockFromPayload(null);
    expect(getServerNow()).toBe(Date.now());
  });
});
