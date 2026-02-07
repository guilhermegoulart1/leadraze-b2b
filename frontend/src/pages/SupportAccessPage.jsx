import React, { useState } from 'react';
import { Key, Shield, AlertTriangle, Loader, CheckCircle, ArrowRight } from 'lucide-react';
import api from '../services/api';

const SupportAccessPage = () => {
  const [token, setToken] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorEmail, setOperatorEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      setError('Token e obrigatorio');
      return;
    }

    if (!operatorName.trim()) {
      setError('Nome do operador e obrigatorio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/support-access/authenticate', {
        token: token.trim(),
        operatorName: operatorName.trim(),
        operatorEmail: operatorEmail.trim() || undefined
      });

      if (response.success) {
        // Clear any existing regular session to avoid conflicts
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');

        // Salva o token de sessao e informacoes
        localStorage.setItem('supportSessionToken', response.data.sessionToken);
        localStorage.setItem('supportSession', JSON.stringify({
          sessionId: response.data.sessionId,
          accountId: response.data.account.id,
          accountName: response.data.account.name,
          accountSlug: response.data.account.slug,
          scope: response.data.scope,
          purpose: response.data.purpose,
          expiresAt: response.data.expiresAt,
          startedAt: response.data.sessionStartedAt,
          operatorName: operatorName.trim()
        }));

        setSuccess(true);

        // Redireciona para o dashboard apos 2 segundos
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (err) {
      console.error('Error authenticating:', err);
      setError(err.message || 'Erro ao autenticar. Verifique o token e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso Autorizado!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Redirecionando para o dashboard...
          </p>
          <Loader className="w-6 h-6 text-purple-600 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso de Suporte
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Insira o token fornecido pelo cliente para acessar a conta
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Token de Acesso *
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="sat_..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seu Nome *
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Ex: Joao da Equipe GetRaze"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seu Email (opcional)
            </label>
            <input
              type="email"
              value={operatorEmail}
              onChange={(e) => setOperatorEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim() || !operatorName.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Autenticando...
              </>
            ) : (
              <>
                Acessar Conta
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">Informacoes Importantes</h4>
          <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <li>O token foi gerado pelo cliente e tem duracao limitada</li>
            <li>Todas as suas acoes serao registradas para auditoria</li>
            <li>Voce tera acesso apenas as funcionalidades autorizadas</li>
            <li>O cliente pode revogar seu acesso a qualquer momento</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            Voltar para login normal
          </a>
        </div>
      </div>
    </div>
  );
};

export default SupportAccessPage;
