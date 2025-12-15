import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Loader, Sparkles, Target, Package, AlertCircle, ChevronDown
} from 'lucide-react';
import api from '../services/api';

const SecretAgentModal = ({ isOpen, onClose, conversationId, onSuccess }) => {
  const { t } = useTranslation('secretAgentCoaching');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [objective, setObjective] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [difficulties, setDifficulties] = useState('');

  // Products list
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      setObjective('');
      setSelectedProduct('');
      setDifficulties('');
      setError('');
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await api.getProducts({ is_active: true });
      setProducts(response.data?.products || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSubmit = async () => {
    if (!objective.trim()) {
      setError(t('errors.objectiveRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.generateSecretAgentCoaching(conversationId, {
        objective: objective.trim(),
        product_id: selectedProduct || null,
        difficulties: difficulties.trim() || null
      });

      if (response.success) {
        onSuccess?.(response.data);
        onClose();
      }
    } catch (err) {
      console.error('Error generating coaching:', err);
      setError(t('errors.generateFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {t('modal.title')}
                </h2>
                <p className="text-sm text-purple-200">
                  {t('modal.subtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto max-h-[60vh]">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Objective - Required */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-500" />
              {t('modal.objectiveLabel')} *
            </label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={t('modal.objectivePlaceholder')}
              rows={3}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>

          {/* Product Select - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" />
              {t('modal.productLabel')}
            </label>
            <div className="relative">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                disabled={loadingProducts}
                className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="">{t('modal.productPlaceholder')}</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.default_price ? `- R$ ${product.default_price}` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Difficulties - Optional */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-purple-500" />
              {t('modal.difficultiesLabel')}
            </label>
            <textarea
              value={difficulties}
              onChange={(e) => setDifficulties(e.target.value)}
              placeholder={t('modal.difficultiesPlaceholder')}
              rows={3}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !objective.trim()}
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  {t('modal.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('modal.generateButton')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecretAgentModal;
