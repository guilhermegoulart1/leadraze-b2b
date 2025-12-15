import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import api from '../../services/api';

const ProductsTab = () => {
  const { t } = useTranslation('products');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_price: '',
    currency: 'BRL',
    time_unit: '',
    payment_conditions: ''
  });

  const TIME_UNITS = [
    { value: 'hour', label: t('timeUnits.hour') },
    { value: 'day', label: t('timeUnits.day') },
    { value: 'week', label: t('timeUnits.week') },
    { value: 'month', label: t('timeUnits.month') },
    { value: 'project', label: t('timeUnits.project') },
    { value: 'unit', label: t('timeUnits.unit') }
  ];

  useEffect(() => {
    fetchProducts();
  }, [showInactive]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/products${showInactive ? '' : '?active_only=true'}`);
      if (response.success) {
        setProducts(response.data?.products || []);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      const payload = {
        ...formData,
        default_price: parseFloat(formData.default_price) || 0
      };

      let response;
      if (editingProduct) {
        response = await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        response = await api.post('/products', payload);
      }

      if (response.success) {
        fetchProducts();
        resetForm();
      }
    } catch (err) {
      console.error('Error saving product:', err);
      alert(err.message || t('messages.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      default_price: product.default_price || '',
      currency: product.currency || 'BRL',
      time_unit: product.time_unit || '',
      payment_conditions: product.payment_conditions || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (product) => {
    if (!confirm(t('messages.confirmDelete'))) return;

    try {
      const response = await api.delete(`/products/${product.id}`);
      if (response.success) {
        fetchProducts();
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      alert(err.message || t('messages.error'));
    }
  };

  const handleReactivate = async (product) => {
    try {
      const response = await api.post(`/products/${product.id}/reactivate`);
      if (response.success) {
        fetchProducts();
      }
    } catch (err) {
      console.error('Error reactivating product:', err);
      alert(err.message || t('messages.error'));
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      default_price: '',
      currency: 'BRL',
      time_unit: '',
      payment_conditions: ''
    });
  };

  const formatPrice = (price, currency = 'BRL') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency
    }).format(price || 0);
  };

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('title')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>{t('filters.all')}</span>
            </label>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addProduct')}</span>
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              {editingProduct ? t('editProduct') : t('addProduct')}
            </h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('form.name')} *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('form.namePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div className="flex space-x-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('form.defaultPrice')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.default_price}
                      onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                      placeholder={t('form.defaultPricePlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('form.currency')}
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="BRL">BRL</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('form.timeUnit')}
                  </label>
                  <select
                    value={formData.time_unit}
                    onChange={(e) => setFormData({ ...formData, time_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('form.timeUnitPlaceholder')}</option>
                    {TIME_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>{unit.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('form.paymentConditions')}
                  </label>
                  <input
                    type="text"
                    value={formData.payment_conditions}
                    onChange={(e) => setFormData({ ...formData, payment_conditions: e.target.value })}
                    placeholder={t('form.paymentConditionsPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('form.description')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('form.descriptionPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-300"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t('actions.saving') : t('actions.save')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p>{t('empty.title')}</p>
            <p className="text-sm mt-1">{t('empty.description')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('table.name')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('table.price')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('table.timeUnit')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('table.status')}</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                        {product.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">{product.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-white">
                      {formatPrice(product.default_price, product.currency)}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {product.time_unit ? TIME_UNITS.find(u => u.value === product.time_unit)?.label || product.time_unit : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        product.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {product.is_active ? t('status.active') : t('status.inactive')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                          title={t('actions.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {product.is_active ? (
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            title={t('actions.delete')}
                          >
                            <ToggleRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(product)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                            title={t('actions.reactivate')}
                          >
                            <ToggleLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsTab;
