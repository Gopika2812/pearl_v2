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
export const createApiClient = (axiosInstance) => {
  const instance = axiosInstance.create({
    baseURL: API_BASE,
    timeout: 60000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor for authentication
  instance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Add response interceptor for better error handling
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        console.warn("🔐 401 Unauthorized: Session may have expired.");
      } else if (error.response?.status === 404) {
        console.error(
          `❌ 404 Error: Backend endpoint not found at ${API_BASE}`
        );
      } else if (error.response?.status === 503) {
        console.error(`⚠️  503 Service Unavailable: Backend is temporarily down`);
      } else if (!error.response) {
        console.error(`❌ Network Error: Cannot reach backend at ${API_BASE}`);
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

// Utility to fetch with Authorization header
export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  
  // Create headers object
  const headers = { ...options.headers };

  // Default to application/json if not FormData and not already set
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // If Content-Type is explicitly set to undefined or null, remove it
  // This allows the browser to set it (e.g. for FormData)
  if (headers["Content-Type"] === undefined || headers["Content-Type"] === null) {
    delete headers["Content-Type"];
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  console.log(`🌐 API Request: ${url}`);
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.clone().text();
    console.error(`❌ API Error [${response.status}]:`, errorBody);
  }

  if (response.status === 401) {
    console.warn("🔐 401 Unauthorized: Session may have expired. Redirecting to login...");
    // Optionally trigger a logout or redirect here if needed
  }

  return response;
};

// Global authenticated axios instance (to be used with axios dependency)
// Note: Callers should pass the axios library to createApiClient if needed,
// but for simple components, we can just use the instance.
import axios from "axios";
export const apiWithAuth = createApiClient(axios);

// Export app environment
export { APP_ENV };

