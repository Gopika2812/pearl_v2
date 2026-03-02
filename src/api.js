// Centralized API Configuration
// Uses environment variables for backend URL

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const APP_ENV = import.meta.env.VITE_APP_ENV || "production";

// Determine which backend to use
const DEFAULT_BACKEND = "https://pearls-erp-2026.onrender.com";
const FALLBACK_API = `${DEFAULT_BACKEND}/api`;

export const API_BASE = API_BASE_URL ? `${API_BASE_URL}/api` : FALLBACK_API;

// Log API configuration (for debugging)
if (typeof window !== "undefined") {
  console.log("🔧 API Configuration:");
  console.log(`   Environment: ${APP_ENV}`);
  console.log(`   Backend URL: ${API_BASE}`);
  if (!API_BASE_URL) {
    console.warn(
      "⚠️  VITE_API_BASE_URL not configured. Using default: " + DEFAULT_BACKEND
    );
  }
}

// Utility function to get the API endpoint
export const getAPIEndpoint = (path) => {
  return `${API_BASE}${path}`;
};

// Utility to create axios instance with proper error handling
export const createApiClient = (axios) => {
  const instance = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add response interceptor for better error handling
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 404) {
        console.error(
          `❌ 404 Error: Backend endpoint not found at ${API_BASE}`,
          `\n   Check if backend is deployed and running.`
        );
      } else if (error.response?.status === 503) {
        console.error(
          `⚠️  503 Service Unavailable: Backend is temporarily down`,
          `\n   The backend server at ${DEFAULT_BACKEND} may be restarting.`,
          `\n   Try again in a few moments.`
        );
      } else if (!error.response) {
        console.error(
          `❌ Network Error: Cannot reach backend at ${API_BASE}`,
          `\n   Possible causes:`,
          `\n   - Backend server is not running`,
          `\n   - Network connection issue`,
          `\n   - CORS configuration issue`
        );
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Export app environment
export { APP_ENV };

