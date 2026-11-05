import type { Metadata } from "next";

// The cart is a per-user transactional page (its empty state was indexed
// for brand searches). Its page component is a client component and cannot
// export metadata, so this segment layout carries the noindex directive.
export const metadata: Metadata = {
  title: "سبد خرید | ای کا جی کالا",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
