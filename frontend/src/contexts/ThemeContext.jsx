import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const { user, setUser } = useAuth();
  const [theme, setTheme] = useState('light'); // 'light' | 'dark' | 'system'
  const [systemTheme, setSystemTheme] = useState('light');

  // Detect OS theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Set initial system theme
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Calculate actual theme (resolve 'system' to 'light' or 'dark')
  const actualTheme = theme === 'system' ? systemTheme : theme;
  const isDark = actualTheme === 'dark';

  // Apply theme to HTML element
  useEffect(() => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Load theme on mount and when user changes
  useEffect(() => {
    // Priority: 1. User preference from backend, 2. localStorage, 3. default 'light'
    if (user?.preferred_theme) {
      // Load from user data (from backend)
      setTheme(user.preferred_theme);
    } else {
      // Load from localStorage
      const savedTheme = localStorage.getItem('userTheme');
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
    }
  }, [user]);

  // Change theme function
  const changeTheme = async (newTheme) => {
    if (!['light', 'dark', 'system'].includes(newTheme)) {
      console.error('Invalid theme:', newTheme);
      return;
    }

    // Update local state
    setTheme(newTheme);

    // Save to localStorage immediately
    localStorage.setItem('userTheme', newTheme);

    // Save to backend if user is logged in
    if (user) {
      try {
        const response = await api.updateUserProfile({
          preferred_theme: newTheme
        });

        if (response.success && response.data.user) {
          // Update user in AuthContext with new theme
          setUser(response.data.user);
        }
      } catch (error) {
        console.error('Error saving theme to backend:', error);
        // Still works locally even if backend fails
      }
    }
  };

  const value = {
    theme,           // User's theme preference ('light' | 'dark' | 'system')
    actualTheme,     // Resolved theme ('light' | 'dark')
    systemTheme,     // OS theme preference ('light' | 'dark')
    isDark,          // Boolean: is dark mode active?
    changeTheme,     // Function to change theme
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
