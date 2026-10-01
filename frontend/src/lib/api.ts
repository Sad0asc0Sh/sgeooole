import axios from "axios";
import { getOrCreateSessionId } from "./sessionId";
import { updateServerClock, updateServerClockFromPayload } from "./serverClock";

// Server-side: use internal URL to avoid loopback through nginx/SSL
// Client-side: use public URL
const baseURL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || "http://localhost:5000/api"
    : process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

// Fail fast during `next build` prerender to avoid build timeouts when the backend is unavailable.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PHASE === "phase-export";
const apiTimeoutMs = isBuildPhase ? 8000 : 30000;

// Create axios instance with default configuration
const api = axios.create({
  baseURL,
  timeout: apiTimeoutMs,
  headers: {
    "Content-Type": "application/json",
  },
});

const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/checkout",
  "/complete-profile",
  "/profile",
];

const isProtectedRoute = (pathname: string) =>
  PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

// Request interceptor - Add auth token if available
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const sessionId = getOrCreateSessionId();
      if (sessionId) {
        config.headers["x-session-id"] = sessionId;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    // ساعت سرور را از بدنه (serverNow) یا هدر Date به‌روز کن تا تصمیم‌های
    // «منقضی شد؟» با ساعت دستگاه جلو/عقب نروند. خرابی این مرحله نباید پاسخ را بشکند.
    try {
      updateServerClockFromPayload(response?.data);
      const dateHeader = response?.headers?.date;
      if (dateHeader) updateServerClock(dateHeader);
    } catch {
      // ignore clock sync errors
    }
    // SAFETY CHECK: Backend sometimes returns 200 OK with success: false
    // This ensures such responses still trigger the catch block downstream
    if (response.data && response.data.success === false) {
      const error = new Error(response.data.message || 'خطا در سرور');
      (error as any).response = {
        status: response.status,
        data: response.data,
      };
      (error as any).isBackendError = true;
      return Promise.reject(error);
    }
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          console.error("Unauthorized - Please login");
          if (typeof window !== "undefined") {
            const { pathname, search, hash } = window.location;
            const isAuthPage = pathname.startsWith("/login");
            if (!isAuthPage && isProtectedRoute(pathname)) {
              const redirectTo = `${pathname}${search}${hash}`;
              window.location.href = `/login?redirect=${encodeURIComponent(redirectTo)}`;
            }
          }
          break;
        case 429:
          console.error("Rate limited:", data?.message || "Too many requests");
          break;
        case 404:
          console.error("Resource not found");
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          console.error("Server error:", data?.error || data?.message || "Unknown server error");
          break;
        default:
          console.error(`Error (${status}):`, data?.message || "Something went wrong");
      }
    } else if (error.request) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("[API] Server unreachable - is backend running?");
      }
    } else {
      console.error("Error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
