import {
  sanitizeRichHtml,
  safeExternalHref,
  safePaymentRedirectUrl,
  safeJsonLd,
} from "@/lib/sanitizeHtml";
import { renderContent } from "@/lib/renderContent";

describe("Storefront security hardening helpers", () => {
  test("sanitizeRichHtml strips XSS payloads while preserving structured inline styles", () => {
    const structuredCard =
      '<div style="background: #f9fafb; border-radius: 12px; direction: rtl; margin: 16px auto; width: 100%; max-width: 900px; box-sizing: border-box; display: block;">ویژگی کلیدی</div>';

    const payload =
      `${structuredCard}` +
      `<script>alert('xss')</script>` +
      `<img src="https://c258565.parspack.net/p.webp" onerror="fetch('https://evil.test')" />` +
      `<a href="&#106;avascript:alert(1)">bad</a>` +
      `<iframe src="https://evil.test"></iframe>` +
      `<svg onload="alert(1)"></svg>` +
      `<p style="color:expression(alert(1))">css</p>`;

    const result = sanitizeRichHtml(payload);
    expect(result).toContain(structuredCard);
    expect(result.toLowerCase()).not.toContain("<script");
    expect(result.toLowerCase()).not.toContain("<iframe");
    expect(result.toLowerCase()).not.toContain("<svg");
    expect(result.toLowerCase()).not.toContain("onerror");
    expect(result.toLowerCase()).not.toContain("javascript:");
    expect(result.toLowerCase()).not.toContain("expression(");
  });

  test("safeExternalHref rejects executable and protocol-relative open redirects", () => {
    expect(safeExternalHref("https://post.ir/track?id=123")).toBe("https://post.ir/track?id=123");
    expect(safeExternalHref("/profile/orders")).toBe("/profile/orders");
    expect(safeExternalHref("mailto:support@ekgkala.ir")).toBe("mailto:support@ekgkala.ir");
    expect(safeExternalHref("javascript:alert(1)")).toBe("#");
    expect(safeExternalHref("vbscript:msgbox(1)")).toBe("#");
    expect(safeExternalHref("//evil.example/phish")).toBe("#");
    expect(safeExternalHref("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  test("safePaymentRedirectUrl restricts gateway redirects to trusted PSP origins", () => {
    expect(safePaymentRedirectUrl("https://www.zarinpal.com/pg/StartPay/A001")).toBe(
      "https://www.zarinpal.com/pg/StartPay/A001"
    );
    expect(safePaymentRedirectUrl("https://sadad.shaparak.ir/Purchase?token=abc")).toBe(
      "https://sadad.shaparak.ir/Purchase?token=abc"
    );
    expect(safePaymentRedirectUrl("http://www.zarinpal.com/pg/StartPay/A001")).toBeNull();
    expect(safePaymentRedirectUrl("https://attacker.example/fake-bank")).toBeNull();
    expect(safePaymentRedirectUrl("javascript:alert(1)")).toBeNull();
  });

  test("safeJsonLd escapes script-breaking characters", () => {
    const serialized = safeJsonLd({ name: '</script><script>alert("xss")&' });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
    expect(serialized).toContain("\\u0026");
  });

  test("renderContent strips script/javascript payloads while preserving safe Markdown formatting", () => {
    const out = renderContent(
      "## راهنمای امن\n\n[لینک ناامن](javascript:alert(1)) و [لینک امن](https://ekgkala.ir)<script>alert(1)</script>"
    );
    expect(out.toLowerCase()).not.toContain("<script");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain('href="https://ekgkala.ir"');
  });
});
