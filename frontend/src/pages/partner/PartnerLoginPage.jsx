import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import api from '../../services/api';

const PartnerLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/partners/login', { email, password });

      if (response.data.success) {
        // Store partner token and data
        localStorage.setItem('partner_token', response.data.data.token);
        localStorage.setItem('partner_data', JSON.stringify(response.data.data.partner));
        navigate('/partner');
      } else {
        setError(response.data.message || 'Erro ao fazer login');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex">

        {/* LEFT SIDE - Purple Hero */}
        <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #5f1fd1, #4c1d95)' }}>
          <div className="relative z-10">
            <img
              src="/logo/getraze-white.svg"
              alt="GetRaze"
              className="h-8 w-auto"
            />
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Partner Portal
            </h1>
            <p className="text-purple-100 text-lg">
              Gerencie seus indicados, acompanhe comissões<br />
              e acesse as contas dos seus clientes.
            </p>
          </div>

          <div className="relative z-10 text-purple-200 text-sm">
            © 2025 GetRaze Partners
          </div>
        </div>

        {/* RIGHT SIDE - Login Form */}
        <div className="flex-1 p-12 flex flex-col justify-center">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img
              src="/logo/getraze-purple.svg"
              alt="GetRaze"
              className="h-10 w-auto"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Acesso de Partners
            </h2>
            <p className="text-gray-600">
              Entre com suas credenciais para acessar o portal
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Ainda não é partner?{' '}
            <a href="https://getraze.co/partners" className="text-purple-600 hover:underline font-medium">
              Cadastre-se aqui
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PartnerLoginPage;
