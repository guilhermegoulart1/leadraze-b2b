import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Edit,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import api from '../services/api';
import ApiKeyModal from '../components/ApiKeyModal';

export default function ApiKeysPage() {
  const { t } = useTranslation();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      const response = await api.getApiKeys();
      if (response.success) {
        setApiKeys(response.data.api_keys || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async (data) => {
    try {
      const response = await api.createApiKey(data);
      if (response.success) {
        setNewlyCreatedKey(response.data.api_key);
        setShowCreateModal(false);
        setShowNewKeyModal(true);
        loadApiKeys();
      }
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateKey = async (id, data) => {
    try {
      const response = await api.updateApiKey(id, data);
      if (response.success) {
        setShowEditModal(false);
        setSelectedKey(null);
        loadApiKeys();
      }
    } catch (err) {
      throw err;
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm('Tem certeza que deseja revogar esta API Key? Ela deixara de funcionar imediatamente.')) {
      return;
    }

    try {
      await api.revokeApiKey(id);
      loadApiKeys();
    } catch (err) {
      alert('Erro ao revogar API Key: ' + err.message);
    }
  };

  const handleRegenerateKey = async (id) => {
    if (!confirm('Tem certeza que deseja regenerar esta API Key? A chave atual sera revogada e uma nova sera criada.')) {
      return;
    }

    try {
      const response = await api.regenerateApiKey(id);
      if (response.success) {
        setNewlyCreatedKey(response.data.api_key);
        setShowNewKeyModal(true);
        loadApiKeys();
      }
    } catch (err) {
      alert('Erro ao regenerar API Key: ' + err.message);
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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

  const getStatusBadge = (key) => {
    if (!key.is_active) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          Revogada
        </span>
      );
    }

    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Expirada
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Ativa
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Key className="w-7 h-7" />
            API Keys
          </h1>
          <p className="text-gray-500 mt-1">
            Gerencie as chaves de API para integracao externa com o CRM
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova API Key
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">Como usar a API</h3>
        <p className="text-sm text-blue-700 mb-2">
          Use suas API Keys para integrar sistemas externos com o LeadRaze. Todas as requisicoes devem incluir o header:
        </p>
        <code className="block bg-blue-100 px-3 py-2 rounded text-sm text-blue-900 font-mono">
          X-API-Key: lr_live_xxxxxxxxxxxxx
        </code>
        <p className="text-sm text-blue-700 mt-2">
          Endpoints disponiveis: <code className="bg-blue-100 px-1 rounded">/external/v1/contacts</code> e{' '}
          <code className="bg-blue-100 px-1 rounded">/external/v1/opportunities</code>
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {/* API Keys list */}
      {apiKeys.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Key className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhuma API Key criada
          </h3>
          <p className="text-gray-500 mb-4">
            Crie sua primeira API Key para integrar sistemas externos com o LeadRaze
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Criar API Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome / Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Permissoes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criada em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {apiKeys.map((key) => (
                <tr key={key.id} className={!key.is_active ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{key.name}</div>
                      <div className="text-sm text-gray-500 font-mono flex items-center gap-2">
                        {key.key_preview}
                        <button
                          onClick={() => copyToClipboard(key.key_preview, key.id)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copiar prefixo"
                        >
                          {copiedId === key.id ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(key)}
                    {key.expires_at && (
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expira: {formatDate(key.expires_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(key.permissions || []).slice(0, 3).map((perm, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {perm}
                        </span>
                      ))}
                      {(key.permissions || []).length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{key.permissions.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{key.request_count || 0} requisicoes</div>
                    <div className="text-xs text-gray-500">
                      Limite: {key.rate_limit}/hora
                    </div>
                    {key.last_used_at && (
                      <div className="text-xs text-gray-400 mt-1">
                        Ultimo uso: {formatDate(key.last_used_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(key.created_at)}
                    <div className="text-xs text-gray-400">
                      por {key.created_by?.name || 'Sistema'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {key.is_active && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedKey(key);
                              setShowEditModal(true);
                            }}
                            className="text-gray-400 hover:text-blue-600"
                            title="Editar"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleRegenerateKey(key.id)}
                            className="text-gray-400 hover:text-orange-600"
                            title="Regenerar"
                          >
                            <RefreshCw className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-gray-400 hover:text-red-600"
                            title="Revogar"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ApiKeyModal
          mode="create"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateKey}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedKey && (
        <ApiKeyModal
          mode="edit"
          apiKey={selectedKey}
          onClose={() => {
            setShowEditModal(false);
            setSelectedKey(null);
          }}
          onSubmit={(data) => handleUpdateKey(selectedKey.id, data)}
        />
      )}

      {/* New Key Created Modal */}
      {showNewKeyModal && newlyCreatedKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">API Key Criada!</h2>
              <p className="text-gray-500 mt-2">
                Copie sua API Key agora. <span className="font-semibold text-red-600">Ela nao sera exibida novamente.</span>
              </p>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sua nova API Key:
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border rounded px-3 py-2 font-mono text-sm break-all">
                  {newlyCreatedKey.key}
                </code>
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey.key, 'new-key')}
                  className="flex-shrink-0 p-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {copiedId === 'new-key' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700">
                  Guarde esta chave em um local seguro. Por motivos de seguranca, nao armazenamos a chave completa e ela nao podera ser recuperada.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setShowNewKeyModal(false);
                setNewlyCreatedKey(null);
              }}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
