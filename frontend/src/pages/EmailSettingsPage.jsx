/**
 * Email Settings Page
 *
 * Dedicated page for email configuration
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { EmailSettingsTab } from '../components/email-settings';

const EmailSettingsPage = () => {
  const { t } = useTranslation('emailSettings');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {t('pageTitle', 'Configurações de Email')}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {t('pageSubtitle', 'Configure assinaturas, templates e branding dos seus emails')}
            </p>
          </div>
        </div>
      </div>

      {/* Email Settings Content */}
      <EmailSettingsTab />
    </div>
  );
};

export default EmailSettingsPage;
