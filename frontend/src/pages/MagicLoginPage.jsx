import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, X, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MagicLoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { setUser } = useAuth();

  const [status, setStatus] = useState('validating'); // 'validating' | 'success' | 'error'
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Link inválido. Nenhum token encontrado.');
      return;
    }

    const performMagicLogin = async () => {
      try {
        const response = await api.magicLogin(token);

        if (response.success) {
          // Store user in context and localStorage
          const userData = response.data.user;
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);

          setStatus('success');

          // Redirect to force change password page
          setTimeout(() => {
            navigate('/force-change-password', { replace: true });
          }, 1500);
        } else {
          setStatus('error');
          setError(response.message || 'Link inválido ou expirado');
        }
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Link inválido ou expirado');
      }
    };

    performMagicLogin();
  }, [token, navigate, setUser]);

  // Loading state
  if (status === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo/getraze-purple.svg"
                alt="GetRaze"
                className="h-10 w-auto"
              />
            </div>

            {/* Loading Icon */}
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">Validando seu acesso...</h1>
            <p className="text-gray-600">Aguarde enquanto verificamos seu link de acesso.</p>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo/getraze-purple.svg"
                alt="GetRaze"
                className="h-10 w-auto"
              />
            </div>

            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">Acesso validado!</h1>
            <p className="text-gray-600 mb-4">Você será redirecionado para criar sua senha...</p>

            <div className="flex items-center justify-center gap-2 text-purple-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Redirecionando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/logo/getraze-purple.svg"
              alt="GetRaze"
              className="h-10 w-auto"
            />
          </div>

          {/* Error Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-red-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-3">Link Expirado</h1>
          <p className="text-gray-600 mb-8">
            {error || 'Este link não é mais válido. Entre em contato com o administrador para solicitar um novo link de acesso.'}
          </p>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-purple-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
          >
            Ir para Login
          </button>

          {/* Help Link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            Precisa de ajuda?{' '}
            <a href="mailto:suporte@getraze.co" className="text-purple-600 hover:text-purple-700 font-medium">
              Entre em contato
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default MagicLoginPage;
