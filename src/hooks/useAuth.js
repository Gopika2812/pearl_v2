import { useState, useCallback } from 'react';

const useAuth = () => {
  const [user, setUser] = useState(() => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  });
  
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (username, password, apiBase) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/branch-users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.data));
      
      setToken(data.token);
      setUser(data.data);

      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const hasRole = useCallback((roles) => {
    if (!user) return false;
    if (!Array.isArray(roles)) roles = [roles];
    return roles.includes(user.role);
  }, [user]);

  const isAdmin = useCallback(() => user?.role === 'ADMIN', [user]);
  const isManager = useCallback(() => user?.role === 'MANAGER', [user]);
  const isStaff = useCallback(() => user?.role === 'STAFF', [user]);

  return {
    user,
    token,
    loading,
    error,
    login,
    logout,
    hasRole,
    isAdmin,
    isManager,
    isStaff,
    isAuthenticated: !!token,
  };
};

export default useAuth;
