import React, { useState } from 'react';
import { Shield, FileText, Lock, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const CURRENT_TERMS_VERSION = '2026-02-11';

const TermsSection = ({ section, t, prefix }) => {
  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {t(`${prefix}.title`)}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
        {t(`${prefix}.content`)}
      </p>

      {/* subtitle1 + items1 (for section2 of privacy) */}
      {t(`${prefix}.subtitle1`, { defaultValue: '' }) && (
        <>
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-3 mb-1">
            {t(`${prefix}.subtitle1`)}
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-2">
            {t(`${prefix}.items1`, { returnObjects: true, defaultValue: [] }).map?.((item, i) => (
              <li key={i} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </>
      )}

      {/* subtitle2 + items2 (for section2 of privacy) */}
      {t(`${prefix}.subtitle2`, { defaultValue: '' }) && (
        <>
          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-3 mb-1">
            {t(`${prefix}.subtitle2`)}
          </h4>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-2">
            {t(`${prefix}.items2`, { returnObjects: true, defaultValue: [] }).map?.((item, i) => (
              <li key={i} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </>
      )}

      {/* Regular items */}
      {t(`${prefix}.items`, { returnObjects: true, defaultValue: null }) &&
        Array.isArray(t(`${prefix}.items`, { returnObjects: true })) && (
        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-2">
          {t(`${prefix}.items`, { returnObjects: true }).map((item, i) => (
            <li key={i} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      )}

      {/* Note */}
      {t(`${prefix}.note`, { defaultValue: '' }) && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-2">
          {t(`${prefix}.note`)}
        </p>
      )}
    </div>
  );
};

const TermsAcceptanceModal = () => {
  const { t } = useTranslation('terms');
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState('terms');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Don't show modal if user already accepted current version
  const needsAcceptance = user && !user.isImpersonating && user.terms_version !== CURRENT_TERMS_VERSION;

  if (!needsAcceptance) return null;

  const handleAccept = async () => {
    if (!agreed) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.acceptTerms(CURRENT_TERMS_VERSION);
      if (response.success) {
        // Update user in AuthContext with the new terms data
        const updatedUser = { ...user, terms_accepted_at: new Date().toISOString(), terms_version: CURRENT_TERMS_VERSION };
        setUser(updatedUser);
      }
    } catch (err) {
      setError(t('modal.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const sections = Array.from({ length: 13 }, (_, i) => `section${i + 1}`);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {t('modal.title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('modal.subtitle')}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('terms')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'terms'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t('modal.tabTerms')}
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'privacy'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Lock className="w-4 h-4" />
              {t('modal.tabPrivacy')}
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            {t('modal.lastUpdated')}
          </p>

          {activeTab === 'terms' && (
            <div>
              {sections.map((key) => (
                <TermsSection
                  key={key}
                  section={key}
                  t={t}
                  prefix={`termsOfUse.${key}`}
                />
              ))}
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              {sections.map((key) => (
                <TermsSection
                  key={key}
                  section={key}
                  t={t}
                  prefix={`privacyPolicy.${key}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer mb-4 group">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500 dark:bg-gray-700 cursor-pointer"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
              {t('modal.checkboxLabel')}
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!agreed || loading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white disabled:text-gray-500 dark:disabled:text-gray-400 py-3 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('modal.accepting')}
              </>
            ) : (
              <>
                {t('modal.acceptButton')}
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsAcceptanceModal;
