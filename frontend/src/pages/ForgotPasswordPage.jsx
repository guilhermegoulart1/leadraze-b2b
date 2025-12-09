import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { t } = useTranslation('auth');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.requestPasswordReset(email);

      if (response.success) {
        setSuccess(true);
      } else {
        setError(response.message || t('forgotPassword.error'));
      }
    } catch (err) {
      setError(err.message || t('forgotPassword.error'));
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img
                src="/logo/getraze-purple.svg"
                alt="GetRaze"
                className="h-10 w-auto"
              />
            </div>

            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {t('forgotPassword.successTitle')}
            </h1>
            <p className="text-gray-600 mb-2">
              {t('forgotPassword.successMessage')}
            </p>
            <p className="text-purple-600 font-medium mb-6">{email}</p>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full bg-purple-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">

      {/* Main Card */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex">

        {/* LEFT SIDE - Purple Hero */}
        <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #5f1fd1, #4c1d95)' }}>

          {/* Logo */}
          <div className="relative z-10">
            <img
              src="/logo/getraze-white.svg"
              alt="GetRaze"
              className="h-8 w-auto"
            />
          </div>

          {/* Main Content */}
          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              {t('forgotPassword.heroTitle')}
            </h1>
            <p className="text-purple-100 text-lg">
              {t('forgotPassword.heroSubtitle')}
            </p>
          </div>

          {/* Footer */}
          <div className="relative z-10 text-purple-200 text-sm">
            © 2025 GetRaze • Deals Drop
          </div>
        </div>

        {/* RIGHT SIDE - Form */}
        <div className="flex-1 p-12 flex flex-col justify-center">

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img
              src="/logo/getraze-purple.svg"
              alt="GetRaze"
              className="h-10 w-auto"
            />
          </div>

          {/* Back Link */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-purple-600 transition-colors mb-6 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('forgotPassword.backToLogin')}
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {t('forgotPassword.title')}
            </h2>
            <p className="text-gray-600">
              {t('forgotPassword.subtitle')}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('forgotPassword.emailLabel')}
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all outline-none"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 text-white font-semibold py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  {t('forgotPassword.sending')}
                </>
              ) : (
                t('forgotPassword.submitButton')
              )}
            </button>
          </form>

          {/* Help Link */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {t('forgotPassword.needHelp')}{' '}
            <a href="mailto:suporte@getraze.co" className="text-purple-600 hover:text-purple-700 font-medium">
              {t('forgotPassword.contactSupport')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
