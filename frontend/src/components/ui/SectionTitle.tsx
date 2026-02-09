import React from "react";

export const SectionTitle = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={`px-4 mb-4 ${className}`}>
        <h2 className="relative inline-block text-lg font-bold text-ekg-900 z-10 px-1">
            {children}
            <span className="absolute bottom-1 left-0 w-full h-2.5 bg-kala-400/40 -z-10 -skew-x-12 rounded-sm"></span>
        </h2>
    </div>
);
