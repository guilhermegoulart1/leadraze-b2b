import { useState } from 'react';

// Prices in cents (USD) - Must match backend/src/config/stripe.js
const PRICES = {
  basePlan: 4500, // $45 (includes 1 channel, 2 users, 200 gmaps credits, 5000 AI credits)
  extraChannel: 2700, // $27/month per extra channel
  extraUser: 300, // $3/month per extra user
};

// Launch promotion
const LAUNCH_DISCOUNT = 0.60; // 60% OFF first month

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
    return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Translations
  const t = {
    en: {
      channels: 'Channels',
      teamMembers: 'Team Members',
      basePlan: 'Base Plan',
      extraChannel: 'Extra Channel',
      extraChannels: 'Extra Channels',
      extraUser: 'Extra User',
      extraUsers: 'Extra Users',
      firstMonth: 'first month',
      then: 'then',
      perMonth: '/mo',
      cta: 'Subscribe Now',
      processing: 'Processing...',
      error: 'Something went wrong. Please try again.',
      yourPlan: 'Your plan',
      promoOffer: '60% OFF Launch Promotion',
      promoDescription: 'Get 60% off your first month using code 60OFF at checkout',
      promoCode: '60OFF',
      included: 'included',
      monthlyPayment: 'monthly payment',
      totalPrice: 'Total price',
      secureCheckout: 'Secure checkout',
      cancelAnytime: 'Cancel anytime',
      items: {
        channel: 'Communication channel',
        users: 'Team members',
        gmapsCredits: 'Google Maps credits/mo',
        aiCredits: 'AI interactions/mo',
        agents: 'Unlimited AI agents',
        support: 'Priority support',
        leadCapture: 'Lead capture & enrichment',
        automation: 'Conversation automation'
      }
    },
    'pt-br': {
      channels: 'Canais',
      teamMembers: 'Membros',
      basePlan: 'Plano Base',
      extraChannel: 'Canal Extra',
      extraChannels: 'Canais Extras',
      extraUser: 'Usuário Extra',
      extraUsers: 'Usuários Extras',
      firstMonth: 'primeiro mês',
      then: 'depois',
      perMonth: '/mês',
      cta: 'Assinar Agora',
      processing: 'Processando...',
      error: 'Algo deu errado. Tente novamente.',
      yourPlan: 'Seu plano',
      promoOffer: '60% OFF Promoção de Lançamento',
      promoDescription: 'Ganhe 60% de desconto no primeiro mês usando o código 60OFF no checkout',
      promoCode: '60OFF',
      included: 'incluído',
      monthlyPayment: 'pagamento mensal',
      totalPrice: 'Preço total',
      secureCheckout: 'Checkout seguro',
      cancelAnytime: 'Cancele quando quiser',
      items: {
        channel: 'Canal de comunicação',
        users: 'Membros do time',
        gmapsCredits: 'Créditos Google Maps/mês',
        aiCredits: 'Interações IA/mês',
        agents: 'Agentes IA ilimitados',
        support: 'Suporte prioritário',
        leadCapture: 'Captura e enriquecimento de leads',
        automation: 'Automação de conversas'
      }
    },
    es: {
      channels: 'Canales',
      teamMembers: 'Miembros',
      basePlan: 'Plan Base',
      extraChannel: 'Canal Extra',
      extraChannels: 'Canales Extras',
      extraUser: 'Usuario Extra',
      extraUsers: 'Usuarios Extras',
      firstMonth: 'primer mes',
      then: 'después',
      perMonth: '/mes',
      cta: 'Suscribirse Ahora',
      processing: 'Procesando...',
      error: 'Algo salió mal. Inténtalo de nuevo.',
      yourPlan: 'Tu plan',
      promoOffer: '60% OFF Promoción de Lanzamiento',
      promoDescription: 'Obtén 60% de descuento en tu primer mes usando el código 60OFF',
      promoCode: '60OFF',
      included: 'incluido',
      monthlyPayment: 'pago mensual',
      totalPrice: 'Precio total',
      secureCheckout: 'Checkout seguro',
      cancelAnytime: 'Cancela cuando quieras',
      items: {
        channel: 'Canal de comunicación',
        users: 'Miembros del equipo',
        gmapsCredits: 'Créditos Google Maps/mes',
        aiCredits: 'Interacciones IA/mes',
        agents: 'Agentes IA ilimitados',
        support: 'Soporte prioritario',
        leadCapture: 'Captura y enriquecimiento de leads',
        automation: 'Automatización de conversaciones'
      }
    },
  };

  const texts = t[locale as keyof typeof t] || t.en;

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
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
    <div className="max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left Side - Configuration */}
          <div className="flex-1 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-100">
            {/* Channels Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">{texts.channels}</span>
                <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">{channels}</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={channels}
                onChange={(e) => setChannels(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((channels - 1) / 9) * 100}%, #ede9fe ${((channels - 1) / 9) * 100}%, #ede9fe 100%)`
                }}
              />
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Users Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">{texts.teamMembers}</span>
                <span className="text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">{users}</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                value={users}
                onChange={(e) => setUsers(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((users - 2) / 18) * 100}%, #ede9fe ${((users - 2) / 18) * 100}%, #ede9fe 100%)`
                }}
              />
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>2</span>
                <span>20</span>
              </div>
            </div>

            {/* What's Included - Brevo Style Grid */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">{channels} {texts.items.channel} + {users} {texts.items.users} {texts.included}.</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{texts.items.agents}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>5,000 {texts.items.aiCredits}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>200 {texts.items.gmapsCredits}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{texts.items.leadCapture}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{texts.items.automation}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{texts.items.support}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Summary & CTA */}
          <div className="w-full lg:w-80 p-6 lg:p-8 bg-gray-50">
            {/* Promo Banner */}
            <div className="bg-purple-600 rounded-lg p-3 mb-5">
              <p className="text-xs text-white">
                <span className="font-semibold">🔥 {texts.promoOffer}:</span>{' '}
                {texts.promoDescription}
              </p>
            </div>

            {/* Your Plan Summary */}
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{texts.yourPlan}</h3>

            {/* Plan Details - Brevo Style */}
            <div className="space-y-2 text-sm mb-4">
              {/* Base Plan */}
              <div className="flex justify-between items-center">
                <span className="text-gray-700">{texts.basePlan}</span>
                <span className="text-gray-900 font-medium">${formatPrice(Math.round(PRICES.basePlan * 0.4))}{texts.perMonth}</span>
              </div>

              {/* Channels */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{channels} {texts.items.channel}</span>
                <span className="text-gray-400 text-xs">{texts.included}</span>
              </div>

              {/* Users */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{users} {texts.items.users}</span>
                <span className="text-gray-400 text-xs">{texts.included}</span>
              </div>

              {/* AI Credits */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">5,000 {texts.items.aiCredits}</span>
                <span className="text-gray-400 text-xs">{texts.included}</span>
              </div>

              {/* GMaps Credits */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">200 {texts.items.gmapsCredits}</span>
                <span className="text-gray-400 text-xs">{texts.included}</span>
              </div>

              {/* Extra Channels */}
              {extraChannels > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-gray-700">+{extraChannels} {extraChannels === 1 ? texts.extraChannel : texts.extraChannels}</span>
                  <span className="text-gray-900 font-medium">${formatPrice(Math.round(extraChannels * PRICES.extraChannel * 0.4))}</span>
                </div>
              )}

              {/* Extra Users */}
              {extraUsers > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">+{extraUsers} {extraUsers === 1 ? texts.extraUser : texts.extraUsers}</span>
                  <span className="text-gray-900 font-medium">${formatPrice(Math.round(extraUsers * PRICES.extraUser * 0.4))}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="border-t border-gray-200 pt-4 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{texts.totalPrice}</span>
                <span className="text-red-500 line-through text-sm">${formatPrice(monthlyTotal)}{texts.perMonth}</span>
              </div>
              <div className="text-right mt-1">
                <span className="text-2xl font-bold text-gray-900">${formatPrice(firstMonthTotal)}{texts.perMonth}</span>
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">
                {texts.then} ${formatPrice(monthlyTotal)}{texts.perMonth}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-xs mb-4">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-medium text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {texts.processing}
                </>
              ) : (
                texts.cta
              )}
            </button>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {texts.secureCheckout}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {texts.cancelAnytime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Slider styles */}
      <style>{`
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 6px rgba(124, 58, 237, 0.4);
        }
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
        }
      `}</style>
    </div>
  );
}
