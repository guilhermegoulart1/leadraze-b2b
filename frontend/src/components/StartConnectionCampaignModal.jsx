import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, PlayCircle, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

const StartConnectionCampaignModal = ({
  isOpen,
  onClose,
  onSuccess,
  selectedConnections,
  linkedinAccountId
}) => {
  const { t } = useTranslation(['connections', 'common']);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [dailyLimit, setDailyLimit] = useState(100);

  // Data
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAgents();
      // Generate default name
      const date = new Date().toLocaleDateString('pt-BR');
      setName(`Ativacao Conexoes - ${date}`);
      setSuccess(false);
      setError('');
    }
  }, [isOpen]);

  const loadAgents = async () => {
    try {
      setLoading(true);
      // Usa api.getAgents() que busca da tabela ai_agents (mesma logica do ActivationCampaignWizard)
      const response = await api.getAgents();
      if (response.success) {
        // Filtra agentes de LinkedIn ativos (usa agent_type, nao activation_type)
        const linkedinAgents = (response.data.agents || []).filter(
          a => a.agent_type === 'linkedin' && a.is_active
        );
        setAgents(linkedinAgents);

        if (linkedinAgents.length > 0) {
          setSelectedAgentId(linkedinAgents[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Nome da campanha e obrigatorio');
      return;
    }

    if (!selectedAgentId) {
      setError('Selecione um agente de ativacao');
      return;
    }

    if (selectedConnections.length === 0) {
      setError('Nenhuma conexao selecionada');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await api.createConnectionCampaign({
        name: name.trim(),
        description: description.trim(),
        linkedin_account_id: linkedinAccountId,
        linkedin_agent_id: selectedAgentId,
        daily_limit: dailyLimit,
        connections: selectedConnections.map(c => ({
          provider_id: c.provider_id,
          name: c.name,
          company: c.company,
          title: c.title,
          contact_id: c.contact_id
        }))
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setError(response.message || 'Erro ao criar campanha');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      setError(error.message || 'Erro ao criar campanha');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <PlayCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Iniciar Campanha de Ativacao
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedConnections.length} conexao(es) selecionada(s)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Campanha Iniciada!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              As mensagens serao enviadas de forma distribuida ao longo do dia para evitar restricoes.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Ativacao CEOs Tech Q1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descricao (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objetivo desta campanha..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Agent Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agente de Ativacao *
                </label>
                {loading ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Carregando agentes...</span>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      Nenhum agente de LinkedIn ativo encontrado.{' '}
                      <a href="/agents" className="text-yellow-900 dark:text-yellow-200 underline">
                        Crie um agente primeiro
                      </a>
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Selecione um agente...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Resumo</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Conexoes a ativar:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedConnections.length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tempo estimado:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {Math.ceil(selectedConnections.length / 100)} dia(s)
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || agents.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    Iniciar Campanha
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default StartConnectionCampaignModal;
