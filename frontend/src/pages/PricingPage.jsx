import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBilling } from '../contexts/BillingContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

// Prices in cents (BRL)
const PRICES = {
  basePlan: 29700, // R$ 297 (includes 1 channel, 2 users)
  extraChannel: 14700, // R$ 147
  extraUser: 2700, // R$ 27
};

// Launch promotion
const LAUNCH_DISCOUNT = 0.70; // 70% OFF first month

const PricingPage = () => {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { subscription, loading: billingLoading } = useBilling();

  const [channels, setChannels] = useState(1);
  const [users, setUsers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Calculate price
  const extraChannels = Math.max(0, channels - 1);
  const extraUsers = Math.max(0, users - 2);
  const monthlyTotal = PRICES.basePlan + (extraChannels * PRICES.extraChannel) + (extraUsers * PRICES.extraUser);
  const firstMonthTotal = Math.round(monthlyTotal * (1 - LAUNCH_DISCOUNT));

  const formatPrice = (cents) => {
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const handleCheckout = async () => {
    // If already authenticated with active subscription, go to billing
    if (isAuthenticated && subscription?.status && ['active', 'trialing'].includes(subscription.status)) {
      navigate('/billing');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use guest checkout for unauthenticated users
      // Use regular checkout for authenticated users without subscription
      const response = isAuthenticated
        ? await api.createCheckoutSession({ extraChannels, extraUsers })
        : await api.createGuestCheckoutSession({ extraChannels, extraUsers });

      if (response.success && response.data.url) {
        window.location.href = response.data.url;
      } else {
        setError(t('checkout.error'));
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.response?.data?.message || t('checkout.error'));
    } finally {
      setLoading(false);
    }
  };

  if (billingLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <div className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-900 text-sm font-medium flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('checkout.backToPricing')}
          </button>
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {t('checkout.stripeSecure')}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">{t('checkout.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('checkout.subtitle')}</p>
        </div>

        {/* Main Card */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Discount Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 text-center">
            <span className="text-white text-lg font-bold">70% OFF {t('checkout.firstMonth')}</span>
            <span className="ml-2 bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full">{t('checkout.limitedOffer')}</span>
          </div>

          {/* Price Header */}
          <div className="bg-gray-50 px-6 py-5 border-b border-gray-200">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-gray-900">R$ {formatPrice(firstMonthTotal)}</span>
              <span className="text-gray-400 text-lg line-through">R$ {formatPrice(monthlyTotal)}</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              {t('checkout.firstMonth')} · {t('checkout.then')} R$ {formatPrice(monthlyTotal)}/{t('checkout.perMonth')}
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Channels */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">{t('checkout.linkedinChannels')}</span>
                <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{channels}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={channels}
                onChange={(e) => setChannels(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #0a2540 0%, #0a2540 ${((channels - 1) / 9) * 100}%, #e5e7eb ${((channels - 1) / 9) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Users */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-900">{t('checkout.teamMembers')}</span>
                <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{users}</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                value={users}
                onChange={(e) => setUsers(parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #0a2540 0%, #0a2540 ${((users - 2) / 18) * 100}%, #e5e7eb ${((users - 2) / 18) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>2</span>
                <span>20</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>{t('checkout.basePlanIncluded')}</span>
                <span>R$ {formatPrice(PRICES.basePlan)}</span>
              </div>
              {extraChannels > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>+{extraChannels} {extraChannels === 1 ? t('checkout.extraChannel') : t('checkout.extraChannels')}</span>
                  <span>R$ {formatPrice(extraChannels * PRICES.extraChannel)}</span>
                </div>
              )}
              {extraUsers > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>+{extraUsers} {extraUsers === 1 ? t('checkout.extraUser') : t('checkout.extraUsers')}</span>
                  <span>R$ {formatPrice(extraUsers * PRICES.extraUser)}</span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-md px-3 py-2 text-sm">
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-md font-semibold text-base hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('checkout.processing')}
                </span>
              ) : (
                t('checkout.subscribe')
              )}
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-gray-500">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t(`checkout.feature${i}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Slider styles */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #0a2540;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #0a2540;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default PricingPage;
