import React, { useState } from 'react';
import { useBilling, BLOCK_LEVELS } from '../contexts/BillingContext';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Heart, Rocket, Clock, Check, LogOut, CreditCard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SubscribeModal from './SubscribeModal';

const SubscriptionBlockOverlay = ({ children }) => {
  const {
    blockLevel,
    blockMessage,
    subscription,
    createCheckout,
    reactivateSubscription,
    resubscribeWithPaymentMethod,
    openPortal,
    paymentMethods,
    hasPaymentMethod,
    loading
  } = useBilling();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [resubscribeError, setResubscribeError] = useState(null);

  // Don't show anything while loading
  if (loading) {
    return children;
  }

  // No block needed
  if (blockLevel === BLOCK_LEVELS.NONE) {
    return children;
  }

  const handleAction = async () => {
    setActionLoading(true);
    try {
      if (blockMessage?.action === 'Reactivate') {
        // Open subscribe modal instead of reactivating
        setShowSubscribeModal(true);
        setActionLoading(false);
        return;
      } else if (blockMessage?.action === 'Update Payment') {
        await openPortal();
      } else if (blockMessage?.action === 'Choose a Plan' || blockMessage?.action === 'Subscribe Now') {
        setShowSubscribeModal(true);
        setActionLoading(false);
        return;
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle quick resubscribe with existing card
  const handleQuickResubscribe = async () => {
    setActionLoading(true);
    setResubscribeError(null);
    try {
      await resubscribeWithPaymentMethod();
      // Success! The page will reload with active subscription
    } catch (err) {
      console.error('Quick resubscribe failed:', err);
      setResubscribeError(err.message || 'Falha ao reativar. Tente com outro cartão.');
    } finally {
      setActionLoading(false);
    }
  };

  // Get display info for existing card
  const existingCard = paymentMethods?.[0];
  const cardDisplay = existingCard ? `${existingCard.brand?.toUpperCase() || 'CARD'} •••• ${existingCard.last4}` : null;

  // Warning banner (non-blocking)
  if (blockLevel === BLOCK_LEVELS.WARNING) {
    return (
      <>
        <div className="bg-amber-500 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{blockMessage?.message}</span>
            </div>
            <button
              onClick={handleAction}
              disabled={actionLoading}
              className="bg-white text-amber-600 px-4 py-1.5 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Loading...' : blockMessage?.action}
            </button>
          </div>
        </div>
        {children}
        <SubscribeModal isOpen={showSubscribeModal} onClose={() => setShowSubscribeModal(false)} />
      </>
    );
  }

  // Soft block - show overlay but with less opacity
  if (blockLevel === BLOCK_LEVELS.SOFT_BLOCK) {
    return (
      <>
        {/* Semi-transparent overlay */}
        <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm z-40" />

        {/* Block modal */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            {/* Warning icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-amber-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {blockMessage?.title}
            </h2>

            <p className="text-gray-600 mb-6">
              {blockMessage?.message}
            </p>

            {/* Data retention warning */}
            {subscription?.status === 'canceled' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-amber-800">Seus dados serão mantidos por 30 dias</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Reative agora para não perder nada!
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Aguarde...' : 'Reativar Assinatura'}
              </button>

              <button
                onClick={() => navigate('/billing')}
                className="w-full text-gray-600 py-2 hover:text-gray-900 transition-colors text-sm"
              >
                Ver Detalhes de Cobrança
              </button>
            </div>
          </div>
        </div>

        {/* Page content (blurred/dimmed) */}
        <div className="filter blur-sm pointer-events-none">
          {children}
        </div>

        <SubscribeModal isOpen={showSubscribeModal} onClose={() => setShowSubscribeModal(false)} />
      </>
    );
  }

  // Hard block - full overlay with friendly design
  if (blockLevel === BLOCK_LEVELS.HARD_BLOCK) {
    return (
      <>
        <div
          className="min-h-screen flex items-center justify-center p-4 overflow-auto"
          style={{
            background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 50%, #4c1d95 100%)'
          }}
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
            {/* Welcoming icon */}
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30 -mt-16">
              <Heart className="w-10 h-10 text-white" />
            </div>

            {/* Friendly Title */}
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
              Sentimos sua falta!
            </h1>

            {/* Subtitle */}
            <p className="text-gray-500 text-sm text-center mb-6">
              Sua assinatura expirou, mas seus dados ainda estão aqui te esperando.
            </p>

            {/* What they'll get back */}
            <div className="bg-purple-50 rounded-xl p-4 mb-6 border border-purple-100">
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
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

            {/* Error message */}
            {resubscribeError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-red-700">{resubscribeError}</p>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="space-y-3">
              {/* Quick resubscribe with existing card */}
              {hasPaymentMethod && cardDisplay && (
                <button
                  onClick={handleQuickResubscribe}
                  disabled={actionLoading}
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 transform hover:scale-[1.02] disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Reativando...
                    </span>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Reativar com {cardDisplay}
                    </>
                  )}
                </button>
              )}

              {/* Use different card / new subscription */}
              <button
                onClick={() => setShowSubscribeModal(true)}
                disabled={actionLoading}
                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  hasPaymentMethod
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/30 transform hover:scale-[1.02]'
                } disabled:opacity-50`}
              >
                <Sparkles className="w-5 h-5" />
                {hasPaymentMethod ? 'Usar outro cartão' : 'Reativar minha conta'}
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
            <p className="text-center text-gray-400 text-xs mt-6">
              Precisa de ajuda?{' '}
              <a href="mailto:suporte@getraze.com" className="text-purple-600 hover:underline font-medium">
                Fale conosco
              </a>
            </p>
          </div>
        </div>

        <SubscribeModal isOpen={showSubscribeModal} onClose={() => setShowSubscribeModal(false)} />
      </>
    );
  }

  return children;
};

export default SubscriptionBlockOverlay;
