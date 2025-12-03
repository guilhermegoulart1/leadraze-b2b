import React, { useState } from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { useBilling } from '../contexts/BillingContext';
import SubscribeModal from './SubscribeModal';

/**
 * Trial Indicator Component
 * Shows trial days remaining in the header with a subscribe button
 * Opens a modal to configure and subscribe to a plan
 */
const TrialIndicator = () => {
  const { isTrial, trialDaysRemaining, loading } = useBilling();
  const [showModal, setShowModal] = useState(false);

  // Don't show if not in trial or still loading
  if (loading || !isTrial) {
    return null;
  }

  const days = trialDaysRemaining || 0;
  const isUrgent = days <= 2;

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-white"
        style={{ backgroundColor: isUrgent ? '#e53e3e' : '#ff6b35' }}
      >
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-semibold whitespace-nowrap">
          {days} {days === 1 ? 'dia restante' : 'dias restantes'}
        </span>
        <button
          onClick={() => setShowModal(true)}
          className="ml-1 px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 bg-white hover:bg-gray-100 shadow-sm"
          style={{ color: '#ff6b35' }}
        >
          <Sparkles className="w-3 h-3" />
          <span>Assinar</span>
        </button>
      </div>

      <SubscribeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

export default TrialIndicator;
