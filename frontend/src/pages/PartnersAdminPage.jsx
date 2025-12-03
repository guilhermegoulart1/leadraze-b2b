import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Search,
  Filter,
  Check,
  X,
  Eye,
  RefreshCw,
  Mail,
  Phone,
  Building2,
  User,
  Globe,
  Clock,
  DollarSign,
  MousePointerClick,
  AlertCircle,
  Pause,
  Play,
  Trash2,
  Copy
} from 'lucide-react';
import api from '../services/api';

const PartnersAdminPage = () => {
  const { t } = useTranslation();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const limit = 20;

  useEffect(() => {
    fetchPartners();
  }, [page, statusFilter]);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);

      const response = await api.get(`/partners/admin?${params}`);

      if (response.success) {
        setPartners(response.data.partners);
        setTotal(response.data.total);
      }
    } catch (error) {
      console.error('Error fetching partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchPartners();
  };

  const handleApprove = async (partnerId) => {
    if (!confirm('Tem certeza que deseja aprovar este partner?')) return;

    setActionLoading(true);
    try {
      const response = await api.put(`/partners/admin/${partnerId}/approve`);

      if (response.success) {
        // Copy set password URL to clipboard
        if (response.data.set_password_url) {
          await navigator.clipboard.writeText(response.data.set_password_url);
          alert(`Partner aprovado! Link para definir senha copiado:\n${response.data.set_password_url}`);
        }
        fetchPartners();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error approving partner:', error);
      alert('Erro ao aprovar partner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (partnerId) => {
    if (!confirm('Tem certeza que deseja rejeitar este partner?')) return;

    setActionLoading(true);
    try {
      const response = await api.put(`/partners/admin/${partnerId}/reject`);

      if (response.success) {
        fetchPartners();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error rejecting partner:', error);
      alert('Erro ao rejeitar partner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async (partnerId) => {
    if (!confirm('Tem certeza que deseja suspender este partner?')) return;

    setActionLoading(true);
    try {
      const response = await api.put(`/partners/admin/${partnerId}/suspend`);

      if (response.success) {
        fetchPartners();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error suspending partner:', error);
      alert('Erro ao suspender partner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (partnerId) => {
    if (!confirm('Tem certeza que deseja reativar este partner?')) return;

    setActionLoading(true);
    try {
      const response = await api.put(`/partners/admin/${partnerId}/reactivate`);

      if (response.success) {
        fetchPartners();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error reactivating partner:', error);
      alert('Erro ao reativar partner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (partnerId) => {
    if (!confirm('Tem certeza que deseja EXCLUIR este partner? Esta ação não pode ser desfeita.')) return;

    setActionLoading(true);
    try {
      const response = await api.delete(`/partners/admin/${partnerId}`);

      if (response.success) {
        fetchPartners();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Error deleting partner:', error);
      alert('Erro ao excluir partner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendEmail = async (partnerId) => {
    setActionLoading(true);
    try {
      const response = await api.post(`/partners/admin/${partnerId}/resend-password-email`);

      if (response.success && response.data.set_password_url) {
        await navigator.clipboard.writeText(response.data.set_password_url);
        alert(`Link copiado para a área de transferência:\n${response.data.set_password_url}`);
      }
    } catch (error) {
      console.error('Error resending email:', error);
      alert('Erro ao reenviar email');
    } finally {
      setActionLoading(false);
    }
  };

  const viewPartnerDetails = async (partner) => {
    setSelectedPartner(partner);
    setShowDetailModal(true);

    // Fetch full details including stats
    try {
      const response = await api.get(`/partners/admin/${partner.id}`);
      if (response.success) {
        setSelectedPartner(response.data);
      }
    } catch (error) {
      console.error('Error fetching partner details:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprovado' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeitado' },
      suspended: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Suspenso' }
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (cents) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format((cents || 0) / 100);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gerenciar Partners</h1>
            <p className="text-gray-500">Aprovar, rejeitar e gerenciar partners</p>
          </div>
        </div>
        <button
          onClick={fetchPartners}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovados</option>
              <option value="rejected">Rejeitados</option>
              <option value="suspended">Suspensos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <Users className="w-8 h-8 text-gray-300" />
          </div>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-700">
                {partners.filter(p => p.status === 'pending').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-300" />
          </div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Aprovados</p>
              <p className="text-2xl font-bold text-green-700">
                {partners.filter(p => p.status === 'approved').length}
              </p>
            </div>
            <Check className="w-8 h-8 text-green-300" />
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Suspensos</p>
              <p className="text-2xl font-bold text-gray-700">
                {partners.filter(p => p.status === 'suspended').length}
              </p>
            </div>
            <Pause className="w-8 h-8 text-gray-300" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum partner encontrado</h3>
            <p className="text-gray-500">Aguarde novos cadastros de partners.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Partner</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">País</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cadastro</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {partners.map((partner) => (
                <tr key={partner.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{partner.name}</p>
                      <p className="text-sm text-gray-500">{partner.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {partner.type === 'company' ? (
                        <>
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Empresa</span>
                        </>
                      ) : (
                        <>
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">Individual</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{partner.country || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(partner.status)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(partner.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => viewPartnerDetails(partner)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {partner.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(partner.id)}
                            className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg"
                            title="Aprovar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(partner.id)}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title="Rejeitar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {partner.status === 'approved' && (
                        <button
                          onClick={() => handleSuspend(partner.id)}
                          className="p-2 text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg"
                          title="Suspender"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      )}

                      {partner.status === 'suspended' && (
                        <button
                          onClick={() => handleReactivate(partner.id)}
                          className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg"
                          title="Reativar"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total}
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedPartner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  {selectedPartner.type === 'company' ? (
                    <Building2 className="w-5 h-5 text-purple-600" />
                  ) : (
                    <User className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedPartner.name}</h2>
                  <p className="text-sm text-gray-500">{selectedPartner.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                {getStatusBadge(selectedPartner.status)}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Telefone</p>
                    <p className="text-sm font-medium">{selectedPartner.phone || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">País</p>
                    <p className="text-sm font-medium">{selectedPartner.country || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Cadastro</p>
                    <p className="text-sm font-medium">{formatDate(selectedPartner.created_at)}</p>
                  </div>
                </div>

                {selectedPartner.approved_at && (
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <Check className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-xs text-green-600">Aprovado em</p>
                      <p className="text-sm font-medium text-green-700">{formatDate(selectedPartner.approved_at)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Affiliate Code */}
              {selectedPartner.affiliate_code && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-2">Código de Afiliado</p>
                  <div className="flex items-center justify-between">
                    <code className="text-lg font-mono font-bold text-purple-700">
                      {selectedPartner.affiliate_code}
                    </code>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(`https://getraze.co?partner=${selectedPartner.affiliate_code}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center space-x-1 px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Stats (if approved) */}
              {selectedPartner.stats && (
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-900">Estatísticas</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <MousePointerClick className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-700">{selectedPartner.stats.link?.clicks || 0}</p>
                      <p className="text-xs text-blue-600">Cliques</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <Users className="w-6 h-6 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-700">{selectedPartner.stats.referrals?.converted || 0}</p>
                      <p className="text-xs text-green-600">Conversões</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <DollarSign className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-700">
                        {formatCurrency(selectedPartner.stats.earnings?.total_cents)}
                      </p>
                      <p className="text-xs text-purple-600">Total Ganho</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                {selectedPartner.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleApprove(selectedPartner.id)}
                      disabled={actionLoading}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Aprovar</span>
                    </button>
                    <button
                      onClick={() => handleReject(selectedPartner.id)}
                      disabled={actionLoading}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span>Rejeitar</span>
                    </button>
                  </>
                )}

                {selectedPartner.status === 'approved' && (
                  <>
                    {!selectedPartner.password_hash && (
                      <button
                        onClick={() => handleResendEmail(selectedPartner.id)}
                        disabled={actionLoading}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Copiar Link de Senha</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleSuspend(selectedPartner.id)}
                      disabled={actionLoading}
                      className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      <Pause className="w-4 h-4" />
                      <span>Suspender</span>
                    </button>
                  </>
                )}

                {selectedPartner.status === 'suspended' && (
                  <button
                    onClick={() => handleReactivate(selectedPartner.id)}
                    disabled={actionLoading}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>Reativar</span>
                  </button>
                )}

                <button
                  onClick={() => handleDelete(selectedPartner.id)}
                  disabled={actionLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnersAdminPage;
