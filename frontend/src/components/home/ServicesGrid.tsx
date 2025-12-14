"use client";
import { SERVICES } from "@/lib/mock/homeData";
import { Truck, PenTool, MapPin } from "lucide-react";

export default function ServicesGrid() {
    const getIcon = (id: number) => {
        switch (id) {
            case 1: return <PenTool className="w-6 h-6 text-vita-500" />;
            case 2: return <Truck className="w-6 h-6 text-vita-500" />;
            case 3: return <MapPin className="w-6 h-6 text-vita-500" />;
            default: return null;
        }
    };

    return (
        <div className="py-6 px-4 bg-white">
            <h3 className="mb-4 text-welf-900 font-bold text-lg">خدمات اختصاصی ویلف‌ویتا</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                {SERVICES.map((service) => (
                    <div key={service.id} className="flex items-start gap-4 p-4 rounded-xl border border-welf-100 bg-welf-50 hover:bg-white hover:shadow-md hover:border-vita-200 transition-all duration-300 cursor-default group">
                        <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                            {getIcon(service.id)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-welf-900 text-sm group-hover:text-vita-600 transition-colors">{service.title}</h4>
                                <span className="px-2 py-0.5 rounded-full bg-vita-100 text-vita-700 text-[10px]">
                                    {service.tag}
                                </span>
                            </div>
                            <p className="text-xs text-welf-500 leading-relaxed">
                                {service.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
