// frontend/src/components/SendInviteModal.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Send,
  Building,
  MapPin,
  Briefcase,
  UserPlus,
  FolderPlus,
  ChevronDown,
  Sparkles,
  Database
} from 'lucide-react';
import apiService from '../services/api';

const SendInviteModal = ({
  isOpen,
  onClose,
  profile,
  linkedinAccountId,
  onSuccess
}) => {
  const { t } = useTranslation(['search', 'common']);

  const [message, setMessage] = useState('');
  const [includeInCrm, setIncludeInCrm] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedResponsibleId, setSelectedResponsibleId] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [enrichData, setEnrichData] = useState(true); // Enriquecer dados por padrão

  // Variáveis disponíveis para a mensagem
  const variables = [
    { key: '{{first_name}}', label: t('sendInvite.varFirstName', 'Nome') },
    { key: '{{last_name}}', label: t('sendInvite.varLastName', 'Sobrenome') },
    { key: '{{full_name}}', label: t('sendInvite.varFullName', 'Nome Completo') },
    { key: '{{company}}', label: t('sendInvite.varCompany', 'Empresa') },
    { key: '{{title}}', label: t('sendInvite.varTitle', 'Cargo') },
    { key: '{{location}}', label: t('sendInvite.varLocation', 'Localização') }
  ];

  // Carregar usuários ao abrir
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const usersRes = await apiService.getTeamMembers().catch(() => ({ success: false, data: [] }));

      if (usersRes.success) {
        // Garantir que users é sempre um array
        const usersData = usersRes.data;
        if (Array.isArray(usersData)) {
          setUsers(usersData);
        } else if (usersData?.users && Array.isArray(usersData.users)) {
          setUsers(usersData.users);
        } else if (usersData?.data && Array.isArray(usersData.data)) {
          setUsers(usersData.data);
        } else {
          setUsers([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Inserir variável na mensagem
  const insertVariable = (variable) => {
    setMessage(prev => prev + variable);
  };

  // Preview da mensagem com variáveis substituídas
  const getPreviewMessage = () => {
    if (!message) return '';

    let preview = message;
    const firstName = profile?.name?.split(' ')[0] || 'Nome';
    const lastName = profile?.name?.split(' ').slice(1).join(' ') || 'Sobrenome';

    preview = preview.replace(/\{\{first_name\}\}/g, firstName);
    preview = preview.replace(/\{\{last_name\}\}/g, lastName);
    preview = preview.replace(/\{\{full_name\}\}/g, profile?.name || 'Nome Completo');
    preview = preview.replace(/\{\{company\}\}/g, profile?.company || 'Empresa');
    preview = preview.replace(/\{\{title\}\}/g, profile?.title || 'Cargo');
    preview = preview.replace(/\{\{location\}\}/g, profile?.location || 'Localização');

    return preview;
  };

  // Enviar convite
  const handleSend = async () => {
    if (!linkedinAccountId || !profile?.id) {
      alert(t('sendInvite.errorMissingData', 'Dados incompletos'));
      return;
    }

    setSending(true);

    try {
      const response = await apiService.sendInviteFromSearch({
        linkedin_account_id: linkedinAccountId,
        profile_id: profile.provider_id || profile.id,
        profile_data: {
          name: profile.name,
          title: profile.title,
          company: profile.company,
          location: profile.location,
          profile_url: profile.profile_url,
          profile_picture: profile.profile_picture
        },
        message: message || undefined,
        include_in_crm: includeInCrm,
        enrich_data: includeInCrm && enrichData,
        responsible_id: includeInCrm && selectedResponsibleId ? selectedResponsibleId : undefined
      });

      if (response.success) {
        const successMsg = includeInCrm
          ? t('sendInvite.successWithCrm', 'Convite enviado e contato adicionado ao CRM!')
          : t('sendInvite.success', 'Convite enviado com sucesso!');
        alert(successMsg);

        if (onSuccess) {
          onSuccess(response.data);
        }

        onClose();
      }
    } catch (error) {
      console.error('Erro ao enviar convite:', error);
      alert(t('sendInvite.error', 'Erro ao enviar convite: ') + error.message);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t('sendInvite.title', 'Enviar Convite')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('sendInvite.subtitle', 'Convide para sua rede')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Info */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl">
              {profile?.profile_picture ? (
                <img
                  src={profile.profile_picture}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile?.name?.charAt(0) || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {profile?.name || 'Nome não disponível'}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {profile?.title && (
                  <span className="flex items-center gap-1 truncate">
                    <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                    {profile.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-500">
                {profile?.company && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    {profile.company}
                  </span>
                )}
                {profile?.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="p-5 space-y-4">
          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('sendInvite.messageLabel', 'Mensagem do Convite')}
              <span className="text-gray-400 font-normal ml-1">
                ({t('sendInvite.optional', 'opcional')})
              </span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('sendInvite.messagePlaceholder', 'Olá {{first_name}}, gostaria de me conectar...')}
              rows={4}
              maxLength={300}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {message.length}/300 {t('sendInvite.characters', 'caracteres')}
              </span>
            </div>
          </div>

          {/* Variables */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              {t('sendInvite.variablesLabel', 'Variáveis disponíveis')}:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.key}
                  onClick={() => insertVariable(v.key)}
                  className="px-2.5 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-gray-700 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-300 rounded-full transition-colors border border-gray-200 dark:border-gray-600"
                >
                  {v.key}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {message && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 block mb-1">
                {t('sendInvite.preview', 'Preview da mensagem')}:
              </span>
              <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap">
                {getPreviewMessage()}
              </p>
            </div>
          )}

          {/* Include in CRM */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInCrm}
                onChange={(e) => setIncludeInCrm(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('sendInvite.includeCrm', 'Incluir no CRM')}
                </span>
              </div>
            </label>

            {/* CRM Options */}
            {includeInCrm && (
              <div className="mt-4 ml-8 space-y-3 animate-fadeIn">
                {/* Info about what CRM inclusion does */}
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Database className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      {t('sendInvite.crmInfo', 'Um contato e lead serão criados no CRM com os dados deste perfil.')}
                    </p>
                  </div>
                </div>

                {/* Enrich Data Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enrichData}
                    onChange={(e) => setEnrichData(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('sendInvite.enrichData', 'Enriquecer dados automaticamente')}
                    </span>
                  </div>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  {t('sendInvite.enrichDataDesc', 'Buscar informações adicionais como skills, experiências, certificações, etc.')}
                </p>

                {/* Responsible Select */}
                {Array.isArray(users) && users.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {t('sendInvite.responsible', 'Responsável pelo Lead')}
                    </label>
                    <div className="relative">
                      <select
                        value={selectedResponsibleId}
                        onChange={(e) => setSelectedResponsibleId(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 appearance-none"
                      >
                        <option value="">{t('sendInvite.noResponsible', 'Nenhum (usar padrão)')}</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || user.email}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            {t('common:cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            {sending
              ? t('sendInvite.sending', 'Enviando...')
              : t('sendInvite.send', 'Enviar Convite')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendInviteModal;
