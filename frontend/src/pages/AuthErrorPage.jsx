// frontend/src/pages/AuthErrorPage.jsx
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

const AuthErrorPage = () => {
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const errorMessage = searchParams.get('message') || t('authError.defaultMessage');

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">

        {/* Icon */}
        <div className="mb-6 text-center">
          <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">
          {t('authError.title')}
        </h2>

        {/* Error Message */}
        <p className="text-gray-600 text-center mb-6">
          {decodeURIComponent(errorMessage)}
        </p>

        {/* Common Errors Help */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            {t('authError.possibleCauses')}
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• {t('authError.googleNotAuthorized')}</li>
            <li>• {t('authError.permissionsDenied')}</li>
            <li>• {t('authError.serverError')}</li>
            <li>• {t('authError.emailAlreadyUsed')}</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            {t('authError.tryAgain')}
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('authError.backToHome')}
          </button>
        </div>

        {/* Support Link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('authError.persistingProblems')}{' '}
          <a href="mailto:support@getraze.com" className="text-purple-600 hover:text-purple-700 font-medium">
            {t('authError.contactUs')}
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthErrorPage;
