import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Package, Plus, Trash2, Loader, DollarSign, FileText,
  ChevronDown, Check, AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../services/api';

// Confetti celebration effect
const triggerConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ['#22C55E', '#16A34A', '#15803D', '#86EFAC', '#4ADE80']; // Green colors for winning!

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());

  // Big burst in the center
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: colors
    });
  }, 250);
};

const WinDealModal = ({ isOpen, onClose, lead, onSuccess }) => {
  const { t } = useTranslation('leads');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Deal products state
  const [dealProducts, setDealProducts] = useState([
    { product_id: '', quantity: 1, unit_price: '', payment_conditions: '', notes: '' }
  ]);
  const [closureNotes, setClosureNotes] = useState('');

  // New product inline creation
  const [showNewProduct, setShowNewProduct] = useState(null); // index of the row where creating new product
  const [newProductName, setNewProductName] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      setDealProducts([{ product_id: '', quantity: 1, unit_price: '', payment_conditions: '', notes: '' }]);
      setClosureNotes('');
      setError('');
    }
  }, [isOpen]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await api.getProducts({ active_only: 'true' });
      setProducts(response.data?.products || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index, field, value) => {
    const updated = [...dealProducts];
    updated[index][field] = value;

    // If selecting a product, auto-fill the unit price
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value);
      if (selectedProduct) {
        updated[index].unit_price = selectedProduct.default_price || '';
        updated[index].payment_conditions = selectedProduct.payment_conditions || '';
      }
    }

    setDealProducts(updated);
  };

  const addProductRow = () => {
    setDealProducts([...dealProducts, { product_id: '', quantity: 1, unit_price: '', payment_conditions: '', notes: '' }]);
  };

  const removeProductRow = (index) => {
    if (dealProducts.length > 1) {
      setDealProducts(dealProducts.filter((_, i) => i !== index));
    }
  };

  const calculateTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.unit_price) || 0;
    return qty * price;
  };

  const calculateTotalDealValue = () => {
    return dealProducts.reduce((sum, item) => sum + calculateTotal(item), 0);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleCreateNewProduct = async (index) => {
    if (!newProductName.trim()) return;

    setCreatingProduct(true);
    try {
      const response = await api.createProduct({
        name: newProductName.trim(),
        default_price: 0
      });

      if (response.success) {
        const newProduct = response.data.product;
        setProducts([...products, newProduct]);

        // Select the new product in the current row
        const updated = [...dealProducts];
        updated[index].product_id = newProduct.id;
        updated[index].unit_price = newProduct.default_price || '';
        setDealProducts(updated);

        setNewProductName('');
        setShowNewProduct(null);
      }
    } catch (err) {
      console.error('Error creating product:', err);
    } finally {
      setCreatingProduct(false);
    }
  };

  const handleSubmit = async () => {
    // Validate
    const validProducts = dealProducts.filter(p => p.product_id && p.unit_price);

    if (validProducts.length === 0) {
      setError(t('winDeal.atLeastOneProduct'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.completeDeal(lead.id, {
        products: validProducts.map(p => ({
          product_id: p.product_id,
          quantity: parseInt(p.quantity) || 1,
          unit_price: parseFloat(p.unit_price),
          payment_conditions: p.payment_conditions || null,
          notes: p.notes || null
        })),
        closure_notes: closureNotes || null
      });

      if (response.success) {
        triggerConfetti();
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error('Error completing deal:', err);
      setError(err.message || t('winDeal.error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-500" />
                {t('winDeal.title')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {lead?.name} - {lead?.company_name || lead?.headline}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Products Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('winDeal.productsSection')}
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {dealProducts.map((item, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-12 gap-3">
                      {/* Product Select */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('winDeal.selectProduct')}
                        </label>
                        {showNewProduct === index ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newProductName}
                              onChange={(e) => setNewProductName(e.target.value)}
                              placeholder={t('winDeal.newProductName')}
                              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-gray-400 dark:placeholder-gray-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleCreateNewProduct(index)}
                              disabled={creatingProduct || !newProductName.trim()}
                              className="px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {creatingProduct ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setShowNewProduct(null);
                                setNewProductName('');
                              }}
                              className="px-3 py-2 text-gray-600 dark:text-gray-400 text-sm rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <select
                              value={item.product_id}
                              onChange={(e) => {
                                if (e.target.value === 'new') {
                                  setShowNewProduct(index);
                                } else {
                                  handleProductChange(index, 'product_id', e.target.value);
                                }
                              }}
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 appearance-none"
                            >
                              <option value="">{t('winDeal.selectProduct')}</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} {product.default_price > 0 ? `(${formatCurrency(product.default_price)})` : ''}
                                </option>
                              ))}
                              <option value="new">+ {t('winDeal.createNewProduct')}</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('winDeal.quantity')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('winDeal.unitPrice')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleProductChange(index, 'unit_price', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>

                      {/* Total */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('winDeal.total')}
                        </label>
                        <div className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 font-medium">
                          {formatCurrency(calculateTotal(item))}
                        </div>
                      </div>

                      {/* Remove button */}
                      <div className="col-span-1 flex items-end justify-center pb-1">
                        {dealProducts.length > 1 && (
                          <button
                            onClick={() => removeProductRow(index)}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Payment conditions and notes */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('winDeal.paymentConditions')}
                        </label>
                        <input
                          type="text"
                          value={item.payment_conditions}
                          onChange={(e) => handleProductChange(index, 'payment_conditions', e.target.value)}
                          placeholder="Ex: 30/60/90"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {t('winDeal.notes')}
                        </label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleProductChange(index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add product button */}
                <button
                  onClick={addProductRow}
                  className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('winDeal.addProduct')}
                </button>
              </div>
            )}
          </div>

          {/* Closure Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('winDeal.closureNotes')}
            </h3>
            <textarea
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              placeholder={t('winDeal.closureNotesPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('winDeal.totalDealValue')}: <span className="text-green-600">{formatCurrency(calculateTotalDealValue())}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('winDeal.cancelButton')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                {t('winDeal.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinDealModal;
