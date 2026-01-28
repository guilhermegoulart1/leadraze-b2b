import React, { useState, useEffect } from 'react';
import {
  Key, Plus, Copy, RefreshCw, Trash2, Clock, Eye, EyeOff,
  Shield, CheckCircle, XCircle, AlertTriangle, Users, Activity,
  Calendar, ChevronDown, ChevronUp, ExternalLink, RotateCcw
} from 'lucide-react';
import api from '../../services/api';

// Escopos disponíveis
const SCOPES = [
  { id: 'read', name: 'Leitura', description: 'Visualizar dados (agentes, campanhas, conversas)' },
  { id: 'configure_agents', name: 'Configurar Agentes', description: 'Criar e editar agentes de IA' },
  { id: 'configure_campaigns', name: 'Configurar Campanhas', description: 'Criar e editar campanhas' },
  { id: 'configure_workflows', name: 'Configurar Workflows', description: 'Criar e editar workflows' },
  { id: 'view_conversations', name: 'Ver Conversas', description: 'Visualizar histórico de conversas' },
  { id: 'manage_contacts', name: 'Gerenciar Contatos', description: 'Criar, editar e gerenciar contatos' },
  { id: 'manage_leads', name: 'Gerenciar Leads', description: 'Criar, editar e gerenciar leads' },
  { id: 'full_admin', name: 'Administrador Completo', description: 'Todas as permissoes (exceto billing e usuarios)' },
];

// Duracoes predefinidas
const DURATIONS = [
  { value: 1, label: '1 hora' },
  { value: 4, label: '4 horas' },
  { value: 24, label: '1 dia' },
  { value: 72, label: '3 dias' },
  { value: 168, label: '7 dias' },
  { value: 336, label: '14 dias' },
];

