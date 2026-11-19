import type { Metadata } from "next";

// Checkout is a transactional, per-session page with zero indexable
// content. Its page component is a client component and cannot export
// metadata, so this segment layout carries the noindex directive
// (follow kept: link equity must keep flowing to the products).
export const metadata: Metadata = {
  title: "تکمیل خرید | ای کا جی کالا",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
