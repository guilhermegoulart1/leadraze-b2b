import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const BillingContext = createContext();

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within BillingProvider');
  }
  return context;
};

// Block levels
export const BLOCK_LEVELS = {
  NONE: 'none',
  WARNING: 'warning',       // Show warning banner but allow usage
  SOFT_BLOCK: 'soft_block', // Block new campaigns, allow viewing
  HARD_BLOCK: 'hard_block'  // Block everything except billing page
};

export const BillingProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [addons, setAddons] = useState({ recurring: [], credits: [] });
  const [usage, setUsage] = useState(null);
  const [credits, setCredits] = useState(null);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.getSubscription();
      if (response.success) {
        setSubscription(response.data);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    }
  }, [isAuthenticated]);

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    try {
      const response = await api.getPlans();
      if (response.success && response.data) {
        // Handle new structure: { plans: [], addons: { recurring: [], credits: [] } }
        if (Array.isArray(response.data)) {
          setPlans(response.data);
        } else {
          setPlans(response.data.plans || []);
          setAddons(response.data.addons || { recurring: [], credits: [] });
        }
      }
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }, []);

  // Fetch usage data
  const fetchUsage = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.getUsage();
      if (response.success) {
        setUsage(response.data);
      }
    } catch (err) {
      console.error('Error fetching usage:', err);
    }
  }, [isAuthenticated]);

  // Fetch credits
  const fetchCredits = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.getCredits();
      if (response.success) {
        setCredits(response.data);
      }
    } catch (err) {
      console.error('Error fetching credits:', err);
    }
  }, [isAuthenticated]);

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await api.getPaymentMethods();
      if (response.success) {
        setPaymentMethods(response.data.paymentMethods || []);
      }
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    }
  }, [isAuthenticated]);

  // Load all billing data
  const loadBillingData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchSubscription(),
      fetchPlans(),
      fetchUsage(),
      fetchCredits(),
      fetchPaymentMethods()
    ]);
    setLoading(false);
  }, [fetchSubscription, fetchPlans, fetchUsage, fetchCredits, fetchPaymentMethods]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      loadBillingData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, loadBillingData]);

  // Get block level based on subscription status
  const getBlockLevel = useCallback(() => {
    if (!subscription) return BLOCK_LEVELS.NONE;

    const { status, daysUntilEnd } = subscription;

    // Trial expired or subscription canceled/unpaid
    if (status === 'trial_expired' || status === 'unpaid') {
      return BLOCK_LEVELS.HARD_BLOCK;
    }

    if (status === 'canceled') {
      // Grace period - soft block
      if (daysUntilEnd && daysUntilEnd > 0) {
        return BLOCK_LEVELS.SOFT_BLOCK;
      }
      return BLOCK_LEVELS.HARD_BLOCK;
    }

    if (status === 'past_due') {
      return BLOCK_LEVELS.SOFT_BLOCK;
    }

    // Warning for trial ending soon
    if (status === 'trialing' && daysUntilEnd && daysUntilEnd <= 3) {
      return BLOCK_LEVELS.WARNING;
    }

    return BLOCK_LEVELS.NONE;
  }, [subscription]);

  // Create checkout session
  const createCheckout = async (planId, currency = 'brl', options = {}) => {
    try {
      const { extraChannels = 0, extraUsers = 0 } = options;
      const response = await api.createCheckoutSession({
        planId,
        currency,
        extraChannels,
        extraUsers
      });
      if (response.success && response.data.url) {
        window.location.href = response.data.url;
      }
      return response;
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  };

  // Purchase credits
  const purchaseCredits = async (packageId, currency = 'brl') => {
    try {
      const response = await api.purchaseCredits({ packageKey: packageId, currency });
      if (response.success && response.data.url) {
        window.location.href = response.data.url;
      }
      return response;
    } catch (err) {
      console.error('Error purchasing credits:', err);
      throw err;
    }
  };

  // Open Stripe portal
  const openPortal = async () => {
    try {
      const response = await api.createPortalSession();
      if (response.success && response.data.url) {
        window.location.href = response.data.url;
      }
      return response;
    } catch (err) {
      console.error('Error opening portal:', err);
      throw err;
    }
  };

  // Cancel subscription
  const cancelSubscription = async () => {
    try {
      const response = await api.cancelSubscription();
      if (response.success) {
        await fetchSubscription();
      }
      return response;
    } catch (err) {
      console.error('Error canceling subscription:', err);
      throw err;
    }
  };

  // Reactivate subscription
  const reactivateSubscription = async () => {
    try {
      const response = await api.reactivateSubscription();
      if (response.success) {
        await fetchSubscription();
      }
      return response;
    } catch (err) {
      console.error('Error reactivating subscription:', err);
      throw err;
    }
  };

  // Add extra channel
  const addExtraChannel = async () => {
    try {
      const response = await api.addExtraChannel();
      if (response.success) {
        await Promise.all([fetchSubscription(), fetchUsage()]);
      }
      return response;
    } catch (err) {
      console.error('Error adding channel:', err);
      throw err;
    }
  };

  // Add extra user
  const addExtraUser = async () => {
    try {
      const response = await api.addExtraUser();
      if (response.success) {
        await Promise.all([fetchSubscription(), fetchUsage()]);
      }
      return response;
    } catch (err) {
      console.error('Error adding user:', err);
      throw err;
    }
  };

  // Resubscribe using existing payment method
  const resubscribeWithPaymentMethod = async (options = {}) => {
    try {
      const response = await api.resubscribeWithPaymentMethod(options);
      if (response.success) {
        // Refresh billing data to get new subscription
        await loadBillingData();
      }
      return response;
    } catch (err) {
      console.error('Error resubscribing:', err);
      throw err;
    }
  };

  // Check if can perform action based on limits
  const canAddUser = useCallback(() => {
    if (!usage || !subscription?.limits) return false;
    return usage.users.used < subscription.limits.users;
  }, [usage, subscription]);

  const canAddChannel = useCallback(() => {
    if (!usage || !subscription?.limits) return false;
    return usage.channels.used < subscription.limits.channels;
  }, [usage, subscription]);

  const hasCredits = useCallback((amount = 1) => {
    if (!credits) return false;
    return credits.available >= amount;
  }, [credits]);

  // Trial helpers
  const isTrial = useCallback(() => {
    return subscription?.status === 'trialing' || subscription?.isTrial === true;
  }, [subscription]);

  const getTrialDaysRemaining = useCallback(() => {
    if (!isTrial()) return null;
    return subscription?.trialDaysRemaining || subscription?.daysUntilTrialEnd || 0;
  }, [subscription, isTrial]);

  const isTrialFeatureBlocked = useCallback((feature) => {
    if (!isTrial()) return false;
    const blockedFeatures = ['api_keys', 'activation_campaigns', 'channels'];
    return blockedFeatures.includes(feature);
  }, [isTrial]);

  // Get block message
  const getBlockMessage = useCallback(() => {
    if (!subscription) return null;

    const { status, daysUntilEnd, dataRetentionDays = 30 } = subscription;

    switch (status) {
      case 'trial_expired':
        return {
          title: 'Trial Expired',
          message: 'Your free trial has ended. Subscribe now to continue using LeadRaze.',
          action: 'Choose a Plan',
          type: 'error'
        };
      case 'unpaid':
        return {
          title: 'Payment Required',
          message: 'Your subscription payment failed. Please update your payment method to continue.',
          action: 'Update Payment',
          type: 'error'
        };
      case 'canceled':
        if (daysUntilEnd && daysUntilEnd > 0) {
          return {
            title: 'Subscription Canceled',
            message: `Your subscription has been canceled. You have ${daysUntilEnd} days left to access your data. After that, data will be deleted in ${dataRetentionDays} days.`,
            action: 'Reactivate',
            type: 'warning'
          };
        }
        return {
          title: 'Subscription Ended',
          message: `Your subscription has ended. Your data will be deleted in ${dataRetentionDays} days. Reactivate now to keep your data.`,
          action: 'Reactivate',
          type: 'error'
        };
      case 'past_due':
        return {
          title: 'Payment Past Due',
          message: 'Your payment is past due. Please update your payment method to avoid service interruption.',
          action: 'Update Payment',
          type: 'warning'
        };
      case 'trialing':
        if (daysUntilEnd && daysUntilEnd <= 3) {
          return {
            title: 'Trial Ending Soon',
            message: `Your trial ends in ${daysUntilEnd} day${daysUntilEnd > 1 ? 's' : ''}. Subscribe now to keep your campaigns and data.`,
            action: 'Subscribe Now',
            type: 'info'
          };
        }
        return null;
      default:
        return null;
    }
  }, [subscription]);

  // Refresh billing data
  const refresh = useCallback(() => {
    return loadBillingData();
  }, [loadBillingData]);

  const value = {
    // State
    subscription,
    plans,
    addons,
    usage,
    credits,
    paymentMethods,
    hasPaymentMethod: paymentMethods.length > 0,
    loading,
    error,

    // Block level
    blockLevel: getBlockLevel(),
    blockMessage: getBlockMessage(),
    isBlocked: getBlockLevel() === BLOCK_LEVELS.HARD_BLOCK,
    isSoftBlocked: getBlockLevel() === BLOCK_LEVELS.SOFT_BLOCK,
    hasWarning: getBlockLevel() === BLOCK_LEVELS.WARNING,

    // Limit checks
    canAddUser,
    canAddChannel,
    hasCredits,

    // Trial helpers
    isTrial: isTrial(),
    trialDaysRemaining: getTrialDaysRemaining(),
    isTrialFeatureBlocked,

    // Actions
    createCheckout,
    purchaseCredits,
    openPortal,
    cancelSubscription,
    reactivateSubscription,
    resubscribeWithPaymentMethod,
    addExtraChannel,
    addExtraUser,
    refresh,

    // Granular refresh
    fetchSubscription,
    fetchUsage,
    fetchCredits,
    fetchPaymentMethods,
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
};

export default BillingContext;
