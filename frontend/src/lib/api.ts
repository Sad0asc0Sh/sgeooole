import axios from "axios";

// Get API base URL from environment variable or default to localhost
const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

// Create axios instance with default configuration
const api = axios.create({
  baseURL,
  timeout: 30000, // 30 second timeout
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
      // Request was made but no response received
      console.error("Network error - Unable to reach server");
    } else {
      // Something else happened
      console.error("Error:", error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
