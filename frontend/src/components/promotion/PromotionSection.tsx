import type { ReactNode } from "react";

type PromotionSectionProps = {
  children: ReactNode;
};

export default function PromotionSection({ children }: PromotionSectionProps) {
  return (
    <section className="legacy-grad-section border-y border-ekg-100/60 bg-gradient-to-l from-ekg-50/80 via-white to-kala-50/60 py-5 md:py-6">
      <div className="mx-auto w-full max-w-screen-2xl px-4">
        {children}
      </div>
    </section>
  );
}
