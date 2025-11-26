import React, { useState } from 'react';
import { useBilling, BLOCK_LEVELS } from '../contexts/BillingContext';
import { useNavigate } from 'react-router-dom';

const SubscriptionBlockOverlay = ({ children }) => {
  const {
    blockLevel,
    blockMessage,
    subscription,
    createCheckout,
    reactivateSubscription,
    openPortal,
    loading
  } = useBilling();
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);

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
        await reactivateSubscription();
      } else if (blockMessage?.action === 'Update Payment') {
        await openPortal();
      } else if (blockMessage?.action === 'Choose a Plan' || blockMessage?.action === 'Subscribe Now') {
        navigate('/pricing');
      }
    } catch (err) {
      console.error('Action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-medium text-red-800">Data will be permanently deleted</p>
                    <p className="text-sm text-red-600 mt-1">
                      Your campaigns, leads, and conversations will be deleted 30 days after your subscription ends.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleAction}
                disabled={actionLoading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Please wait...' : blockMessage?.action}
              </button>

              <button
                onClick={() => navigate('/billing')}
                className="w-full text-gray-600 py-2 hover:text-gray-900 transition-colors text-sm"
              >
                View Billing Details
              </button>
            </div>
          </div>
        </div>

        {/* Page content (blurred/dimmed) */}
        <div className="filter blur-sm pointer-events-none">
          {children}
        </div>
      </>
    );
  }

  // Hard block - full overlay
  if (blockLevel === BLOCK_LEVELS.HARD_BLOCK) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
          {/* Error icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
            {blockMessage?.title}
          </h1>

          <p className="text-gray-600 text-center mb-8 text-lg">
            {blockMessage?.message}
          </p>

          {/* Data retention warning for canceled/expired */}
          {(subscription?.status === 'canceled' || subscription?.status === 'trial_expired') && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-8">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">Your data is at risk</h3>
                  <p className="text-sm text-red-700 mt-1">
                    All your campaigns, leads, conversations, and settings will be permanently deleted 30 days after your subscription ends.
                  </p>
                  <p className="text-sm font-medium text-red-800 mt-2">
                    Act now to preserve your data!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* What you'll lose section */}
          <div className="bg-gray-50 rounded-xl p-5 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Without a subscription, you lose access to:</h3>
            <ul className="space-y-2">
              {[
                'Your campaigns and automation',
                'Lead data and contact lists',
                'AI agent conversations',
                'Google Maps credits',
                'Team collaboration features'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleAction}
              disabled={actionLoading}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/30"
            >
              {actionLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Please wait...
                </span>
              ) : blockMessage?.action}
            </button>

            <div className="flex items-center justify-center gap-4 text-sm">
              <button
                onClick={() => navigate('/pricing')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                View Plans
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => navigate('/billing')}
                className="text-gray-600 hover:text-gray-900"
              >
                Billing Details
              </button>
            </div>
          </div>

          {/* Support link */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Need help? <a href="mailto:support@leadraze.com" className="text-blue-600 hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default SubscriptionBlockOverlay;
