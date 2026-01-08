// frontend/src/pages/AuthCallbackPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AuthCallbackPage = () => {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser, setToken } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get token and user from URL params
        const token = searchParams.get('token');
        const userJson = searchParams.get('user');

        if (!token || !userJson) {
          throw new Error(t('callback.tokenNotFound'));
        }

        // Parse user data
        const user = JSON.parse(decodeURIComponent(userJson));

        // Save to localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update auth context
        setToken(token);
        setUser(user);

        // Redirect immediately
        navigate('/');

      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message || t('callback.processingError'));

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, setUser, setToken, t]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">

        {!error ? (
          <>
            {/* Loading Spinner */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
                <Loader className="w-10 h-10 text-purple-600 animate-spin" />
              </div>
            </div>

            {/* Message */}
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {t('callback.authenticating')}
            </h2>

            <p className="text-gray-600 mb-6">
              {t('callback.processing')}
            </p>

            {/* Bouncing Dots */}
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </>
        ) : (
          <>
            {/* Error Icon */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
            </div>

            {/* Error Message */}
            <h2 className="text-2xl font-bold text-red-900 mb-3">
              {t('callback.oops')}
            </h2>

            <p className="text-gray-600 mb-6">
              {error}
            </p>

            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {t('callback.backToLogin')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
