"use client";
import { GoogleOAuthProvider } from "@react-oauth/google";

/**
 * Google OAuth Provider Wrapper
 *
 * Wraps the application with GoogleOAuthProvider for Google authentication.
 * Requires NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.
 */
let hasWarnedAboutMissingGoogleClientId = false;

export default function GoogleAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    if (process.env.NODE_ENV === "development" && !hasWarnedAboutMissingGoogleClientId) {
      console.warn("[GOOGLE AUTH] NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured");
      hasWarnedAboutMissingGoogleClientId = true;
    }
    // Return children without Google OAuth if client ID is not configured
    return <>{children}</>;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {children}
    </GoogleOAuthProvider>
  );
}
