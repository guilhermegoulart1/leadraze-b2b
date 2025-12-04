import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Link as LinkIcon, Users, DollarSign,
  Copy, Check, ExternalLink, LogOut, TrendingUp, Clock,
  Building2, ChevronRight
} from 'lucide-react';
import api from '../../services/api';

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const [partner, setPartner] = useState(null);
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    if (!token) {
      navigate('/partner/login');
      return;
    }

    loadData();
  }, [navigate]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('partner_token');

      // Set auth header for partner requests
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      const [profileRes, statsRes, referralsRes, earningsRes, accountsRes] = await Promise.all([
        api.get('/partners/me', config),
        api.get('/partners/stats', config),
        api.get('/partners/referrals', config),
        api.get('/partners/earnings', config),
        api.get('/partners/accounts', config)
      ]);

      if (profileRes.data.success) setPartner(profileRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (referralsRes.data.success) setReferrals(referralsRes.data.data.referrals || []);
      if (earningsRes.data.success) setEarnings(earningsRes.data.data.earnings || []);
      if (accountsRes.data.success) setAccounts(accountsRes.data.data || []);
    } catch (error) {
      console.error('Error loading partner data:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_data');
    navigate('/partner/login');
  };

  const copyLink = () => {
    if (stats?.link?.url) {
      navigator.clipboard.writeText(stats.link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAccessAccount = async (accountId) => {
    try {
      const token = localStorage.getItem('partner_token');
      const response = await api.post(`/partners/access-account/${accountId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Store the user token and redirect to main app
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('partner_access', 'true');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error accessing account:', error);
      alert(error.response?.data?.message || 'Erro ao acessar conta');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <img src="/logo/getraze-purple.svg" alt="GetRaze" className="h-8" />
              <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                Partner Portal
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{partner?.name}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <LinkIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.link?.clicks || 0}</p>
                <p className="text-sm text-gray-500">Cliques no Link</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.referrals?.total || 0}</p>
                <p className="text-sm text-gray-500">Indicados</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.referrals?.converted || 0}</p>
                <p className="text-sm text-gray-500">Convertidos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  ${((stats?.earnings?.total_cents || 0) / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500">Ganhos Totais</p>
              </div>
            </div>
          </div>
        </div>

        {/* Affiliate Link Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Seu Link de Afiliado</h3>
              <p className="text-purple-200 text-sm">Compartilhe este link para ganhar comissões</p>
            </div>
            <div className="flex items-center gap-3">
              <code className="bg-white/20 px-4 py-2 rounded-lg text-sm font-mono">
                {stats?.link?.url || 'Carregando...'}
              </code>
              <button
                onClick={copyLink}
                className="bg-white text-purple-600 px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-purple-50 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {[
            { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
            { id: 'referrals', label: 'Indicados', icon: Users },
            { id: 'earnings', label: 'Ganhos', icon: DollarSign },
            { id: 'accounts', label: 'Contas com Acesso', icon: Building2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Referrals */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Indicados Recentes</h3>
              {referrals.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum indicado ainda</p>
              ) : (
                <div className="space-y-3">
                  {referrals.slice(0, 5).map((referral, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{referral.referred_email}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(referral.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        referral.status === 'converted'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {referral.status === 'converted' ? 'Convertido' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Earnings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ganhos Recentes</h3>
              {earnings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhum ganho ainda</p>
              ) : (
                <div className="space-y-3">
                  {earnings.slice(0, 5).map((earning, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{earning.referred_email}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(earning.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="text-green-600 font-semibold">
                        +${(earning.earning_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'referrals' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Todos os Indicados</h3>
            </div>
            {referrals.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Você ainda não tem indicados</p>
                <p className="text-sm mt-2">Compartilhe seu link para começar a ganhar!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {referrals.map((referral, index) => (
                  <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{referral.referred_email}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Clock className="w-4 h-4" />
                          {new Date(referral.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      referral.status === 'converted'
                        ? 'bg-green-100 text-green-600'
                        : referral.status === 'canceled'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {referral.status === 'converted' ? 'Convertido' :
                       referral.status === 'canceled' ? 'Cancelado' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'earnings' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Histórico de Ganhos</h3>
            </div>
            {earnings.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Você ainda não tem ganhos</p>
                <p className="text-sm mt-2">Seus ganhos aparecerão aqui quando seus indicados pagarem</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {earnings.map((earning, index) => (
                  <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{earning.referred_email}</p>
                        <p className="text-sm text-gray-500">
                          Pagamento de ${(earning.invoice_amount_cents / 100).toFixed(2)} • {earning.commission_percent}% comissão
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-600 font-semibold">+${(earning.earning_cents / 100).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(earning.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Contas com Acesso Autorizado</h3>
              <p className="text-sm text-gray-500 mt-1">
                Clientes que concederam acesso para você gerenciar suas contas
              </p>
            </div>
            {accounts.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhum cliente autorizou acesso</p>
                <p className="text-sm mt-2">Quando seus clientes concederem acesso, eles aparecerão aqui</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {accounts.map((account, index) => (
                  <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{account.account_name || 'Conta'}</p>
                        <p className="text-sm text-gray-500">{account.admin_email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAccessAccount(account.account_id)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Acessar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PartnerDashboard;
