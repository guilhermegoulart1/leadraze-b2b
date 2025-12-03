import { useState, useEffect } from 'react';
import { X, Key, Shield, Clock, AlertCircle } from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { value: 'contacts:read', label: 'Ler Contatos', description: 'Listar e visualizar contatos' },
  { value: 'contacts:write', label: 'Criar/Editar Contatos', description: 'Criar e atualizar contatos' },
  { value: 'contacts:delete', label: 'Excluir Contatos', description: 'Remover contatos permanentemente' },
  { value: 'opportunities:read', label: 'Ler Oportunidades', description: 'Listar e visualizar leads' },
  { value: 'opportunities:write', label: 'Criar/Editar Oportunidades', description: 'Criar e atualizar leads' },
  { value: 'opportunities:delete', label: 'Excluir Oportunidades', description: 'Remover leads permanentemente' },
];

export default function ApiKeyModal({ mode = 'create', apiKey = null, onClose, onSubmit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    permissions: ['contacts:read', 'contacts:write', 'opportunities:read', 'opportunities:write'],
    rate_limit: 1000,
    expires_at: ''
  });

  useEffect(() => {
    if (mode === 'edit' && apiKey) {
      setFormData({
        name: apiKey.name || '',
        permissions: apiKey.permissions || [],
        rate_limit: apiKey.rate_limit || 1000,
        expires_at: apiKey.expires_at ? new Date(apiKey.expires_at).toISOString().split('T')[0] : ''
      });
    }
  }, [mode, apiKey]);

  const handlePermissionToggle = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Nome e obrigatorio');
      return;
    }

    if (formData.permissions.length === 0) {
      setError('Selecione pelo menos uma permissao');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        name: formData.name.trim(),
        permissions: formData.permissions,
        rate_limit: parseInt(formData.rate_limit),
        expires_at: formData.expires_at || null
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'Criar Nova API Key' : 'Editar API Key'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da API Key *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Integracao Zapier, Webhook HubSpot"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Use um nome descritivo para identificar onde esta key sera usada
            </p>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Shield className="w-4 h-4" />
              Permissoes *
            </label>
            <div className="space-y-2 bg-gray-50 rounded-lg p-3">
              {AVAILABLE_PERMISSIONS.map((perm) => (
                <label
                  key={perm.value}
                  className="flex items-start gap-3 p-2 hover:bg-white rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.permissions.includes(perm.value)}
                    onChange={() => handlePermissionToggle(perm.value)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{perm.label}</div>
                    <div className="text-xs text-gray-500">{perm.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Rate Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limite de requisicoes por hora
            </label>
            <input
              type="number"
              value={formData.rate_limit}
              onChange={(e) => setFormData(prev => ({ ...prev, rate_limit: e.target.value }))}
              min="10"
              max="10000"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Minimo 10, maximo 10.000 requisicoes por hora
            </p>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Data de expiracao (opcional)
            </label>
            <input
              type="date"
              value={formData.expires_at}
              onChange={(e) => setFormData(prev => ({ ...prev, expires_at: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Deixe em branco para a key nunca expirar
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Salvando...' : (mode === 'create' ? 'Criar API Key' : 'Salvar Alteracoes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
