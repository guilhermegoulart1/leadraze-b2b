import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há usuário salvo
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('authToken');

    if (savedUser && savedToken) {
      setUserState(JSON.parse(savedUser));
      setTokenState(savedToken);
    }

    setLoading(false);
  }, []);

  // Função para atualizar usuário
  const setUser = (userData) => {
    setUserState(userData);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('user');
    }
  };

  // Função para atualizar token
  const setToken = (newToken) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('authToken', newToken);
    } else {
      localStorage.removeItem('authToken');
    }
  };

  const login = async (email, password) => {
    const response = await api.login(email, password);
    
    if (response.success) {
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response;
  };

  const register = async (userData) => {
    const response = await api.register(userData);
    
    if (response.success) {
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response;
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
  };

  // Role-based access control functions
  const hasRole = (requiredRole) => {
    if (!user || !user.role) return false;

    // If requiredRole is an array, check if user has any of them
    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role);
    }

    return user.role === requiredRole;
  };

  const hasPermission = (permission) => {
    if (!user) return false;

    // Admin has all permissions
    if (user.role === 'admin') return true;

    // Check if user has specific permission (from backend)
    if (user.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(permission);
    }

    return false;
  };

  const hasAnyPermission = (permissions) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    if (!Array.isArray(permissions)) return false;

    return permissions.some(perm => hasPermission(perm));
  };

  // Convenience role checks
  const isAdmin = user?.role === 'admin';
  const isSupervisor = user?.role === 'supervisor';
  const isUser = user?.role === 'user';

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    setUser,
    setToken,
    isAuthenticated: !!user,
    // Role & Permission checks
    hasRole,
    hasPermission,
    hasAnyPermission,
    isAdmin,
    isSupervisor,
    isUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};