import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, UserPlus, Loader2, CheckCircle, AlertCircle, Info } from 'lucide-react';
import api from '../services/api';

const AddToCampaignModal = ({
  isOpen,
  onClose,
  onSuccess,
  selectedProfiles = [],
  campaigns = []
}) => {
  const { t } = useTranslation(['search', 'common']);

  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const resetState = () => {
    setSelectedCampaignId('');
    setShowCreateCampaign(false);
    setNewCampaignName('');
    setCreatingCampaign(false);
    setSubmitting(false);
    setError('');
    setResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;

    try {
      setCreatingCampaign(true);
      const response = await api.createCampaign({
        name: newCampaignName.trim(),
        status: 'draft'
      });

      if (response.success) {
        const newCampaign = response.data.campaign || response.data;
        setSelectedCampaignId(newCampaign.id);
        setShowCreateCampaign(false);
        setNewCampaignName('');
      } else {
        setError(response.message || t('addToCampaignModal.errorCreating', 'Erro ao criar campanha'));
      }
    } catch (err) {
      setError(err.message || t('addToCampaignModal.errorCreating', 'Erro ao criar campanha'));
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCampaignId) {
      setError(t('addToCampaignModal.selectCampaignError', 'Selecione uma campanha'));
      return;
    }

    if (selectedProfiles.length === 0) {
      setError(t('addToCampaignModal.noProfilesError', 'Nenhum perfil selecionado'));
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const profiles = selectedProfiles.map(p => ({
        name: p.name || p.full_name || '',
        provider_id: p.provider_id || p.id,
        profile_url: p.profile_url || p.linkedin_url || null,
        title: p.title || p.headline || null,
        headline: p.headline || null,
        company: p.company || p.current_company || null,
        location: p.location || null,
        profile_picture: p.profile_picture || p.profile_picture_url || null
      }));

      const response = await api.bulkAddProfilesToCampaign(selectedCampaignId, profiles);

      if (response.success) {
        setResult(response.data);
        setTimeout(() => {
          onSuccess(response.data);
          resetState();
        }, 2500);
      } else {
        setError(response.message || t('addToCampaignModal.errorAdding', 'Erro ao adicionar perfis'));
      }
    } catch (err) {
      setError(err.message || t('addToCampaignModal.errorAdding', 'Erro ao adicionar perfis'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <UserPlus className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('addToCampaignModal.title', 'Adicionar a Campanha')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('addToCampaignModal.subtitle', 'Adicione os perfis selecionados diretamente a uma campanha')}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Success State */}
        {result ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('addToCampaignModal.successTitle', 'Perfis Adicionados!')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('addToCampaignModal.successMessage', '{{added}} perfil(is) adicionado(s) com sucesso.', { added: result.added })}
              {result.duplicates > 0 && (
                <span className="block mt-1 text-sm text-yellow-600 dark:text-yellow-400">
                  {t('addToCampaignModal.duplicatesMessage', '{{duplicates}} ja existia(m) na campanha.', { duplicates: result.duplicates })}
                </span>
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Campaign Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('addToCampaignModal.selectCampaign', 'Selecione a campanha')}
                </label>

                {!showCreateCampaign ? (
                  <>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => {
                        setSelectedCampaignId(e.target.value);
                        setError('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{t('addToCampaignModal.selectCampaignPlaceholder', 'Selecione uma campanha...')}</option>
                      {campaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.status})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowCreateCampaign(true)}
                      className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
                    >
                      {t('addToCampaignModal.createNew', '+ Criar nova campanha')}
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      placeholder={t('addToCampaignModal.campaignNamePlaceholder', 'Nome da nova campanha...')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateCampaign}
                        disabled={creatingCampaign || !newCampaignName.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                      >
                        {creatingCampaign ? t('addToCampaignModal.creating', 'Criando...') : t('addToCampaignModal.create', 'Criar')}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateCampaign(false);
                          setNewCampaignName('');
                        }}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                      >
                        {t('addToCampaignModal.cancel', 'Cancelar')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('addToCampaignModal.summary', 'Resumo')}
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t('addToCampaignModal.profilesToAdd', 'Perfis a adicionar:')}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {selectedProfiles.length}
                    </span>
                  </div>
                  {selectedCampaign && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('addToCampaignModal.selectedCampaign', 'Campanha selecionada:')}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {selectedCampaign.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <Info className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-800 dark:text-green-300">
                  {t('addToCampaignModal.info', 'Os perfis serao adicionados com status "aprovado" e o agente de IA da campanha iniciara o contato automaticamente.')}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {t('addToCampaignModal.cancel', 'Cancelar')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedCampaignId}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('addToCampaignModal.adding', 'Adicionando...')}
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    {t('addToCampaignModal.addButton', 'Adicionar a Campanha')}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddToCampaignModal;
