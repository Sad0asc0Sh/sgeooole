import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Brand OG image: 1200x630 — served automatically at /opengraph-image
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  const fontData = await readFile(
    join(process.cwd(), "public", "fonts", "iransan.woff2")
  );

  return new ImageResponse(
    (
      <div
        dir="rtl"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #451a03 100%)",
          fontFamily: "IranSans, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* decorative glow circles */}
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -160,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "#f59e0b",
            opacity: 0.14,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            left: -120,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "#f59e0b",
            opacity: 0.08,
          }}
        />

        <div
          style={{
            fontSize: 118,
            fontWeight: 800,
            color: "#fbbf24",
            lineHeight: 1.4,
          }}
        >
          ای کا جی کالا
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#e5e7eb",
            letterSpacing: 14,
            marginTop: 8,
            fontFamily: "sans-serif",
          }}
        >
          ekgkala
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#9ca3af",
            marginTop: 28,
          }}
        >
          فروشگاه اینترنتی | خرید آنلاین با بهترین قیمت و ارسال سریع
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "IranSans",
          data: fontData,
          style: "normal",
          weight: 800,
        },
      ],
    }
  );
}
