import React, { useState, useRef } from 'react';
import { X, Lock, Check, Loader2, Edit3 } from 'lucide-react';
import { useBilling } from '../contexts/BillingContext';

// Prices in cents (USD) - Must match backend/src/config/stripe.js
const PRICES = {
  basePlan: 4500, // $45 (includes 1 channel, 2 users, 200 gmaps credits, 5000 AI credits)
  extraChannel: 2700, // $27/month per extra channel
  extraUser: 300, // $3/month per extra user
};

const formatPrice = (cents) => {
  return (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Subscribe Modal Component
 * Allows trial users to configure and subscribe to a plan
 * Design matches the www PricingCalculator
 */
const SubscribeModal = ({ isOpen, onClose }) => {
  const { createCheckout, trialDaysRemaining } = useBilling();
  const [channels, setChannels] = useState(1);
  const [users, setUsers] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingChannels, setEditingChannels] = useState(false);
  const [editingUsers, setEditingUsers] = useState(false);
  const channelsInputRef = useRef(null);
  const usersInputRef = useRef(null);

  if (!isOpen) return null;

  // Calculate price
  const extraChannels = Math.max(0, channels - 1);
  const extraUsers = Math.max(0, users - 2);
  const monthlyTotal = PRICES.basePlan + (extraChannels * PRICES.extraChannel) + (extraUsers * PRICES.extraUser);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      await createCheckout('base', 'usd', { extraChannels, extraUsers });
    } catch (err) {
      console.error('Checkout error:', err);
      setError('Algo deu errado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const days = trialDaysRemaining || 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full relative overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="flex flex-col lg:flex-row">
          {/* Left Side - Configuration */}
          <div className="flex-1 p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure seu plano</h2>
            <p className="text-gray-600 text-sm mb-6">
              Ajuste canais e usuários conforme sua necessidade
            </p>

            {/* Channels Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Canais</span>
                <div className="flex items-center gap-2">
                  {editingChannels ? (
                    <input
                      ref={channelsInputRef}
                      type="number"
                      min="1"
                      max="100"
                      value={channels}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setChannels(Math.max(1, Math.min(100, val)));
                      }}
                      onBlur={() => setEditingChannels(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingChannels(false)}
                      className="w-16 text-sm font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full text-center border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingChannels(true);
                        setTimeout(() => channelsInputRef.current?.select(), 0);
                      }}
                      className="flex items-center gap-1 text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full hover:bg-purple-100 transition-colors"
                    >
                      {channels}
                      <Edit3 className="w-3 h-3 opacity-50" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                value={Math.min(channels, 20)}
                onChange={(e) => setChannels(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((Math.min(channels, 20) - 1) / 19) * 100}%, #ede9fe ${((Math.min(channels, 20) - 1) / 19) * 100}%, #ede9fe 100%)`
                }}
              />
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>1</span>
                <span>20+</span>
              </div>
            </div>

            {/* Users Slider */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Membros do time</span>
                <div className="flex items-center gap-2">
                  {editingUsers ? (
                    <input
                      ref={usersInputRef}
                      type="number"
                      min="2"
                      max="100"
                      value={users}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 2;
                        setUsers(Math.max(2, Math.min(100, val)));
                      }}
                      onBlur={() => setEditingUsers(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setEditingUsers(false)}
                      className="w-16 text-sm font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full text-center border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditingUsers(true);
                        setTimeout(() => usersInputRef.current?.select(), 0);
                      }}
                      className="flex items-center gap-1 text-sm font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full hover:bg-purple-100 transition-colors"
                    >
                      {users}
                      <Edit3 className="w-3 h-3 opacity-50" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="2"
                max="50"
                value={Math.min(users, 50)}
                onChange={(e) => setUsers(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${((Math.min(users, 50) - 2) / 48) * 100}%, #ede9fe ${((Math.min(users, 50) - 2) / 48) * 100}%, #ede9fe 100%)`
                }}
              />
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>2</span>
                <span>50+</span>
              </div>
            </div>

            {/* What's Included */}
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-3">{channels} canal(is) + {users} membros incluídos.</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Agentes IA ilimitados</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>5.000 interações IA/mês</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>200 créditos Maps/mês</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Captura de leads</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Campanhas de ativação</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>API Keys</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Summary & CTA */}
          <div className="w-full lg:w-80 p-6 lg:p-8 bg-gray-50">
            {/* Trial Info */}
            {days > 0 && (
              <div className="bg-purple-100 border border-purple-200 rounded-lg p-3 mb-5 text-center">
                <p className="text-sm text-purple-700">
                  Você ainda tem <span className="font-bold">{days} {days === 1 ? 'dia' : 'dias'}</span> de trial
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  Assine agora para garantir acesso completo
                </p>
              </div>
            )}

            {/* Your Plan Summary */}
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Seu plano</h3>

            {/* Plan Details */}
            <div className="space-y-2 text-sm mb-4">
              {/* Base Plan */}
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Plano Base</span>
                <span className="text-gray-900 font-medium">${formatPrice(PRICES.basePlan)}/mês</span>
              </div>

              {/* Channels */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{channels} canal(is)</span>
                <span className="text-gray-400 text-xs">incluído</span>
              </div>

              {/* Users */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">{users} membros</span>
                <span className="text-gray-400 text-xs">incluído</span>
              </div>

              {/* AI Credits */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">5.000 interações IA/mês</span>
                <span className="text-gray-400 text-xs">incluído</span>
              </div>

              {/* GMaps Credits */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">200 créditos Maps/mês</span>
                <span className="text-gray-400 text-xs">incluído</span>
              </div>

              {/* Extra Channels */}
              {extraChannels > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-gray-700">+{extraChannels} {extraChannels === 1 ? 'canal extra' : 'canais extras'}</span>
                  <span className="text-gray-900 font-medium">${formatPrice(extraChannels * PRICES.extraChannel)}</span>
                </div>
              )}

              {/* Extra Users */}
              {extraUsers > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">+{extraUsers} {extraUsers === 1 ? 'usuário extra' : 'usuários extras'}</span>
                  <span className="text-gray-900 font-medium">${formatPrice(extraUsers * PRICES.extraUser)}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="border-t border-gray-200 pt-4 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total mensal</span>
                <span className="text-2xl font-bold text-gray-900">${formatPrice(monthlyTotal)}/mês</span>
              </div>
              <p className="text-xs text-gray-400 text-right mt-1">
                Cobrado mensalmente após o trial
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 text-red-600 rounded-lg px-3 py-2 text-xs mb-4">
                {error}
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3.5 px-4 rounded-xl font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Assinar Agora'
              )}
            </button>

            {/* Trust badges */}
            <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-gray-400">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Checkout seguro
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-3 h-3" />
                Cancele quando quiser
              </span>
            </div>

            {/* Continue Trial */}
            <button
              onClick={onClose}
              className="w-full text-gray-500 py-2.5 mt-3 hover:text-gray-700 text-sm font-medium transition-colors"
            >
              Continuar no Trial
            </button>
          </div>
        </div>

        {/* Slider styles */}
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #7c3aed;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          input[type="range"]::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 3px 6px rgba(124, 58, 237, 0.4);
          }
          input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #7c3aed;
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
          }
        `}</style>
      </div>
    </div>
  );
};

export default SubscribeModal;
