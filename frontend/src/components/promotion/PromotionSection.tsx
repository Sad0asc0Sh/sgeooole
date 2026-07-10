import type { ReactNode } from "react";

type PromotionSectionProps = {
  children: ReactNode;
};

export default function PromotionSection({ children }: PromotionSectionProps) {
  return (
    <section className="border-y border-ekg-100 bg-gradient-to-l from-ekg-50 via-white to-kala-50 py-5 md:py-6">
      <div className="mx-auto w-full max-w-screen-2xl px-4">
        {children}
      </div>
    </section>
  );
}
