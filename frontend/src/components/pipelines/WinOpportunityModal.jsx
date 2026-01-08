import React, { useState, useEffect } from 'react';
import {
  X, Package, Plus, Trash2, Loader, DollarSign, FileText,
  ChevronDown, Check, AlertCircle, Trophy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../../services/api';

// Confetti celebration effect
const triggerConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ['#22C55E', '#16A34A', '#15803D', '#86EFAC', '#4ADE80'];

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

  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: colors
    });
  }, 250);
};

const WinOpportunityModal = ({ isOpen, onClose, opportunity, targetStageId, onSuccess }) => {
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
  const [showNewProduct, setShowNewProduct] = useState(null);
  const [newProductName, setNewProductName] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      // Pre-fill with opportunity value if exists
      const initialProducts = opportunity?.value > 0
        ? [{ product_id: '', quantity: 1, unit_price: String(opportunity.value), payment_conditions: '', notes: '' }]
        : [{ product_id: '', quantity: 1, unit_price: '', payment_conditions: '', notes: '' }];
      setDealProducts(initialProducts);
      setClosureNotes('');
      setError('');
    }
  }, [isOpen, opportunity]);

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
    const totalValue = calculateTotalDealValue();

    if (totalValue <= 0) {
      setError('Informe pelo menos um valor para o negócio');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Move opportunity to win stage with value
      const response = await api.moveOpportunity(opportunity.id, {
        stage_id: targetStageId,
        value: totalValue,
        notes: closureNotes || 'Negócio fechado'
      });

      if (response.success) {
        triggerConfetti();
        onSuccess?.(response.data.opportunity);
        onClose();
      }
    } catch (err) {
      console.error('Error completing deal:', err);
      setError(err.message || 'Erro ao finalizar negócio');
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
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-500 to-emerald-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Fechar Negócio
              </h2>
              <p className="text-sm text-green-100 mt-1">
                {opportunity?.contact_name || opportunity?.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
              Produtos / Serviços
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-green-600" />
              </div>
            ) : (
              <div className="space-y-3">
                {dealProducts.map((item, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-12 gap-3">
                      {/* Product Select */}
                      <div className="col-span-5">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Produto (opcional)
                        </label>
                        {showNewProduct === index ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newProductName}
                              onChange={(e) => setNewProductName(e.target.value)}
                              placeholder="Nome do novo produto"
                              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500 focus:border-green-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleCreateNewProduct(index)}
                              disabled={creatingProduct || !newProductName.trim()}
                              className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                            >
                              {creatingProduct ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => { setShowNewProduct(null); setNewProductName(''); }}
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
                              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500 focus:border-green-500 appearance-none"
                            >
                              <option value="">Selecionar produto</option>
                              {products.map(product => (
                                <option key={product.id} value={product.id}>
                                  {product.name} {product.default_price > 0 ? `(${formatCurrency(product.default_price)})` : ''}
                                </option>
                              ))}
                              <option value="new">+ Criar novo produto</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        )}
                      </div>

                      {/* Quantity */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Qtd</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Valor Unit.</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleProductChange(index, 'unit_price', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      {/* Total */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Total</label>
                        <div className="px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-400 font-medium">
                          {formatCurrency(calculateTotal(item))}
                        </div>
                      </div>

                      {/* Remove button */}
                      <div className="col-span-1 flex items-end justify-center pb-1">
                        {dealProducts.length > 1 && (
                          <button
                            onClick={() => removeProductRow(index)}
                            className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Payment conditions */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Condições de Pagamento</label>
                        <input
                          type="text"
                          value={item.payment_conditions}
                          onChange={(e) => handleProductChange(index, 'payment_conditions', e.target.value)}
                          placeholder="Ex: 30/60/90"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Observações</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleProductChange(index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addProductRow}
                  className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-green-500 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Item
                </button>
              </div>
            )}
          </div>

          {/* Closure Notes */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notas do Fechamento
            </h3>
            <textarea
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              placeholder="Detalhes sobre o fechamento do negócio..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-md focus:ring-1 focus:ring-green-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Valor Total: <span className="text-green-600">{formatCurrency(calculateTotalDealValue())}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting && <Loader className="w-4 h-4 animate-spin" />}
                <Trophy className="w-4 h-4" />
                Fechar Negócio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinOpportunityModal;
