import React, { useState } from 'react';
import { useBilling } from '../contexts/BillingContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PremiumFeatureModal from './PremiumFeatureModal';

// Modal para avisar que atingiu o limite de usuarios
export const UserLimitModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation('billing');
  const { addExtraUser, subscription } = useBilling();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddUser = async () => {
    setLoading(true);
    try {
      await addExtraUser();
      onClose();
    } catch (err) {
      console.error('Error adding user:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {t('modals.userLimit.title')}
        </h3>
        <p className="text-gray-600 text-center mb-6">
          {t('modals.userLimit.message')}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAddUser}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? '...' : t('modals.userLimit.addUser')}
          </button>

          <button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50"
          >
            {t('modals.userLimit.upgradePlan')}
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 py-2 hover:text-gray-700"
          >
            {t('modals.userLimit.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal para avisar que atingiu o limite de canais
export const ChannelLimitModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation('billing');
  const { addExtraChannel, subscription } = useBilling();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAddChannel = async () => {
    setLoading(true);
    try {
      await addExtraChannel();
      onClose();
    } catch (err) {
      console.error('Error adding channel:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {t('modals.channelLimit.title')}
        </h3>
        <p className="text-gray-600 text-center mb-6">
          {t('modals.channelLimit.message')}
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAddChannel}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '...' : t('modals.channelLimit.addChannel')}
          </button>

          <button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50"
          >
            {t('modals.channelLimit.upgradePlan')}
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 py-2 hover:text-gray-700"
          >
            {t('modals.channelLimit.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal para avisar que nao tem creditos suficientes - Same format as GoogleMapsAgentsPage
export const CreditsModal = ({ isOpen, onClose, requiredCredits = 1 }) => {
  const { t } = useTranslation('billing');
  const { credits, purchaseCredits } = useBilling();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [purchasingPackage, setPurchasingPackage] = useState(null);

  if (!isOpen) return null;

  const handlePurchase = async (packageId) => {
    setPurchasingPackage(packageId);
    setLoading(true);
    try {
      await purchaseCredits(packageId);
    } catch (err) {
      console.error('Error purchasing credits:', err);
    } finally {
      setLoading(false);
      setPurchasingPackage(null);
    }
  };

  // Credit packages matching backend stripe.js configuration
  const creditPackages = [
    { id: 'gmaps_500', credits: 500, price: 9, popular: false },
    { id: 'gmaps_1000', credits: 1000, price: 17, popular: true },
    { id: 'gmaps_2500', credits: 2500, price: 39, popular: false },
    { id: 'gmaps_5000', credits: 5000, price: 55, popular: false }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <h2 className="text-lg font-bold">{t('modals.insufficientCredits.title')}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Message */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2 mb-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t('modals.insufficientCredits.message', { required: requiredCredits, available: credits?.total || credits?.available || 0 }).split('<strong>').map((part, i) => {
                if (i === 0) return part;
                const [bold, rest] = part.split('</strong>');
                return <React.Fragment key={i}><strong>{bold}</strong>{rest}</React.Fragment>;
              })}
            </p>
          </div>

          {/* Benefits - inline */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {t('modals.insufficientCredits.neverExpire')}
            </span>
          </div>

          {/* Package options - Same as GoogleMapsAgentsPage */}
          <div className="space-y-2 mb-4">
            {creditPackages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 transition-all ${
                  pkg.popular
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  {pkg.popular && (
                    <span className="bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                      {t('purchaseModal.popular', 'Popular')}
                    </span>
                  )}
                  <div className="text-left">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {pkg.credits.toLocaleString()} {t('purchaseModal.credits')}
                    </span>
                    <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                      ${(pkg.price / pkg.credits * 100).toFixed(1)} {t('purchaseModal.perLead', '/lead')}
                    </span>
                  </div>
                </div>
                {purchasingPackage === pkg.id ? (
                  <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-lg font-bold text-gray-900 dark:text-white">
                    ${pkg.price}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-gray-400 text-xs mb-2">
            {t('purchaseModal.securePayment', 'Secure payment via Stripe')}
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {t('purchaseModal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal de upgrade generico
export const UpgradeModal = ({ isOpen, onClose, feature }) => {
  const { t } = useTranslation('billing');
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {t('modals.upgrade.title')}
        </h3>
        <p className="text-gray-600 text-center mb-6">
          {feature
            ? t('modals.upgrade.messageWithFeature', { feature })
            : t('modals.upgrade.messageGeneric')
          }
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700"
          >
            {t('modals.upgrade.viewPlans')}
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 py-2 hover:text-gray-700"
          >
            {t('modals.upgrade.maybeLater')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook para usar os modais facilmente
export const useBillingModals = () => {
  const [userLimitOpen, setUserLimitOpen] = useState(false);
  const [channelLimitOpen, setChannelLimitOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [premiumFeatureOpen, setPremiumFeatureOpen] = useState(false);
  const [creditsRequired, setCreditsRequired] = useState(1);
  const [upgradeFeature, setUpgradeFeature] = useState(null);
  const [premiumFeature, setPremiumFeature] = useState(null);

  const showUserLimitModal = () => setUserLimitOpen(true);
  const showChannelLimitModal = () => setChannelLimitOpen(true);
  const showCreditsModal = (required = 1) => {
    setCreditsRequired(required);
    setCreditsOpen(true);
  };
  const showUpgradeModal = (feature = null) => {
    setUpgradeFeature(feature);
    setUpgradeOpen(true);
  };
  const showPremiumFeatureModal = (feature) => {
    setPremiumFeature(feature);
    setPremiumFeatureOpen(true);
  };

  const BillingModalsComponent = () => (
    <>
      <UserLimitModal isOpen={userLimitOpen} onClose={() => setUserLimitOpen(false)} />
      <ChannelLimitModal isOpen={channelLimitOpen} onClose={() => setChannelLimitOpen(false)} />
      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} requiredCredits={creditsRequired} />
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature={upgradeFeature} />
      <PremiumFeatureModal isOpen={premiumFeatureOpen} onClose={() => setPremiumFeatureOpen(false)} feature={premiumFeature} />
    </>
  );

  return {
    showUserLimitModal,
    showChannelLimitModal,
    showCreditsModal,
    showUpgradeModal,
    showPremiumFeatureModal,
    BillingModalsComponent
  };
};

export default {
  UserLimitModal,
  ChannelLimitModal,
  CreditsModal,
  UpgradeModal,
  useBillingModals
};
