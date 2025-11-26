import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

const CheckoutPage = () => {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { subscription, loading: billingLoading } = useBilling();

  // Minimum values from base plan
  const [channels, setChannels] = useState(1);
  const [users, setUsers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const wasCanceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (!billingLoading && subscription?.status && ['active', 'trialing'].includes(subscription.status)) {
      navigate('/billing');
    }
  }, [subscription, billingLoading, navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/checkout');
    }
  }, [isAuthenticated, navigate]);

  // Calculate price
  const extraChannels = Math.max(0, channels - 1);
  const extraUsers = Math.max(0, users - 2);
  const monthlyTotal = PRICES.basePlan + (extraChannels * PRICES.extraChannel) + (extraUsers * PRICES.extraUser);

  const formatPrice = (cents) => {
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.createCheckoutSession({
        extraChannels,
        extraUsers
      });

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('checkout.backToPricing')}
          </button>
        </div>
      </div>

      {/* Canceled warning */}
      {wasCanceled && (
        <div className="max-w-2xl mx-auto px-4 mt-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-amber-800 text-sm">{t('checkout.canceled')}</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{t('checkout.title')}</h1>
          <p className="text-gray-600">{t('checkout.subtitle')}</p>
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Price Display */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-10 text-center text-white">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-lg font-medium opacity-90">R$</span>
              <span className="text-6xl font-bold tracking-tight">{formatPrice(monthlyTotal)}</span>
              <span className="text-lg font-medium opacity-90">/{t('checkout.perMonth')}</span>
            </div>
            <p className="mt-3 text-blue-100 text-sm">
              {channels} {channels === 1 ? t('checkout.channel') : t('checkout.channels')} + {users} {t('checkout.users')}
            </p>
          </div>

          {/* Sliders */}
          <div className="p-8 space-y-10">
            {/* Channels Slider */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t('checkout.linkedinChannels')}</p>
                    <p className="text-sm text-gray-500">{t('checkout.channelDescription')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">{channels}</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={channels}
                onChange={(e) => setChannels(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider-blue"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((channels - 1) / 9) * 100}%, #e5e7eb ${((channels - 1) / 9) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Users Slider */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t('checkout.teamMembers')}</p>
                    <p className="text-sm text-gray-500">{t('checkout.userDescription')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900">{users}</span>
                </div>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                value={users}
                onChange={(e) => setUsers(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider-purple"
                style={{
                  background: `linear-gradient(to right, #9333ea 0%, #9333ea ${((users - 2) / 18) * 100}%, #e5e7eb ${((users - 2) / 18) * 100}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>2</span>
                <span>20</span>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="border-t pt-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('checkout.basePlanIncluded')}</span>
                <span className="text-gray-900">R$ {formatPrice(PRICES.basePlan)}</span>
              </div>
              {extraChannels > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">+{extraChannels} {extraChannels === 1 ? t('checkout.extraChannel') : t('checkout.extraChannels')}</span>
                  <span className="text-gray-900">R$ {formatPrice(extraChannels * PRICES.extraChannel)}</span>
                </div>
              )}
              {extraUsers > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">+{extraUsers} {extraUsers === 1 ? t('checkout.extraUser') : t('checkout.extraUsers')}</span>
                  <span className="text-gray-900">R$ {formatPrice(extraUsers * PRICES.extraUser)}</span>
                </div>
              )}
            </div>

            {/* Trial Badge */}
            <div className="bg-green-50 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-800">{t('checkout.trial.badge')}</p>
                <p className="text-sm text-green-700">{t('checkout.trial.description')}</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('checkout.processing')}
                </span>
              ) : (
                t('checkout.subscribe')
              )}
            </button>

            {/* Security note */}
            <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{t('checkout.stripeSecure')}</span>
            </div>
          </div>
        </div>

        {/* Features list */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 mb-4">{t('checkout.allPlansInclude')}</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('checkout.feature1')}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('checkout.feature2')}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('checkout.feature3')}
            </span>
          </div>
        </div>
      </div>

      {/* Custom slider styles */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          transition: transform 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #3b82f6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .slider-purple::-webkit-slider-thumb {
          border-color: #9333ea;
        }
        .slider-purple::-moz-range-thumb {
          border-color: #9333ea;
        }
      `}</style>
    </div>
  );
};

export default CheckoutPage;
