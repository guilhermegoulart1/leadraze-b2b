import { useState } from 'react';

// Prices in cents (USD) - Must match backend/src/config/stripe.js
const PRICES = {
  basePlan: 5500, // $55 (includes 1 channel, 2 users, 200 credits)
  extraChannel: 2700, // $27/month per extra channel
  extraUser: 300, // $3/month per extra user
};

// Launch promotion
const LAUNCH_DISCOUNT = 0.70; // 70% OFF first month

// API URL from environment
const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001/api';

interface PricingCalculatorProps {
  locale?: string;
}

export default function PricingCalculator({ locale = 'en' }: PricingCalculatorProps) {
  const [channels, setChannels] = useState(1);
  const [users, setUsers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate price
  const extraChannels = Math.max(0, channels - 1);
  const extraUsers = Math.max(0, users - 2);
  const monthlyTotal = PRICES.basePlan + (extraChannels * PRICES.extraChannel) + (extraUsers * PRICES.extraUser);
  const firstMonthTotal = Math.round(monthlyTotal * (1 - LAUNCH_DISCOUNT));

  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Translations
  const t = {
    en: {
      linkedinChannels: 'Channels',
      teamMembers: 'Team Members',
      basePlan: 'Base Plan (1 channel, 2 users, 200 credits)',
      extraChannel: 'Extra Channel',
      extraChannels: 'Extra Channels',
      extraUser: 'Extra User',
      extraUsers: 'Extra Users',
      firstMonth: 'First Month',
      then: 'Then',
      perMonth: 'month',
      limitedOffer: 'Limited Time Offer',
      cta: 'Subscribe Now',
      processing: 'Processing...',
      error: 'Something went wrong. Please try again.',
      features: [
        'Unlimited AI Agents',
        'LinkedIn Automation',
        'Email Campaigns',
        '200 Google Maps Credits/mo',
        'Priority Support',
      ],
      secureCheckout: 'Secure checkout with Stripe',
      cancelAnytime: 'Cancel anytime',
    },
    'pt-br': {
      linkedinChannels: 'Canais',
      teamMembers: 'Membros do Time',
      basePlan: 'Plano Base (1 canal, 2 usuários, 200 créditos)',
      extraChannel: 'Canal Extra',
      extraChannels: 'Canais Extras',
      extraUser: 'Usuário Extra',
      extraUsers: 'Usuários Extras',
      firstMonth: 'Primeiro Mês',
      then: 'Depois',
      perMonth: 'mês',
      limitedOffer: 'Oferta Limitada',
      cta: 'Assinar Agora',
      processing: 'Processando...',
      error: 'Algo deu errado. Tente novamente.',
      features: [
        'Agentes IA Ilimitados',
        'Automação LinkedIn',
        'Campanhas de Email',
        '200 Créditos Google Maps/mês',
        'Suporte Prioritário',
      ],
      secureCheckout: 'Checkout seguro com Stripe',
      cancelAnytime: 'Cancele quando quiser',
    },
    es: {
      linkedinChannels: 'Canales',
      teamMembers: 'Miembros del Equipo',
      basePlan: 'Plan Base (1 canal, 2 usuarios, 200 créditos)',
      extraChannel: 'Canal Extra',
      extraChannels: 'Canales Extras',
      extraUser: 'Usuario Extra',
      extraUsers: 'Usuarios Extras',
      firstMonth: 'Primer Mes',
      then: 'Después',
      perMonth: 'mes',
      limitedOffer: 'Oferta Limitada',
      cta: 'Suscribirse Ahora',
      processing: 'Procesando...',
      error: 'Algo salió mal. Inténtalo de nuevo.',
      features: [
        'Agentes IA Ilimitados',
        'Automatización LinkedIn',
        'Campañas de Email',
        '200 Créditos Google Maps/mes',
        'Soporte Prioritario',
      ],
      secureCheckout: 'Checkout seguro con Stripe',
      cancelAnytime: 'Cancela cuando quieras',
    },
  };

  const texts = t[locale as keyof typeof t] || t.en;

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      // Call guest checkout endpoint directly
      const response = await fetch(`${API_URL}/billing/checkout-guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extraChannels,
          extraUsers,
          successUrl: `${window.location.origin}/${locale !== 'en' ? locale + '/' : ''}?checkout=success`,
          cancelUrl: `${window.location.origin}/${locale !== 'en' ? locale + '/' : ''}#pricing`,
        }),
      });

      const data = await response.json();

      if (data.success && data.data?.url) {
        // Redirect to Stripe checkout
        window.location.href = data.data.url;
      } else {
        setError(data.message || texts.error);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(texts.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        {/* Discount Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-4 text-center">
          <span className="text-white text-xl font-bold">70% OFF</span>
          <span className="text-white/90 ml-2">{texts.firstMonth}</span>
          <span className="ml-3 bg-white/20 text-white text-xs font-medium px-3 py-1 rounded-full">
            {texts.limitedOffer}
          </span>
        </div>

        {/* Price Header */}
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-200">
          <div className="flex items-baseline gap-3">
            <span className="text-5xl font-bold text-gray-900">${formatPrice(firstMonthTotal)}</span>
            <span className="text-xl text-gray-400 line-through">${formatPrice(monthlyTotal)}</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {texts.firstMonth} · {texts.then} ${formatPrice(monthlyTotal)}/{texts.perMonth}
          </p>
        </div>

        <div className="p-8 space-y-8">
          {/* Channels Slider */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-900">{texts.linkedinChannels}</span>
              <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{channels}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={channels}
              onChange={(e) => setChannels(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((channels - 1) / 9) * 100}%, #e5e7eb ${((channels - 1) / 9) * 100}%, #e5e7eb 100%)`
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
              <span className="text-sm font-semibold text-gray-900">{texts.teamMembers}</span>
              <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{users}</span>
            </div>
            <input
              type="range"
              min="2"
              max="20"
              value={users}
              onChange={(e) => setUsers(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((users - 2) / 18) * 100}%, #e5e7eb ${((users - 2) / 18) * 100}%, #e5e7eb 100%)`
              }}
            />
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>2</span>
              <span>20</span>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="border-t border-gray-100 pt-6 space-y-3 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{texts.basePlan}</span>
              <span>${formatPrice(PRICES.basePlan)}</span>
            </div>
            {extraChannels > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>+{extraChannels} {extraChannels === 1 ? texts.extraChannel : texts.extraChannels}</span>
                <span>${formatPrice(extraChannels * PRICES.extraChannel)}</span>
              </div>
            )}
            {extraUsers > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>+{extraUsers} {extraUsers === 1 ? texts.extraUser : texts.extraUsers}</span>
                <span>${formatPrice(extraUsers * PRICES.extraUser)}</span>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* CTA Button */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {texts.processing}
              </>
            ) : (
              <>
                {texts.cta}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Features List */}
      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-gray-600">
        {texts.features.map((feature) => (
          <span key={feature} className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </span>
        ))}
      </div>

      {/* Trust badges */}
      <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          {texts.secureCheckout}
        </span>
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {texts.cancelAnytime}
        </span>
      </div>

      {/* Slider styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #7c3aed;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          transition: transform 0.15s ease;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #7c3aed;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  );
}
