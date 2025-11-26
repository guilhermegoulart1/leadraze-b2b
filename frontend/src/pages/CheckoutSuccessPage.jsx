import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const CheckoutSuccessPage = () => {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [countdown, setCountdown] = useState(5);

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // If authenticated, go to dashboard. Otherwise, they'll get email to set password
          if (isAuthenticated) {
            navigate('/');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('checkoutSuccess.title', 'Pagamento confirmado!')}
        </h1>

        <p className="text-gray-600 mb-6">
          {t('checkoutSuccess.description', 'Sua assinatura foi ativada com sucesso.')}
        </p>

        {!isAuthenticated && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-blue-900 text-sm">
                  {t('checkoutSuccess.emailSent', 'Verifique seu email')}
                </p>
                <p className="text-blue-700 text-sm">
                  {t('checkoutSuccess.emailDescription', 'Enviamos um link para você criar sua senha e acessar a plataforma.')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {isAuthenticated ? (
            <>
              <p className="text-sm text-gray-500">
                {t('checkoutSuccess.redirecting', 'Redirecionando em {{seconds}}s...', { seconds: countdown })}
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                {t('checkoutSuccess.goToDashboard', 'Ir para o Dashboard')}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              {t('checkoutSuccess.goToLogin', 'Ir para Login')}
            </button>
          )}
        </div>

        {/* Features reminder */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-3">{t('checkoutSuccess.included', 'Incluso na sua assinatura:')}</p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
            <span className="bg-gray-50 px-2 py-1 rounded">{t('checkout.feature1')}</span>
            <span className="bg-gray-50 px-2 py-1 rounded">{t('checkout.feature2')}</span>
            <span className="bg-gray-50 px-2 py-1 rounded">{t('checkout.feature3')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
