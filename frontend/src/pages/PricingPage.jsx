import React, { useState } from 'react';
import { useBilling } from '../contexts/BillingContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CURRENCIES = [
  { code: 'usd', symbol: '$', name: 'USD' },
  { code: 'eur', symbol: '€', name: 'EUR' },
  { code: 'brl', symbol: 'R$', name: 'BRL' }
];

const PricingPage = () => {
  const { plans, subscription, createCheckout, loading } = useBilling();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [selectedCurrency, setSelectedCurrency] = useState('usd');
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  const handleSelectPlan = async (planId) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/pricing');
      return;
    }

    setCheckoutLoading(planId);
    try {
      await createCheckout(planId, selectedCurrency);
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formatPrice = (price, currency) => {
    const curr = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    return `${curr.symbol}${price}`;
  };

  const currentPlanId = subscription?.planId;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
          <p className="text-gray-600 mt-2">Scale your lead generation with the right plan for your business</p>
        </div>
      </div>

      {/* Currency & Billing Toggle */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
          {/* Currency selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Currency:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {CURRENCIES.map(curr => (
                <button
                  key={curr.code}
                  onClick={() => setSelectedCurrency(curr.code)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    selectedCurrency === curr.code
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {curr.name}
                </button>
              ))}
            </div>
          </div>

          {/* Billing period toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm ${billingPeriod === 'monthly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                billingPeriod === 'yearly' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  billingPeriod === 'yearly' ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${billingPeriod === 'yearly' ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Yearly
              <span className="ml-1 text-green-600 font-medium">(Save 20%)</span>
            </span>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = index === 1; // Middle plan is popular
            const isCurrent = currentPlanId === plan.id;
            const price = billingPeriod === 'yearly'
              ? Math.round(plan.price * 10) // 12 months - 2 months free
              : plan.price;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg border-2 transition-transform hover:scale-105 ${
                  isPopular ? 'border-blue-500' : 'border-gray-100'
                } ${isCurrent ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan name */}
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-gray-500 mt-1 text-sm">{plan.description || 'Perfect for getting started'}</p>

                  {/* Price */}
                  <div className="mt-6 mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900">
                        {formatPrice(price, selectedCurrency)}
                      </span>
                      <span className="text-gray-500">
                        /{billingPeriod === 'yearly' ? 'year' : 'month'}
                      </span>
                    </div>
                    {billingPeriod === 'yearly' && (
                      <p className="text-sm text-green-600 mt-1">
                        {formatPrice(Math.round(price / 12), selectedCurrency)}/month billed annually
                      </p>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent || checkoutLoading === plan.id}
                    className={`w-full py-3 px-6 rounded-xl font-semibold transition-colors ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : isPopular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {checkoutLoading === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </span>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : subscription ? (
                      'Switch Plan'
                    ) : (
                      'Get Started'
                    )}
                  </button>

                  {/* Features */}
                  <div className="mt-8 space-y-4">
                    <div className="border-t pt-6">
                      <h4 className="font-semibold text-gray-900 mb-4">What's included:</h4>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-600">
                            <strong className="text-gray-900">{plan.limits?.channels || 1}</strong> LinkedIn channels
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-600">
                            <strong className="text-gray-900">{plan.limits?.users || 1}</strong> team members
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-600">
                            <strong className="text-gray-900">{plan.limits?.monthlyCredits?.toLocaleString() || 500}</strong> Google Maps credits/month
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-600">AI-powered lead generation</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-600">Campaign automation</span>
                        </li>
                        {plan.limits?.aiAgents && (
                          <li className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-gray-600">
                              <strong className="text-gray-900">{plan.limits.aiAgents}</strong> AI agents
                            </span>
                          </li>
                        )}
                        {index > 0 && (
                          <li className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-gray-600">Priority support</span>
                          </li>
                        )}
                        {index === 2 && (
                          <>
                            <li className="flex items-start gap-3">
                              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-gray-600">Custom integrations</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-gray-600">Dedicated account manager</span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add-ons section */}
        <div className="mt-20 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Need More?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Extra Channel */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Extra LinkedIn Channel</h3>
              <p className="text-gray-500 text-sm mb-4">Add more LinkedIn accounts to scale your outreach</p>
              <p className="text-2xl font-bold text-gray-900">$30<span className="text-sm font-normal text-gray-500">/month</span></p>
            </div>

            {/* Extra User */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Extra Team Member</h3>
              <p className="text-gray-500 text-sm mb-4">Invite additional team members to collaborate</p>
              <p className="text-2xl font-bold text-gray-900">$5<span className="text-sm font-normal text-gray-500">/month</span></p>
            </div>

            {/* Extra Credits */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Google Maps Credits</h3>
              <p className="text-gray-500 text-sm mb-4">Purchase additional credits (valid for 30 days)</p>
              <p className="text-2xl font-bold text-gray-900">$50<span className="text-sm font-normal text-gray-500">/1,000 credits</span></p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto pb-20">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I change plans later?',
                a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate your billing.'
              },
              {
                q: 'What happens to my data if I cancel?',
                a: 'Your data is retained for 30 days after cancellation. During this time, you can reactivate your subscription to recover everything.'
              },
              {
                q: 'Do Google Maps credits expire?',
                a: 'Monthly credits included in your plan renew each billing cycle. Purchased credit packs expire 30 days after purchase.'
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! All new accounts get a 14-day free trial with access to all Professional plan features.'
              }
            ].map((faq, i) => (
              <details key={i} className="bg-white rounded-xl border border-gray-200 p-6 group">
                <summary className="font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  {faq.q}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-gray-600 mt-4">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
