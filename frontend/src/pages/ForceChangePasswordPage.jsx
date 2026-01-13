import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Check, Eye, EyeOff, Shield } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ForceChangePasswordPage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Password strength validation
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password && password === confirmPassword;
  const isPasswordStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber;

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
      const response = await api.forceChangePassword(password);

      if (response.success) {
        // Update user in context (must_change_password is now false)
        const updatedUser = { ...user, must_change_password: false };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);

        setSuccess(true);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        setError(response.message || 'Erro ao definir senha');
      }
    } catch (err) {
      setError(err.message || 'Erro ao definir senha');
    } finally {
      setLoading(false);
    }
  };

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
            <p className="text-gray-600 mb-6">Agora você pode acessar todas as funcionalidades da plataforma.</p>

            <div className="flex items-center justify-center gap-2 text-purple-600">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-600 border-t-transparent"></div>
              <span>Acessando o dashboard...</span>
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
              Bem-vindo ao time!
            </h1>
            <p className="text-purple-100 text-lg">
              Você foi adicionado ao time. Configure sua senha<br />
              para começar a usar a plataforma.
            </p>
          </div>

          {/* Security info */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3 text-purple-100">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span>Sua senha é criptografada e segura</span>
            </div>
            <div className="flex items-center gap-3 text-purple-100">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span>Acesso completo à plataforma</span>
            </div>
            <div className="flex items-center gap-3 text-purple-100">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
              <span>Colabore com seu time</span>
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
              Para sua segurança, defina uma senha para acessar sua conta
            </p>
          </div>

          {/* User Info */}
          {user?.email && (
            <div className="mb-6 bg-purple-50 border border-purple-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">
                    {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
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
                  autoFocus
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
                'Criar Senha e Continuar'
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

export default ForceChangePasswordPage;
