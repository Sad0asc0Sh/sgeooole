"use client";
import { SERVICES } from "@/lib/mock/homeData";
import { Truck, ShieldCheck, MapPin } from "lucide-react";

export default function ServicesGrid() {
    const getIcon = (id: number) => {
        const iconClassName = "w-6 h-6 lg:w-7 lg:h-7 text-kala-500";
        switch (id) {
            case 1: return <ShieldCheck className={iconClassName} />;
            case 2: return <Truck className={iconClassName} />;
            case 3: return <MapPin className={iconClassName} />;
            default: return null;
        }
    };

    return (
        <section className="py-6 md:py-10 lg:py-12 bg-white">
            <div className="mx-auto w-full max-w-screen-2xl px-4 lg:px-6">
                {/* Header: compact on mobile, title + subtitle on desktop */}
                <header className="mb-4 md:mb-8">
                    <h3 className="relative inline-block text-ekg-900 font-bold text-lg md:text-xl lg:text-2xl z-10 px-1">
                        خدمات و مزایای خرید از ای‌کا‌جی کالا
                        <span className="hidden md:block absolute bottom-1 left-0 w-full h-2.5 bg-kala-400/40 -z-10 -skew-x-12 rounded-sm" />
                    </h3>
                    <p className="hidden md:block mt-2 text-sm lg:text-base text-ekg-500">
                        تجربه‌ای مطمئن، سریع و بی‌واسطه در خرید آنلاین انواع کالای تکنولوژی با پشتیبانی واقعی.
                    </p>
                </header>

                {/* Mobile: stacked horizontal cards — Desktop: 3 vertical feature cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 lg:gap-8">
                    {SERVICES.map((service) => (
                        <div
                            key={service.id}
                            className="relative overflow-hidden flex items-start md:flex-col gap-4 md:gap-5 p-4 md:p-6 lg:p-8 rounded-xl md:rounded-2xl border border-ekg-100 bg-ekg-50/50 hover:bg-white hover:shadow-md md:hover:shadow-xl md:hover:-translate-y-1 hover:border-kala-200/60 transition-all duration-300 cursor-default group"
                        >
                            {/* Decorative accent line (desktop only) */}
                            <span className="hidden md:block absolute top-0 inset-x-0 h-1 bg-gradient-to-l from-kala-400 to-kala-600 origin-right scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

                            <div className="shrink-0 p-2.5 md:p-3.5 lg:p-4 bg-white rounded-xl md:rounded-2xl shadow-sm border border-ekg-100/50 group-hover:scale-110 group-hover:border-kala-200 transition-all duration-300">
                                {getIcon(service.id)}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1 md:mb-2.5">
                                    <h4 className="font-bold text-ekg-900 text-sm md:text-base lg:text-lg group-hover:text-kala-600 transition-colors">
                                        {service.title}
                                    </h4>
                                    <span className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-kala-100 text-kala-700 text-[10px] md:text-xs">
                                        {service.tag}
                                    </span>
                                </div>
                                <p className="text-xs md:text-sm lg:text-[15px] text-ekg-500 leading-relaxed md:leading-7">
                                    {service.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
