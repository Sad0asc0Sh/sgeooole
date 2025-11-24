"use client";

import { useState, useEffect } from "react";
import { Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function ServicesWidget() {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Auto-collapse on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!isSheetOpen) setIsExpanded(false);
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // Auto-collapse after sheet closes
    useEffect(() => {
        if (!isSheetOpen) {
            const timer = setTimeout(() => {
                setIsExpanded(false);
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            setIsExpanded(true); // Keep expanded while sheet is open
        }
    }, [isSheetOpen]);

    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
                <div
                    className={`fixed bottom-44 left-0 z-40 transition-all duration-700 ease-in-out cursor-pointer shadow-lg hover:shadow-xl
                    ${isExpanded ? "translate-x-0 pr-6 pl-4" : "-translate-x-1/2 pl-8 pr-3 hover:translate-x-[-40%]"}
                    h-12 flex items-center gap-2 rounded-r-full bg-gradient-to-r from-amber-400 to-rose-600 text-white`}
                    onClick={() => setIsExpanded(true)}
                >
                    <div className={`transition-transform duration-700 ${isExpanded ? "rotate-0" : "rotate-12 scale-110"}`}>
                        <Wrench size={20} className="text-white" />
                    </div>

                    <span className={`text-sm font-bold whitespace-nowrap transition-all duration-500 ${isExpanded ? "opacity-100 max-w-[100px]" : "opacity-0 max-w-0 overflow-hidden"}`}>
                        خدمات
                    </span>
                </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-xl h-[50vh]">
                <SheetHeader>
                    <SheetTitle className="text-center font-bold font-sans">خدمات وب‌سایت</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-4 p-4">
                    <div className="p-4 bg-gray-50 rounded-lg text-center text-xs flex items-center justify-center h-20 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer border border-gray-100">پیگیری سفارش</div>
                    <div className="p-4 bg-gray-50 rounded-lg text-center text-xs flex items-center justify-center h-20 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer border border-gray-100">اسمبل هوشمند</div>
                    <div className="p-4 bg-gray-50 rounded-lg text-center text-xs flex items-center justify-center h-20 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer border border-gray-100">پشتیبانی</div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
