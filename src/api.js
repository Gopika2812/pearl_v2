// Centralized API Configuration
// Uses environment variables for backend URL

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  console.error(
    "❌ VITE_API_BASE_URL is not configured. Please check your .env file.",
    "Using production server: https://pearls-erp-2026.onrender.com"
  );
}

export const API_BASE = API_BASE_URL ? `${API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

// Utility function to get the API endpoint
export const getAPIEndpoint = (path) => {
  return `${API_BASE}${path}`;
};

// Export app environment
export const APP_ENV = import.meta.env.VITE_APP_ENV || "production";

