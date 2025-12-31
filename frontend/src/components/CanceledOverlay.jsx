import React, { useState } from 'react';
import { Sparkles, Heart, Rocket, LogOut, Clock, Check } from 'lucide-react';
import { useBilling } from '../contexts/BillingContext';
import { useAuth } from '../contexts/AuthContext';
import SubscribeModal from './SubscribeModal';

/**
 * Canceled Overlay Component
 * Shows a friendly full-screen overlay when user's subscription is canceled
 * Encourages them to come back with a warm, brand-aligned design
 */
const CanceledOverlay = () => {
  const { subscription, loading } = useBilling();
  const { logout } = useAuth();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  // Don't show while loading
  if (loading) return null;

  // Only show for canceled subscriptions
  if (!subscription || subscription.status !== 'canceled') return null;

  // Check if subscription has actually ended (period end is in the past)
  const periodEnd = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const now = new Date();

  // If period hasn't ended yet, don't block (they still have access)
  if (periodEnd && periodEnd > now) return null;

  return (
    <>
      {/* Full screen overlay with brand gradient */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-auto"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #4c1d95 100%)'
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
        </div>

        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl relative">
          {/* Welcoming icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30 -mt-16">
            <Heart className="w-10 h-10 text-white" />
          </div>

          {/* Friendly Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sentimos sua falta!
          </h1>

          {/* Subtitle */}
          <p className="text-gray-500 text-sm mb-6">
            Sua assinatura expirou, mas seus dados ainda estão aqui te esperando.
          </p>

          {/* What they'll get back */}
          <div className="bg-purple-50 rounded-xl p-4 mb-6 text-left border border-purple-100">
            <p className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Volte e recupere acesso a:
            </p>
            <ul className="space-y-2 text-sm text-purple-800">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                Seu pipeline de leads e CRM
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                Agentes de IA e automações
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                Campanhas de ativação
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-purple-600 flex-shrink-0" />
                Créditos Google Maps
              </li>
            </ul>
          </div>

          {/* Data retention notice - less scary */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-800">
                  Seus dados serão mantidos por 30 dias
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Reative agora para não perder nada!
                </p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setShowSubscribeModal(true)}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 transform hover:scale-[1.02]"
            >
              <Sparkles className="w-5 h-5" />
              Reativar minha conta
            </button>

            <button
              onClick={logout}
              className="w-full text-gray-400 py-2 hover:text-gray-600 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair da conta
            </button>
          </div>

          {/* Support link */}
          <p className="text-xs text-gray-400 mt-6">
            Precisa de ajuda?{' '}
            <a href="mailto:suporte@getraze.com" className="text-purple-600 hover:underline font-medium">
              Fale conosco
            </a>
          </p>
        </div>
      </div>

      {/* Subscribe Modal */}
      <SubscribeModal
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
      />
    </>
  );
};

export default CanceledOverlay;
