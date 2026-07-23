"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

interface LayoutStateContextType {
    isProductPage: boolean;
    setIsProductPage: (isProduct: boolean) => void;
}

const LayoutStateContext = createContext<LayoutStateContextType>({
    isProductPage: false,
    setIsProductPage: () => {},
});

export default function LayoutStateProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [isProductPage, setIsProductPage] = useState(false);

    // Sync default state with pathname
    useEffect(() => {
        setIsProductPage(Boolean(pathname?.startsWith("/product/")));
    }, [pathname]);

    return (
        <LayoutStateContext.Provider value={{ isProductPage, setIsProductPage }}>
            {children}
        </LayoutStateContext.Provider>
    );
}

export function useLayoutState() {
    return useContext(LayoutStateContext);
}

