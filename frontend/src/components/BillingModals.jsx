import React, { useState } from 'react';
import { useBilling } from '../contexts/BillingContext';
import { useNavigate } from 'react-router-dom';

// Modal para avisar que atingiu o limite de usuários
export const UserLimitModal = ({ isOpen, onClose }) => {
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
          User Limit Reached
        </h3>
        <p className="text-gray-600 text-center mb-6">
          You've reached your plan's user limit. Add an extra user seat or upgrade your plan.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAddUser}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Extra User ($5/month)'}
          </button>

          <button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50"
          >
            Upgrade Plan
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 py-2 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal para avisar que atingiu o limite de canais
export const ChannelLimitModal = ({ isOpen, onClose }) => {
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
          Channel Limit Reached
        </h3>
        <p className="text-gray-600 text-center mb-6">
          You've reached your plan's LinkedIn channel limit. Add an extra channel or upgrade your plan.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleAddChannel}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Extra Channel ($30/month)'}
          </button>

          <button
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-50"
          >
            Upgrade Plan
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 py-2 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal para avisar que não tem créditos suficientes
export const CreditsModal = ({ isOpen, onClose, requiredCredits = 1 }) => {
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
          Insufficient Credits
        </h3>
        <p className="text-gray-600 text-center mb-2">
          You need <strong>{requiredCredits}</strong> credits but only have <strong>{credits?.available || 0}</strong>.
        </p>
        <p className="text-gray-500 text-sm text-center mb-6">
          Purchase additional Google Maps credits to continue.
        </p>

        <div className="space-y-3 mb-4">
          {[
            { id: 'credits_1000', amount: 1000, price: 50 },
            { id: 'credits_2500', amount: 2500, price: 100 }
          ].map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handlePurchase(pkg.id)}
              disabled={loading}
              className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              <div className="text-left">
                <p className="font-semibold text-gray-900">{pkg.amount.toLocaleString()} credits</p>
                <p className="text-sm text-gray-500">Valid for 30 days</p>
              </div>
              <p className="text-xl font-bold text-gray-900">${pkg.price}</p>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full text-gray-500 py-2 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Modal de upgrade genérico
export const UpgradeModal = ({ isOpen, onClose, feature }) => {
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
          Upgrade Required
        </h3>
        <p className="text-gray-600 text-center mb-6">
          {feature
            ? `To access ${feature}, please upgrade your subscription.`
            : 'This feature requires a higher plan. Upgrade to unlock more capabilities.'
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
            View Plans
          </button>

          <button
            onClick={onClose}
            className="w-full text-gray-500 py-2 hover:text-gray-700"
          >
            Maybe Later
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
  const [creditsRequired, setCreditsRequired] = useState(1);
  const [upgradeFeature, setUpgradeFeature] = useState(null);

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

  const BillingModalsComponent = () => (
    <>
      <UserLimitModal isOpen={userLimitOpen} onClose={() => setUserLimitOpen(false)} />
      <ChannelLimitModal isOpen={channelLimitOpen} onClose={() => setChannelLimitOpen(false)} />
      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} requiredCredits={creditsRequired} />
      <UpgradeModal isOpen={upgradeOpen} onClose={() => setUpgradeOpen(false)} feature={upgradeFeature} />
    </>
  );

  return {
    showUserLimitModal,
    showChannelLimitModal,
    showCreditsModal,
    showUpgradeModal,
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
