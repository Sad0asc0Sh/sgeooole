"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import CompactAuthModal from "@/components/auth/CompactAuthModal";
import { authService } from "@/services/authService";

type RequireAuthOptions = {
  title?: string;
  description?: string;
};

type AuthModalContextValue = {
  requireAuth: (options?: RequireAuthOptions) => Promise<boolean>;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export const useAuthModal = (): AuthModalContextValue => {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
};

export default function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<RequireAuthOptions | undefined>(undefined);
  const resolverRef = useRef<((result: boolean) => void) | null>(null);
  const pendingPromiseRef = useRef<Promise<boolean> | null>(null);

  const close = useCallback((result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
    pendingPromiseRef.current = null;
  }, []);

  const requireAuth = useCallback(async (nextOptions?: RequireAuthOptions) => {
    if (authService.isAuthenticated()) return true;

    setOptions(nextOptions);
    setOpen(true);

    if (pendingPromiseRef.current) return pendingPromiseRef.current;

    pendingPromiseRef.current = new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });

    return await pendingPromiseRef.current;
  }, []);

  const value = useMemo<AuthModalContextValue>(() => ({ requireAuth }), [requireAuth]);
  const handleClose = useCallback(() => close(false), [close]);
  const handleAuthenticated = useCallback(() => close(true), [close]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <CompactAuthModal
        open={open}
        title={options?.title}
        description={options?.description}
        onClose={handleClose}
        onAuthenticated={handleAuthenticated}
      />
    </AuthModalContext.Provider>
  );
}
