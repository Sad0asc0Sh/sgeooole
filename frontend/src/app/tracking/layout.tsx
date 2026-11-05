import type { Metadata } from "next";

// Order tracking is a per-order lookup utility, not content: it must not
// compete with the homepage for brand searches. Its page component is a
// client component and cannot export metadata, so this segment layout
// carries the noindex directive.
export const metadata: Metadata = {
  title: "پیگیری سفارش | ای کا جی کالا",
  robots: {
    index: false,
    follow: true,
  },
};

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
