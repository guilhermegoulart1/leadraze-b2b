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

// Modal para avisar que nao tem creditos suficientes
export const CreditsModal = ({ isOpen, onClose, requiredCredits = 1 }) => {
  const { t } = useTranslation('billing');
  const { credits, purchaseCredits } = useBilling();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePurchase = async (packageId) => {
    setLoading(true);
    try {
      await purchaseCredits(packageId);
    } catch (err) {
      console.error('Error purchasing credits:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
          {t('modals.insufficientCredits.title')}
        </h3>
        <p className="text-gray-600 text-center mb-2">
          {t('modals.insufficientCredits.message', { required: requiredCredits, available: credits?.available || 0 }).split('<strong>').map((part, i) => {
            if (i === 0) return part;
            const [bold, rest] = part.split('</strong>');
            return <React.Fragment key={i}><strong>{bold}</strong>{rest}</React.Fragment>;
          })}
        </p>
        <p className="text-gray-500 text-sm text-center mb-2">
          {t('modals.insufficientCredits.subtitle')}
        </p>
        <p className="text-green-600 text-sm font-medium text-center mb-6">
          {t('modals.insufficientCredits.neverExpire')}
        </p>

        <div className="space-y-3 mb-4">
          {[
            { id: 'credits-500', amount: 500, price: 47 },
            { id: 'credits-1000', amount: 1000, price: 87 },
            { id: 'credits-2500', amount: 2500, price: 197 }
          ].map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg.id)}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <div className="text-left">
                <p className="font-semibold text-gray-900">{pkg.amount.toLocaleString()} {t('purchaseModal.credits')}</p>
                <p className="text-sm text-green-500">{t('modals.insufficientCredits.neverExpireLabel')}</p>
              </div>
              <p className="text-xl font-bold text-gray-900">R$ {pkg.price}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full text-gray-500 py-2 hover:text-gray-700"
        >
          {t('purchaseModal.cancel')}
        </button>
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
