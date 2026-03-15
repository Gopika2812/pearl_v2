/**
 * API Utility with JWT Token Support
 * Automatically adds JWT token to all requests
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ? `${import.meta.env.VITE_API_BASE_URL}/api` : "https://pearls-erp-2026.onrender.com/api";

/**
 * Get Authorization Headers with JWT
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * Fetch wrapper with automatic JWT inclusion
 */
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    // Handle 401 - Unauthorized (token expired or invalid)
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/branch-login';
      throw new Error('Session expired. Please login again.');
    }

    // Handle 403 - Forbidden (insufficient permissions)
    if (response.status === 403) {
      throw new Error('You do not have permission to access this resource.');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP Error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
};

/**
 * Convenience methods
 */
export const api = {
  get: (endpoint, options) => apiCall(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiCall(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body, options) => apiCall(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (endpoint, body, options) => apiCall(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
  delete: (endpoint, options) => apiCall(endpoint, { ...options, method: 'DELETE' }),
};

export default apiCall;
