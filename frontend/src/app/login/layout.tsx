import type { Metadata } from "next";

// The login form is a utility page, not content: it must not compete with
// real pages for brand searches. Its page component is a client component
// and cannot export metadata, so this segment layout carries the noindex
// directive.
export const metadata: Metadata = {
  title: "ورود به حساب کاربری | ای کا جی کالا",
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
