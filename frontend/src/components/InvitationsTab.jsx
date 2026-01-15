// frontend/src/components/InvitationsTab.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail, UserPlus, UserMinus, Check, X, Loader, RefreshCw,
  ExternalLink, Clock, Send, Inbox, AlertCircle
} from 'lucide-react';
import api from '../services/api';

const InvitationsTab = ({ linkedinAccounts }) => {
  const { t } = useTranslation(['campaigns', 'common']);
  const [activeSubTab, setActiveSubTab] = useState('received'); // 'received' | 'sent'
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState(null);

  // Selecionar primeira conta por padrão
  useEffect(() => {
    if (linkedinAccounts?.length > 0 && !selectedAccountId) {
      setSelectedAccountId(linkedinAccounts[0].id);
    }
  }, [linkedinAccounts, selectedAccountId]);

  // Carregar convites quando mudar conta ou aba
  useEffect(() => {
    if (selectedAccountId) {
      loadInvitations();
    }
  }, [selectedAccountId, activeSubTab]);

  const loadInvitations = async () => {
    if (!selectedAccountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = activeSubTab === 'received'
        ? await api.getReceivedInvitations(selectedAccountId)
        : await api.getSentInvitations(selectedAccountId);

      if (response.success) {
        setInvitations(response.data.invitations || []);
      } else {
        setError(response.message || 'Erro ao carregar convites');
      }
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
      setError('Erro ao carregar convites. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (invitationId) => {
    setActionLoading(prev => ({ ...prev, [invitationId]: 'accept' }));
    try {
      // Buscar dados do convite para obter provider, shared_secret e dados do inviter
      const invitation = invitations.find(inv => inv.id === invitationId);
      const response = await api.acceptInvitation(invitationId, selectedAccountId, {
        provider: invitation?.provider,
        shared_secret: invitation?.shared_secret,
        // Dados do remetente para criar contato e enriquecer
        inviter: {
          provider_id: invitation?.provider_id,
          name: invitation?.name,
          headline: invitation?.headline,
          profile_picture: invitation?.profile_picture,
          public_identifier: invitation?.profile_url?.replace('https://linkedin.com/in/', '')
        }
      });
      if (response.success) {
        // Remover da lista
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      } else {
        alert(response.message || 'Erro ao aceitar convite');
      }
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      alert('Erro ao aceitar convite');
    } finally {
      setActionLoading(prev => ({ ...prev, [invitationId]: null }));
    }
  };

  const handleReject = async (invitationId) => {
    setActionLoading(prev => ({ ...prev, [invitationId]: 'reject' }));
    try {
      // Buscar dados do convite para obter provider e shared_secret
      const invitation = invitations.find(inv => inv.id === invitationId);
      const response = await api.rejectInvitation(invitationId, selectedAccountId, {
        provider: invitation?.provider,
        shared_secret: invitation?.shared_secret
      });
      if (response.success) {
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      } else {
        alert(response.message || 'Erro ao rejeitar convite');
      }
    } catch (err) {
      console.error('Erro ao rejeitar convite:', err);
      alert('Erro ao rejeitar convite');
    } finally {
      setActionLoading(prev => ({ ...prev, [invitationId]: null }));
    }
  };

  const handleCancel = async (invitationId) => {
    if (!confirm('Tem certeza que deseja cancelar este convite?')) return;

    setActionLoading(prev => ({ ...prev, [invitationId]: 'cancel' }));
    try {
      const response = await api.cancelInvitation(invitationId, selectedAccountId);
      if (response.success) {
        setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      } else {
        alert(response.message || 'Erro ao cancelar convite');
      }
    } catch (err) {
      console.error('Erro ao cancelar convite:', err);
      alert('Erro ao cancelar convite');
    } finally {
      setActionLoading(prev => ({ ...prev, [invitationId]: null }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header com seletor de conta e sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Seletor de conta LinkedIn */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Conta LinkedIn:
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-purple-500"
          >
            {linkedinAccounts?.map((account) => (
              <option key={account.id} value={account.id}>
                {account.profile_name || account.linkedin_username || `Conta ${account.id}`}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-tabs: Recebidos | Enviados */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('received')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === 'received'
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Recebidos
          </button>
          <button
            onClick={() => setActiveSubTab('sent')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === 'sent'
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Send className="w-4 h-4" />
            Enviados
          </button>
          <button
            onClick={loadInvitations}
            disabled={isLoading}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={loadInvitations}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : invitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            {activeSubTab === 'received' ? (
              <>
                <Inbox className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nenhum convite recebido
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Você não tem convites de conexão pendentes
                </p>
              </>
            ) : (
              <>
                <Send className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Nenhum convite enviado
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Você não tem convites de conexão pendentes enviados
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Perfil
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {activeSubTab === 'received' ? 'Recebido em' : 'Enviado em'}
                  </th>
                  {activeSubTab === 'received' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Mensagem
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {invitations.map((invitation) => {
                  const loading = actionLoading[invitation.id];

                  return (
                    <tr key={invitation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {/* Perfil */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {invitation.profile_picture ? (
                            <img
                              src={invitation.profile_picture}
                              alt={invitation.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                              <span className="text-purple-600 dark:text-purple-400 font-medium">
                                {invitation.name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {invitation.name || 'Usuário LinkedIn'}
                              </span>
                              {invitation.profile_url && (
                                <a
                                  href={invitation.profile_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-purple-600 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cargo */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {invitation.headline || '-'}
                        </span>
                      </td>

                      {/* Data */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(activeSubTab === 'received' ? invitation.received_at : invitation.sent_at)}
                        </div>
                      </td>

                      {/* Mensagem (apenas para recebidos) */}
                      {activeSubTab === 'received' && (
                        <td className="px-6 py-4">
                          {invitation.message ? (
                            <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {invitation.message}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Sem mensagem</span>
                          )}
                        </td>
                      )}

                      {/* Ações */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {activeSubTab === 'received' ? (
                            <>
                              <button
                                onClick={() => handleAccept(invitation.id)}
                                disabled={!!loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-xs font-medium"
                              >
                                {loading === 'accept' ? (
                                  <Loader className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Aceitar
                              </button>
                              <button
                                onClick={() => handleReject(invitation.id)}
                                disabled={!!loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-xs font-medium"
                              >
                                {loading === 'reject' ? (
                                  <Loader className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                                Rejeitar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleCancel(invitation.id)}
                              disabled={!!loading}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-xs font-medium"
                            >
                              {loading === 'cancel' ? (
                                <Loader className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <X className="w-3.5 h-3.5" />
                              )}
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationsTab;
