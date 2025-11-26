import React, { useState, useEffect } from 'react';
import { useBilling } from '../contexts/BillingContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const BillingPage = () => {
  const { t } = useTranslation('billing');
  const {
    subscription,
    usage,
    credits,
    plans,
    loading,
    openPortal,
    cancelSubscription,
    reactivateSubscription,
    addExtraChannel,
    addExtraUser,
    purchaseCredits,
    refresh
  } = useBilling();
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await api.getInvoices();
        if (response.success) {
          setInvoices(response.data || []);
        }
      } catch (err) {
        console.error('Error fetching invoices:', err);
      }
    };
    fetchInvoices();
  }, []);

  const handleAction = async (action, actionName) => {
    setActionLoading(actionName);
    try {
      await action();
    } catch (err) {
      console.error(`Error with ${actionName}:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const currentPlan = Array.isArray(plans) ? plans.find(p => p.id === subscription?.planId) : null;

  const getStatusBadge = (status) => {
    const badges = {
      active: { bg: 'bg-green-100', text: 'text-green-700' },
      trialing: { bg: 'bg-blue-100', text: 'text-blue-700' },
      past_due: { bg: 'bg-amber-100', text: 'text-amber-700' },
      canceled: { bg: 'bg-red-100', text: 'text-red-700' },
      unpaid: { bg: 'bg-red-100', text: 'text-red-700' },
      trial_expired: { bg: 'bg-gray-100', text: 'text-gray-700' }
    };
    const badge = badges[status] || badges.active;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {t(`status.${status}`)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-1">{t('subtitle')}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Current Plan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('currentPlan.title')}</h2>
              <p className="text-gray-500 text-sm">{t('currentPlan.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              {subscription && getStatusBadge(subscription.status)}
              <button
                onClick={() => handleAction(openPortal, 'portal')}
                disabled={actionLoading === 'portal'}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                {actionLoading === 'portal' ? '...' : t('currentPlan.manageInStripe')}
              </button>
            </div>
          </div>

          {subscription ? (
            <div className="grid md:grid-cols-3 gap-6">
              {/* Plan info */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-sm text-gray-500 mb-1">{t('currentPlan.plan')}</p>
                <p className="text-xl font-bold text-gray-900">{currentPlan?.name || 'Base'}</p>
                {subscription.status === 'trialing' && subscription.daysUntilEnd && (
                  <p className="text-sm text-blue-600 mt-2">
                    {t('currentPlan.trialEnds', { days: subscription.daysUntilEnd })}
                  </p>
                )}
                {subscription.status === 'canceled' && subscription.daysUntilEnd && (
                  <p className="text-sm text-red-600 mt-2">
                    {t('currentPlan.accessUntil', { date: new Date(subscription.currentPeriodEnd).toLocaleDateString() })}
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-sm text-gray-500 mb-1">{t('currentPlan.monthlyPrice')}</p>
                <p className="text-xl font-bold text-gray-900">
                  R$ {currentPlan?.price || 297}
                  <span className="text-sm font-normal text-gray-500">/{t('currentPlan.month')}</span>
                </p>
                {subscription.extraChannels > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    {t('currentPlan.extraChannels', { amount: subscription.extraChannels * 147, count: subscription.extraChannels })}
                  </p>
                )}
                {subscription.extraUsers > 0 && (
                  <p className="text-sm text-gray-600">
                    {t('currentPlan.extraUsers', { amount: subscription.extraUsers * 27, count: subscription.extraUsers })}
                  </p>
                )}
              </div>

              {/* Next billing */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-sm text-gray-500 mb-1">{t('currentPlan.nextBillingDate')}</p>
                <p className="text-xl font-bold text-gray-900">
                  {subscription.currentPeriodEnd
                    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">{t('currentPlan.noSubscription')}</p>
              <button
                onClick={() => navigate('/pricing')}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                {t('currentPlan.viewPlans')}
              </button>
            </div>
          )}

          {/* Actions */}
          {subscription && (
            <div className="flex items-center gap-4 mt-6 pt-6 border-t">
              <button
                onClick={() => navigate('/pricing')}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                {t('currentPlan.changePlan')}
              </button>
              {subscription.status !== 'canceled' ? (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="text-red-600 hover:text-red-700 font-medium text-sm"
                >
                  {t('currentPlan.cancelSubscription')}
                </button>
              ) : (
                <button
                  onClick={() => handleAction(reactivateSubscription, 'reactivate')}
                  disabled={actionLoading === 'reactivate'}
                  className="text-green-600 hover:text-green-700 font-medium text-sm"
                >
                  {actionLoading === 'reactivate' ? '...' : t('currentPlan.reactivateSubscription')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Usage Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('usage.title')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Channels */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{t('usage.linkedinChannels')}</p>
                <p className="text-sm text-gray-500">
                  {usage?.channels?.used || 0} / {usage?.channels?.limit || 0}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      ((usage?.channels?.used || 0) / (usage?.channels?.limit || 1)) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
              {usage?.channels?.used >= usage?.channels?.limit && (
                <button
                  onClick={() => handleAction(addExtraChannel, 'addChannel')}
                  disabled={actionLoading === 'addChannel'}
                  className="text-blue-600 text-sm mt-2 hover:underline"
                >
                  {actionLoading === 'addChannel' ? t('usage.adding') : t('usage.addChannel')}
                </button>
              )}
            </div>

            {/* Users */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{t('usage.teamMembers')}</p>
                <p className="text-sm text-gray-500">
                  {usage?.users?.used || 0} / {usage?.users?.limit || 0}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      ((usage?.users?.used || 0) / (usage?.users?.limit || 1)) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
              {usage?.users?.used >= usage?.users?.limit && (
                <button
                  onClick={() => handleAction(addExtraUser, 'addUser')}
                  disabled={actionLoading === 'addUser'}
                  className="text-purple-600 text-sm mt-2 hover:underline"
                >
                  {actionLoading === 'addUser' ? t('usage.adding') : t('usage.addUser')}
                </button>
              )}
            </div>

            {/* AI Agents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{t('usage.aiAgents')}</p>
                <p className="text-sm text-gray-500">
                  {usage?.aiAgents?.used || 0} / {usage?.aiAgents?.limit || t('usage.unlimited')}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{
                    width: usage?.aiAgents?.limit
                      ? `${Math.min(
                          ((usage?.aiAgents?.used || 0) / usage.aiAgents.limit) * 100,
                          100
                        )}%`
                      : '30%'
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Google Maps Credits */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('credits.title')}</h2>
              <p className="text-gray-500 text-sm">{t('credits.subtitle')}</p>
            </div>
            <button
              onClick={() => setShowCreditsModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
            >
              {t('credits.buyMore')}
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Available Credits */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-green-700">{t('credits.available')}</p>
                  <p className="text-3xl font-bold text-green-800">
                    {credits?.available?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Credit breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('credits.monthlyCredits')}</span>
                <span className="font-medium text-gray-900">
                  {credits?.expiring?.toLocaleString() || credits?.monthly?.toLocaleString() || 0} {t('purchaseModal.credits')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('credits.purchasedCredits')}</span>
                <span className="font-medium text-green-600">
                  {credits?.permanent?.toLocaleString() || credits?.purchased?.toLocaleString() || 0} {t('purchaseModal.credits')}
                  <span className="text-xs text-green-500 ml-1">{t('credits.neverExpire')}</span>
                </span>
              </div>
              {credits?.nextExpiry && (
                <div className="flex items-center justify-between text-amber-600">
                  <span>{t('credits.monthlyExpire')}</span>
                  <span className="font-medium">
                    {t('credits.expireOn', { amount: credits.expiringAmount || credits.expiring, date: new Date(credits.nextExpiry).toLocaleDateString() })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('invoices.title')}</h2>
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">{t('invoices.date')}</th>
                    <th className="pb-3 font-medium">{t('invoices.description')}</th>
                    <th className="pb-3 font-medium">{t('invoices.amount')}</th>
                    <th className="pb-3 font-medium">{t('invoices.status')}</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="text-sm">
                      <td className="py-4 text-gray-900">
                        {new Date(invoice.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-gray-600">{invoice.description || t('invoices.subscription')}</td>
                      <td className="py-4 font-medium text-gray-900">
                        R$ {(invoice.amount / 100).toFixed(2)}
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : invoice.status === 'open'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t(`invoices.${invoice.status}`)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {invoice.invoice_url && (
                          <a
                            href={invoice.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {t('invoices.view')}
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('invoices.noInvoices')}</p>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('cancelModal.title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('cancelModal.message')}
            </p>
            <ul className="text-gray-600 text-sm space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('cancelModal.item1')}
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('cancelModal.item2')}
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {t('cancelModal.item3')}
              </li>
            </ul>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> {t('cancelModal.note')}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                {t('cancelModal.keepSubscription')}
              </button>
              <button
                onClick={async () => {
                  await handleAction(cancelSubscription, 'cancel');
                  setShowCancelModal(false);
                }}
                disabled={actionLoading === 'cancel'}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? t('cancelModal.canceling') : t('cancelModal.yesCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">{t('purchaseModal.title')}</h3>
            <p className="text-gray-600 mb-2">
              {t('purchaseModal.subtitle')}
            </p>
            <p className="text-green-600 text-sm font-medium mb-6">
              {t('purchaseModal.neverExpireNote')}
            </p>

            <div className="space-y-3 mb-6">
              {[
                { id: 'credits-500', amount: 500, price: 47 },
                { id: 'credits-1000', amount: 1000, price: 87 },
                { id: 'credits-2500', amount: 2500, price: 197 },
                { id: 'credits-5000', amount: 5000, price: 297 }
              ].map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => {
                    handleAction(() => purchaseCredits(pkg.id), 'purchase');
                    setShowCreditsModal(false);
                  }}
                  disabled={actionLoading === 'purchase'}
                  className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{pkg.amount.toLocaleString()} {t('purchaseModal.credits')}</p>
                    <p className="text-sm text-gray-500">{t('purchaseModal.perThousand', { price: Math.round(pkg.price / pkg.amount * 1000) })}</p>
                  </div>
                  <p className="text-xl font-bold text-gray-900">R$ {pkg.price}</p>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowCreditsModal(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
            >
              {t('purchaseModal.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
