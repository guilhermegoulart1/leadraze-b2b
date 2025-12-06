import React, { useState } from 'react';
import { Sparkles, X, Check, Lock } from 'lucide-react';
import { useBilling } from '../contexts/BillingContext';
import SubscribeModal from './SubscribeModal';

/**
 * Feature information for different blocked features
 */
const FEATURE_INFO = {
  api_keys: {
    title: 'API Keys',
    description: 'Gere chaves de API para integrar o LeadRaze com suas ferramentas existentes e automatizar seu fluxo de trabalho.',
    benefits: [
      'Conecte com seu CRM',
      'Construa integrações personalizadas',
      'Automatize importação de leads'
    ],
    icon: '🔑'
  },
  activation_campaigns: {
    title: 'Campanhas de Ativação',
    description: 'Alcance automaticamente seus leads via LinkedIn, WhatsApp e Email com mensagens personalizadas.',
    benefits: [
      'Outreach multicanal',
      'Personalização com IA',
      'Follow-ups automáticos'
    ],
    icon: '🚀'
  },
  channels: {
    title: 'Conexão de Canais',
    description: 'Conecte suas contas do LinkedIn e WhatsApp para automatizar o outreach e centralizar suas conversas.',
    benefits: [
      'Automação do LinkedIn',
      'Mensagens via WhatsApp',
      'Inbox unificado'
    ],
    icon: '🔗'
  }
};

/**
 * Premium Feature Modal Component
 * Shows an attractive modal when trial users try to access blocked features
 */
const PremiumFeatureModal = ({ isOpen, onClose, feature }) => {
  const { trialDaysRemaining } = useBilling();
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);

  const featureInfo = FEATURE_INFO[feature] || {
    title: 'Recurso Premium',
    description: 'Este recurso requer uma assinatura ativa.',
    benefits: ['Acesso total a todos os recursos', 'Suporte prioritário', 'Analytics avançados'],
    icon: '⭐'
  };

  const days = trialDaysRemaining || 0;

  const handleSubscribe = () => {
    onClose();
    setShowSubscribeModal(true);
  };

  return (
    <>
      {isOpen && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full relative overflow-hidden shadow-2xl">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-[#7229f7]" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="relative pt-6 px-6 pb-6">
            {/* Premium badge */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30 text-3xl">
                {featureInfo.icon}
              </div>
            </div>

            {/* Lock indicator */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center gap-1.5 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">
                <Lock className="w-3 h-3" />
                <span>Recurso Premium</span>
              </div>
            </div>

            {/* Title & Description */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {featureInfo.title}
              </h2>
              <p className="text-gray-600 text-sm">
                {featureInfo.description}
              </p>
            </div>

            {/* Benefits */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                O que você ganha
              </p>
              <ul className="space-y-2.5">
                {featureInfo.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            {/* Trial info */}
            {days > 0 && (
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 mb-6 text-center">
                <p className="text-sm text-purple-700">
                  Você ainda tem <span className="font-bold">{days} {days === 1 ? 'dia' : 'dias'}</span> de trial restantes
                </p>
                <p className="text-xs text-purple-500 mt-1">
                  Assine agora para desbloquear todos os recursos
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleSubscribe}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3.5 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
              >
                <Sparkles className="w-5 h-5" />
                Assinar Agora
              </button>

              <button
                onClick={onClose}
                className="w-full text-gray-500 py-2.5 hover:text-gray-700 text-sm font-medium transition-colors"
              >
                Continuar no Trial
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      <SubscribeModal
        isOpen={showSubscribeModal}
        onClose={() => setShowSubscribeModal(false)}
      />
    </>
  );
};

export default PremiumFeatureModal;
