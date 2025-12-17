import axios from "axios";

// Get API base URL from environment variable or default to localhost
const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

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

// Request interceptor - Add auth token if available
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
    return response;
  },
  (error) => {
    // Handle different error scenarios
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;

      switch (status) {
        case 401:
          console.error("Unauthorized - Please login");
          // Optional: redirect to login page on client
          if (typeof window !== "undefined") {
            // Avoid redirect loops on auth pages
            const isAuthPage = window.location.pathname.startsWith("/login");
            if (!isAuthPage) {
              window.location.href = "/login";
            }
          }
          // Redirect to login page if needed
          break;
        case 404:
          console.error("Resource not found");
          break;
        case 500:
          console.error("Server error:", data?.error || data?.message || "Unknown server error");
          break;
        default:
          console.error(`Error: ${data?.message || "Something went wrong"}`);
      }
    } else if (error.request) {
      // Request was made but no response received (server not running)
      // Use console.warn in development to reduce noise
      if (process.env.NODE_ENV === 'development') {
        console.warn("[API] Server unreachable - is backend running?");
      }
    } else {
      // Something else happened
      console.error("Error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