const SupportAccessTab = () => {
  const [tokens, setTokens] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [selectedTokenForAudit, setSelectedTokenForAudit] = useState(null);
  const [expandedTokenId, setExpandedTokenId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    scope: ['read', 'configure_agents'],
    durationHours: 168,
    operatorEmail: '',
    operatorName: '',
    purpose: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tokensRes, sessionsRes, statsRes] = await Promise.all([
        api.get('/support-access/tokens?includeExpired=true'),
        api.get('/support-access/sessions'),
        api.get('/support-access/stats')
      ]);

      if (tokensRes.success) setTokens(tokensRes.data || []);
      if (sessionsRes.success) setSessions(sessionsRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching support access data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e) => {
    e.preventDefault();
    if (formData.scope.length === 0) {
      alert('Selecione pelo menos um escopo de permissao');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/support-access/tokens', formData);
      if (response.success) {
        setNewToken(response.data);
        setShowCreateModal(false);
        setShowTokenModal(true);
        fetchData();
        // Reset form
        setFormData({
          scope: ['read', 'configure_agents'],
          durationHours: 168,
          operatorEmail: '',
          operatorName: '',
          purpose: ''
        });
      }
    } catch (error) {
      console.error('Error creating token:', error);
      alert(error.message || 'Erro ao criar token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeToken = async (tokenId) => {
    if (!confirm('Tem certeza que deseja revogar este token? Todas as sessoes ativas serao encerradas.')) {
      return;
    }

    try {
      const response = await api.delete(`/support-access/tokens/${tokenId}`, {
        data: { reason: 'Revogado pelo administrador' }
      });
      if (response.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      alert('Erro ao revogar token');
    }
  };

  const handleExtendToken = async (tokenId) => {
    try {
      const response = await api.post(`/support-access/tokens/${tokenId}/extend`, {
        additionalHours: 168 // 7 dias
      });
      if (response.success) {
        fetchData();
        alert('Token estendido por mais 7 dias');
      }
    } catch (error) {
      console.error('Error extending token:', error);
      alert(error.message || 'Erro ao estender token');
    }
  };

  const handleEndSession = async (sessionId) => {
    if (!confirm('Tem certeza que deseja encerrar esta sessao?')) {
      return;
    }

    try {
      const response = await api.delete(`/support-access/sessions/${sessionId}`);
      if (response.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('Erro ao encerrar sessao');
    }
  };

  const handleViewAudit = async (tokenId) => {
    setSelectedTokenForAudit(tokenId);
    try {
      const response = await api.get(`/support-access/audit?tokenId=${tokenId}&limit=50`);
      if (response.success) {
        setAuditLogs(response.data || []);
        setShowAuditModal(true);
      }
    } catch (error) {
      console.error('Error fetching audit log:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Token copiado para a area de transferencia!');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;

    if (diff < 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h restantes`;
    if (hours > 0) return `${hours}h restantes`;
    return 'Menos de 1h';
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
      revoked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      inactive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    };
    const labels = {
      active: 'Ativo',
      expired: 'Expirado',
      revoked: 'Revogado',
      inactive: 'Inativo'
    };
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
        {labels[status] || status}
      </span>
    );
  };

  const toggleScope = (scopeId) => {
    setFormData(prev => ({
      ...prev,
      scope: prev.scope.includes(scopeId)
        ? prev.scope.filter(s => s !== scopeId)
        : [...prev.scope, scopeId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Acesso de Suporte
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gere tokens para permitir que a equipe de suporte configure sua conta de forma segura
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Gerar Token
        </button>
      </div>


      {/* Active Sessions */}
      {sessions.filter(s => s.isActive).length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Sessoes Ativas
          </h4>
          <div className="space-y-2">
            {sessions.filter(s => s.isActive).map(session => (
              <div key={session.id} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{session.operatorName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {session.operatorEmail || 'Email nao informado'} - Iniciada em {formatDate(session.startedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {session.actionsCount} acoes
                  </span>
                  <button
                    onClick={() => handleEndSession(session.id)}
                    className="px-3 py-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm font-medium"
                  >
                    Encerrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tokens List */}
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Tokens de Acesso</h4>
        {tokens.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Key className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p>Nenhum token gerado ainda</p>
            <p className="text-sm mt-1">Gere um token para permitir acesso de suporte</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map(token => (
              <div key={token.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => setExpandedTokenId(expandedTokenId === token.id ? null : token.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      token.status === 'active' ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <Key className={`w-5 h-5 ${
                        token.status === 'active' ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-gray-900 dark:text-white">{token.tokenPrefix}...</code>
                        {getStatusBadge(token.status)}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {token.purpose || 'Sem descricao'} - {token.operatorName || 'Operador nao especificado'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {token.status === 'active' && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(token.expiresAt)}
                      </span>
                    )}
                    {expandedTokenId === token.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {expandedTokenId === token.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Criado em</p>
                        <p className="text-sm text-gray-900 dark:text-white">{formatDate(token.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expira em</p>
                        <p className="text-sm text-gray-900 dark:text-white">{formatDate(token.expiresAt)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Usos</p>
                        <p className="text-sm text-gray-900 dark:text-white">{token.useCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Extensoes</p>
                        <p className="text-sm text-gray-900 dark:text-white">{token.extensionCount}/{token.maxExtensions}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Permissoes</p>
                      <div className="flex flex-wrap gap-2">
                        {(token.scope || []).map(s => (
                          <span key={s} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                            {SCOPES.find(sc => sc.id === s)?.name || s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {token.revokedAt && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-400">
                          Revogado em {formatDate(token.revokedAt)}: {token.revokeReason || 'Motivo nao informado'}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewAudit(token.id); }}
                        className="flex items-center gap-1 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Historico
                      </button>
                      {token.status === 'active' && (
                        <>
                          {token.extensionCount < token.maxExtensions && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleExtendToken(token.id); }}
                              className="flex items-center gap-1 px-3 py-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg text-sm"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Estender (+7 dias)
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRevokeToken(token.id); }}
                            className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                            Revogar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Como funciona?</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>1. Gere um token com as permissoes necessarias para o suporte</li>
          <li>2. Envie o token para o operador de suporte de forma segura</li>
          <li>3. O operador acessa sua conta temporariamente</li>
          <li>4. Todas as acoes sao registradas no historico para auditoria</li>
          <li>5. Voce pode revogar o acesso a qualquer momento</li>
        </ul>
      </div>

      {/* Create Token Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Gerar Token de Acesso</h3>

              <form onSubmit={handleCreateToken} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Permissoes *
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                    {SCOPES.map(scope => (
                      <label key={scope.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.scope.includes(scope.id)}
                          onChange={() => toggleScope(scope.id)}
                          className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">{scope.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{scope.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duracao *
                  </label>
                  <select
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {DURATIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome do Operador (opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.operatorName}
                    onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                    placeholder="Ex: Equipe GetRaze"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email do Operador (opcional - restringe uso)
                  </label>
                  <input
                    type="email"
                    value={formData.operatorEmail}
                    onChange={(e) => setFormData({ ...formData, operatorEmail: e.target.value })}
                    placeholder="suporte@getraze.co"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proposito/Descricao
                  </label>
                  <input
                    type="text"
                    value={formData.purpose}
                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    placeholder="Ex: Configuracao inicial de agentes"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating || formData.scope.length === 0}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 flex items-center gap-2"
                  >
                    {creating && <RefreshCw className="w-4 h-4 animate-spin" />}
                    Gerar Token
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Token Created Modal */}
      {showTokenModal && newToken && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Token Gerado!</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Copie e envie para o operador</p>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    <strong>ATENCAO:</strong> O token completo so sera exibido uma vez. Copie-o agora e envie ao operador de forma segura.
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token de Acesso
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newToken.token}
                    readOnly
                    className="w-full px-3 py-2 pr-10 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => copyToClipboard(newToken.token)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Expira em</p>
                  <p className="text-gray-900 dark:text-white">{formatDate(newToken.expiresAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Extensoes disponiveis</p>
                  <p className="text-gray-900 dark:text-white">{newToken.extensionsRemaining}</p>
                </div>
              </div>

              <button
                onClick={() => { setShowTokenModal(false); setNewToken(null); }}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                Entendi, ja copiei o token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Historico de Acoes</h3>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {auditLogs.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhuma acao registrada</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {log.operatorName}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded text-xs mr-2">
                          {log.httpMethod}
                        </span>
                        {log.actionType} - {log.resourceType || 'N/A'}
                        {log.resourceName && ` (${log.resourceName})`}
                      </p>
                      {log.endpoint && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                          {log.endpoint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportAccessTab;
