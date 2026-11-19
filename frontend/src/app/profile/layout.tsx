import type { Metadata } from "next";

// The whole /profile subtree (dashboard, orders, addresses, lists, tickets,
// …) is per-user private content with nothing to index. This segment layout
// covers every nested route at once. Its pages are client components and
// cannot export metadata, so the layout carries the noindex directive.
export const metadata: Metadata = {
  title: "حساب کاربری | ای کا جی کالا",
  robots: {
    index: false,
    follow: true,
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
