import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Mail, Check, X, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

const SetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Password strength validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordsMatch = password && password === confirmPassword;
  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setError('Token inválido ou expirado');
      return;
    }

    // Validate token
    const validateToken = async () => {
      try {
        const response = await api.validateResetToken(token);
        if (response.success) {
          setTokenValid(true);
          setUserEmail(response.data?.email || '');
        } else {
          setError('Token inválido ou expirado');
        }
      } catch (err) {
        setError('Token inválido ou expirado');
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (!isPasswordStrong) {
      setError('A senha deve ter pelo menos 8 caracteres, uma letra maiúscula, uma minúscula e um número');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.resetPassword(token, password);

      if (response.success) {
        const email = response.data?.email || userEmail;
        setSuccess(true);
        setTimeout(() => {
          // Navigate to login with email pre-filled
          navigate(`/login?email=${encodeURIComponent(email)}`);
        }, 3000);
      } else {
        setError(response.message || 'Erro ao definir senha');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-purple-600 border-t-transparent"></div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid && !success) {
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
            <p className="text-gray-600 mb-8">{error || 'Este link não é mais válido. Solicite um novo link de acesso.'}</p>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-purple-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              Ir para Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
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

            <h1 className="text-2xl font-bold text-gray-900 mb-3">Senha Criada com Sucesso!</h1>
            <p className="text-gray-600 mb-2">Sua senha foi definida. Você será redirecionado para o login...</p>
            {userEmail && (
              <p className="text-purple-600 font-medium mb-6">{userEmail}</p>
            )}

            <div className="flex items-center justify-center gap-2 text-purple-600">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
              <span>Redirecionando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex">

        {/* LEFT SIDE - Purple Hero */}
        <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #5f1fd1, #4c1d95)' }}>
          {/* Logo */}
          <div className="relative z-10">
            <img
              src="/logo/getraze-white.svg"
              alt="GetRaze"
              className="h-8 w-auto"
            />
          </div>

          {/* Main Content */}
          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Bem-vindo à GetRaze!
            </h1>
            <p className="text-purple-100 text-lg">
              Configure sua senha para acessar a plataforma<br />
              e começar a automatizar suas vendas.
            </p>
          </div>

          {/* Features */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3 text-purple-100">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span>Prospecção automatizada no LinkedIn</span>
            </div>
            <div className="flex items-center gap-3 text-purple-100">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span>Busca de leads no Google Maps</span>
            </div>
            <div className="flex items-center gap-3 text-purple-100">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span>Inteligência Artificial para mensagens</span>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-purple-200 text-sm">
            © 2025 GetRaze • Deals Drop
          </div>
        </div>

        {/* RIGHT SIDE - Password Form */}
        <div className="flex-1 p-12 flex flex-col justify-center">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img
              src="/logo/getraze-purple.svg"
              alt="GetRaze"
              className="h-10 w-auto"
            />
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Criar sua Senha
            </h2>
            <p className="text-gray-600">
              Defina uma senha segura para acessar sua conta
            </p>
          </div>

          {/* Email Info */}
          {userEmail && (
            <div className="mb-6 bg-purple-50 border border-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Criando senha para</p>
                  <p className="font-semibold text-purple-700">{userEmail}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nova Senha
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all outline-none"
                  placeholder="Senha forte"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all outline-none"
                  placeholder="Digite a senha novamente"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="text-sm text-gray-500 space-y-1.5 bg-gray-50 rounded-xl p-4">
              <p className="font-medium text-gray-700 mb-2">Requisitos da senha:</p>
              <p className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : ''}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${hasMinLength ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {hasMinLength && <Check className="w-3 h-3" />}
                </span>
                Pelo menos 8 caracteres
              </p>
              <p className={`flex items-center gap-2 ${hasUppercase ? 'text-green-600' : ''}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${hasUppercase ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {hasUppercase && <Check className="w-3 h-3" />}
                </span>
                Uma letra maiúscula
              </p>
              <p className={`flex items-center gap-2 ${hasLowercase ? 'text-green-600' : ''}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${hasLowercase ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {hasLowercase && <Check className="w-3 h-3" />}
                </span>
                Uma letra minúscula
              </p>
              <p className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : ''}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${hasNumber ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {hasNumber && <Check className="w-3 h-3" />}
                </span>
                Um número
              </p>
              <p className={`flex items-center gap-2 ${passwordsMatch ? 'text-green-600' : ''}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordsMatch ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {passwordsMatch && <Check className="w-3 h-3" />}
                </span>
                Senhas coincidem
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isPasswordStrong || !passwordsMatch}
              className="w-full bg-purple-600 text-white font-semibold py-3.5 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Criando...
                </>
              ) : (
                'Criar Senha e Acessar'
              )}
            </button>
          </form>

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

export default SetPasswordPage;
