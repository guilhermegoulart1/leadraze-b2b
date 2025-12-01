import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Gift,
  Link as LinkIcon,
  Users,
  DollarSign,
  Copy,
  Check,
  MousePointerClick,
  UserCheck,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import api from '../services/api';

const AffiliatePage = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('referrals');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, referralsRes, earningsRes] = await Promise.all([
        api.get('/affiliate/stats'),
        api.get('/affiliate/referrals'),
        api.get('/affiliate/earnings')
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (referralsRes.success) setReferrals(referralsRes.data.referrals || []);
      if (earningsRes.success) setEarnings(earningsRes.data.earnings || []);
    } catch (err) {
      console.error('Error fetching affiliate data:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (stats?.link?.url) {
      try {
        await navigator.clipboard.writeText(stats.link.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      converted: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
      canceled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelado' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Gift className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Affiliate Program</h1>
            <p className="text-gray-500">Indique amigos e ganhe 10% de comissão recorrente</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Affiliate Link Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="p-2 bg-purple-100 rounded-lg">
              <LinkIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2 font-mono text-sm text-gray-700 border border-gray-200">
              {stats?.link?.url || 'Carregando...'}
            </div>
          </div>
          <button
            onClick={copyToClipboard}
            className="ml-3 flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Cliques</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.link?.clicks || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <MousePointerClick className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Conversões</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.referrals?.converted || 0}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Ganhos do Mês</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.earnings?.monthly_cents || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Acumulado</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats?.earnings?.total_cents || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('referrals')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'referrals'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Indicados ({referrals.length})</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'earnings'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4" />
                <span>Histórico de Ganhos ({earnings.length})</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'referrals' && (
            <>
              {referrals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum indicado ainda</h3>
                  <p className="text-gray-500">Compartilhe seu link e comece a ganhar comissões!</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Email</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Data</th>
                      <th className="pb-3 font-medium text-right">Ganhos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {referrals.map((referral) => (
                      <tr key={referral.id} className="text-sm">
                        <td className="py-4 text-gray-900">{referral.referred_email}</td>
                        <td className="py-4">{getStatusBadge(referral.status)}</td>
                        <td className="py-4 text-gray-500">{formatDate(referral.converted_at || referral.created_at)}</td>
                        <td className="py-4 text-right font-medium text-green-600">
                          {formatCurrency(referral.total_earnings_cents || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {activeTab === 'earnings' && (
            <>
              {earnings.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum ganho ainda</h3>
                  <p className="text-gray-500">Seus ganhos aparecerão aqui quando seus indicados pagarem.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Indicado</th>
                      <th className="pb-3 font-medium">Valor Pago</th>
                      <th className="pb-3 font-medium">Comissão</th>
                      <th className="pb-3 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {earnings.map((earning) => (
                      <tr key={earning.id} className="text-sm">
                        <td className="py-4 text-gray-900">{earning.referred_email}</td>
                        <td className="py-4 text-gray-500">{formatCurrency(earning.invoice_amount_cents)}</td>
                        <td className="py-4 font-medium text-green-600">
                          +{formatCurrency(earning.earning_cents)}
                        </td>
                        <td className="py-4 text-gray-500">{formatDate(earning.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-medium text-blue-900 mb-2">Como funciona?</h3>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>1. Compartilhe seu link de afiliado com amigos e colegas</li>
          <li>2. Quando alguém assinar usando seu link, você ganha 10% de comissão</li>
          <li>3. A comissão é recorrente enquanto o indicado permanecer ativo</li>
          <li>4. Os ganhos são acumulados e você poderá solicitar pagamento em breve</li>
        </ul>
      </div>
    </div>
  );
};

export default AffiliatePage;
