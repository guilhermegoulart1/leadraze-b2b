/**
 * Email Settings Tab Component
 *
 * Main container for email settings including:
 * - Branding (logo, colors)
 * - Signatures
 * - Email format preferences
 * - Custom templates
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Palette,
  FileSignature,
  FileText,
  Settings,
  Loader2,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import SignatureEditor from './SignatureEditor';
import LogoUploader from './LogoUploader';
import TemplateList from './TemplateList';

const EmailSettingsTab = () => {
  const { t } = useTranslation('emailSettings');
  const [activeSection, setActiveSection] = useState('branding');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for settings
  const [branding, setBranding] = useState(null);
  const [signatures, setSignatures] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [templates, setTemplates] = useState([]);

  const sections = [
    { id: 'branding', label: t('sections.branding', 'Branding'), icon: Palette },
    { id: 'signatures', label: t('sections.signatures', 'Assinaturas'), icon: FileSignature },
    { id: 'templates', label: t('sections.templates', 'Templates'), icon: FileText },
    { id: 'preferences', label: t('sections.preferences', 'Preferências'), icon: Settings },
  ];

  // Load all settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const [brandingRes, signaturesRes, preferencesRes, templatesRes] = await Promise.all([
        api.getEmailBranding(),
        api.getEmailSignatures(),
        api.getEmailPreferences(),
        api.getEmailTemplates(),
      ]);

      setBranding(brandingRes.branding || {});
      setSignatures(signaturesRes.signatures || []);
      setPreferences(preferencesRes.preferences || {});
      setTemplates(templatesRes.templates || []);
    } catch (err) {
      console.error('Error loading email settings:', err);
      setError(t('errors.loadFailed', 'Erro ao carregar configurações'));
    } finally {
      setLoading(false);
    }
  };

  const handleBrandingUpdate = async (updates) => {
    try {
      const result = await api.updateEmailBranding(updates);
      setBranding(result.branding);
      return true;
    } catch (err) {
      console.error('Error updating branding:', err);
      throw err;
    }
  };

  const handleLogoUpload = async (file) => {
    try {
      const result = await api.uploadCompanyLogo(file);
      setBranding(prev => ({ ...prev, company_logo_url: result.logo_url }));
      return result.logo_url;
    } catch (err) {
      console.error('Error uploading logo:', err);
      throw err;
    }
  };

  const handleLogoDelete = async () => {
    try {
      await api.deleteCompanyLogo();
      setBranding(prev => ({ ...prev, company_logo_url: null }));
    } catch (err) {
      console.error('Error deleting logo:', err);
      throw err;
    }
  };

  const handlePreferencesUpdate = async (updates) => {
    try {
      const result = await api.updateEmailPreferences(updates);
      setPreferences(result.preferences);
      return true;
    } catch (err) {
      console.error('Error updating preferences:', err);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">{t('loading', 'Carregando...')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center justify-center text-red-500">
          <AlertCircle className="w-6 h-6 mr-2" />
          <span>{error}</span>
          <button
            onClick={loadSettings}
            className="ml-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {t('retry', 'Tentar novamente')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <div className="flex space-x-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors
                  ${activeSection === section.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{section.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Branding Section */}
      {activeSection === 'branding' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">
            {t('branding.title', 'Branding de Email')}
          </h3>

          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('branding.companyLogo', 'Logo da Empresa')}
              </label>
              <LogoUploader
                currentLogo={branding?.company_logo_url}
                onUpload={handleLogoUpload}
                onDelete={handleLogoDelete}
              />
              <p className="text-xs text-gray-500 mt-2">
                {t('branding.logoHint', 'Recomendado: PNG ou SVG, max 5MB')}
              </p>
            </div>

            {/* Format Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('branding.formatPreference', 'Formato de Email Padrão')}
              </label>
              <select
                value={branding?.format_preference || 'html'}
                onChange={(e) => handleBrandingUpdate({ format_preference: e.target.value })}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="html">HTML</option>
                <option value="plain">Texto Simples</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                {t('branding.formatHint', 'HTML permite formatação rica, texto simples é mais compatível')}
              </p>
            </div>

            {/* Include Logo in Emails */}
            <div className="flex items-center justify-between py-4 border-t border-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">
                  {t('branding.includeLogoInEmails', 'Incluir Logo em Emails')}
                </h4>
                <p className="text-sm text-gray-500">
                  {t('branding.includeLogoHint', 'Adiciona o logo da empresa no cabeçalho dos emails')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={branding?.include_logo_in_emails !== false}
                  onChange={(e) => handleBrandingUpdate({
                    branding: { ...branding?.branding, include_logo: e.target.checked }
                  })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Signatures Section */}
      {activeSection === 'signatures' && (
        <SignatureEditor
          signatures={signatures}
          onSignaturesChange={setSignatures}
          preferences={preferences}
          onPreferencesChange={setPreferences}
        />
      )}

      {/* Templates Section */}
      {activeSection === 'templates' && (
        <TemplateList
          templates={templates}
          onTemplatesChange={setTemplates}
        />
      )}

      {/* Preferences Section */}
      {activeSection === 'preferences' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">
            {t('preferences.title', 'Preferências de Email')}
          </h3>

          <div className="space-y-6">
            {/* Default Signature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('preferences.defaultSignature', 'Assinatura Padrão')}
              </label>
              <select
                value={preferences?.signature_id || ''}
                onChange={(e) => handlePreferencesUpdate({ signature_id: e.target.value || null })}
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('preferences.noSignature', 'Nenhuma assinatura')}</option>
                {signatures.map((sig) => (
                  <option key={sig.id} value={sig.id}>{sig.name}</option>
                ))}
              </select>
            </div>

            {/* User Format Preference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('preferences.emailFormat', 'Formato de Email Preferido')}
              </label>
              <select
                value={preferences?.email_format_preference || 'account_default'}
                onChange={(e) => handlePreferencesUpdate({ email_format_preference: e.target.value })}
                className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="account_default">{t('preferences.useAccountDefault', 'Usar padrão da conta')}</option>
                <option value="html">HTML</option>
                <option value="plain">{t('preferences.plainText', 'Texto Simples')}</option>
              </select>
            </div>

            {/* Use Account Signature */}
            <div className="flex items-center justify-between py-4 border-t border-gray-200">
              <div>
                <h4 className="font-medium text-gray-900">
                  {t('preferences.useAccountSignature', 'Usar Assinatura da Conta')}
                </h4>
                <p className="text-sm text-gray-500">
                  {t('preferences.useAccountSignatureHint', 'Se desativado, usa sua assinatura pessoal')}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={preferences?.use_account_signature !== false}
                  onChange={(e) => handlePreferencesUpdate({ use_account_signature: e.target.checked })}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSettingsTab;
