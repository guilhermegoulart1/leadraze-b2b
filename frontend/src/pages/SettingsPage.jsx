import React, { useState, useEffect } from 'react';
import { User, Lock, Bell, CreditCard, Database, Shield, Mail, Users, X, Trash2, RefreshCw, UserPlus, Package, Plus, Edit2, ToggleLeft, ToggleRight, XCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { EmailSettingsTab } from '../components/email-settings';
import api from '../services/api';

// Products Tab Component
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
  );
};

// Discard Reasons Tab Component
const DiscardReasonsTab = () => {
  const { t } = useTranslation('leads');
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReason, setEditingReason] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = async () => {
    try {
      setLoading(true);
      const response = await api.getDiscardReasons();
      if (response.success) {
        setReasons(response.data.reasons || []);
      }
    } catch (error) {
      console.error('Error loading discard reasons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      await api.seedDiscardReasons();
      await loadReasons();
    } catch (error) {
      console.error('Error seeding default reasons:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reason) => {
    setEditingReason(reason);
    setFormData({
      name: reason.name,
      description: reason.description || ''
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingReason(null);
    setFormData({ name: '', description: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSaving(true);
      if (editingReason) {
        await api.updateDiscardReason(editingReason.id, formData);
      } else {
        await api.createDiscardReason(formData);
      }
      await loadReasons();
      handleCancel();
    } catch (error) {
      console.error('Error saving discard reason:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reason) => {
    if (!window.confirm(t('discardReasons.confirmDelete'))) return;

    try {
      await api.deleteDiscardReason(reason.id);
      await loadReasons();
    } catch (error) {
      console.error('Error deleting discard reason:', error);
      alert(t('discardReasons.deleteError'));
    }
  };

  const handleToggleActive = async (reason) => {
    try {
      await api.updateDiscardReason(reason.id, {
        ...reason,
        is_active: !reason.is_active
      });
      await loadReasons();
    } catch (error) {
      console.error('Error toggling discard reason status:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <Loader className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            {t('discardReasons.title')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('discardReasons.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {reasons.length === 0 && (
            <button
              onClick={handleSeedDefaults}
              disabled={saving}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium text-sm flex items-center gap-2"
            >
              {saving && <Loader className="w-4 h-4 animate-spin" />}
              {t('discardReasons.seedDefaults')}
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('discardReasons.addReason')}
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4">
            {editingReason ? t('discardReasons.editReason') : t('discardReasons.addReason')}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('discardReasons.name')} *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('discardReasons.namePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('discardReasons.description')}
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('discardReasons.descriptionPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('discardReasons.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving || !formData.name.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {t('discardReasons.save')}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Table */}
      {reasons.length === 0 ? (
        <div className="text-center py-12">
          <XCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('discardReasons.noReasons')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('discardReasons.createFirst')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('discardReasons.name')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('discardReasons.description')}</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400"></th>
              </tr>
            </thead>
            <tbody>
              {reasons.map((reason) => (
                <tr key={reason.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900 dark:text-white">{reason.name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{reason.description || '-'}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      reason.is_active
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}>
                      {reason.is_active ? t('discardReasons.active') : t('discardReasons.inactive')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(reason)}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                        title={t('discardReasons.editReason')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(reason)}
                        className={`p-2 rounded-lg ${
                          reason.is_active
                            ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                        title={reason.is_active ? t('discardReasons.inactive') : t('discardReasons.active')}
                      >
                        {reason.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(reason)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        title={t('discardReasons.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Partner Access Tab Component
const PartnersAccessTab = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const response = await api.get('/partners/access');
      if (response.success) {
        setPartners(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPartner = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setAddLoading(true);
    setError('');

    try {
      const response = await api.post('/partners/access', { email: email.trim() });
      if (response.success) {
        setEmail('');
        fetchPartners();
      }
    } catch (err) {
      setError(err.message || 'Erro ao conceder acesso');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRevokeAccess = async (partnerId) => {
    if (!confirm('Tem certeza que deseja revogar o acesso deste partner?')) return;

    try {
      const response = await api.delete(`/partners/access/${partnerId}`);
      if (response.success) {
        fetchPartners();
      }
    } catch (err) {
      console.error('Error revoking access:', err);
      alert('Erro ao revogar acesso');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Acesso de Partners</h3>
          <p className="text-sm text-gray-500 mt-1">
            Conceda acesso a partners para gerenciar sua conta
          </p>
        </div>
        <button
          onClick={fetchPartners}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Add Partner Form */}
      <form onSubmit={handleAddPartner} className="mb-6">
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="relative">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Email do partner..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={addLoading || !email.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {addLoading ? 'Adicionando...' : 'Conceder Acesso'}
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}
      </form>

      {/* Partners List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : partners.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>Nenhum partner com acesso</p>
          <p className="text-sm mt-1">Adicione o email de um partner aprovado para conceder acesso</p>
        </div>
      ) : (
        <div className="space-y-3">
          {partners.map((partner) => (
            <div
              key={partner.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{partner.partner_name}</p>
                  <p className="text-sm text-gray-500">{partner.partner_email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-400">
                  Desde {formatDate(partner.granted_at)}
                </span>
                <button
                  onClick={() => handleRevokeAccess(partner.partner_id)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  title="Revogar acesso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Como funciona?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Partners são agências ou profissionais que ajudam a gerenciar sua conta</li>
          <li>• Ao conceder acesso, o partner poderá entrar na sua conta</li>
          <li>• Você pode revogar o acesso a qualquer momento</li>
        </ul>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: t('tabs.profile'), icon: User },
    { id: 'email', label: t('tabs.email', 'Email'), icon: Mail },
    { id: 'products', label: t('tabs.products', 'Produtos'), icon: Package },
    { id: 'discardReasons', label: t('tabs.discardReasons', 'Motivos de Descarte'), icon: XCircle },
    { id: 'security', label: t('tabs.security'), icon: Lock },
    { id: 'notifications', label: t('tabs.notifications'), icon: Bell },
    { id: 'billing', label: t('tabs.billing'), icon: CreditCard },
    { id: 'integrations', label: t('tabs.integrations'), icon: Database },
    { id: 'privacy', label: t('tabs.privacy'), icon: Shield },
    { id: 'partners', label: 'Acesso de Partners', icon: Users },
  ];

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex gap-6">
        
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${activeTab === tab.id 
                      ? 'bg-purple-50 text-purple-600' 
                      : 'text-gray-700 hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{t('profile.title')}</h3>

              <div className="space-y-6">

                {/* Avatar */}
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {user?.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold text-sm">
                      {t('profile.changePhoto')}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">{t('profile.photoRequirements')}</p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.fullName')}
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.name}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.email')}
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.phone')}
                    </label>
                    <input
                      type="tel"
                      placeholder={t('profile.phonePlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('profile.position')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('profile.positionPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('profile.company')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('profile.companyPlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">
                    {t('profile.cancel')}
                  </button>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                    {t('profile.saveChanges')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{t('security.title')}</h3>

              <div className="space-y-6">

                {/* Change Password */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-4">{t('security.changePassword')}</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('security.currentPassword')}
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('security.newPassword')}
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('security.confirmNewPassword')}
                      </label>
                      <input
                        type="password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* 2FA */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{t('security.twoFactor')}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {t('security.twoFactorDescription')}
                      </p>
                    </div>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                      {t('security.enable2FA')}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold">
                    {t('security.updatePassword')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">{t('notifications.title')}</h3>

              <div className="space-y-4">
                {[
                  { key: 'newLeads' },
                  { key: 'acceptedInvites' },
                  { key: 'qualifiedLeads' },
                  { key: 'receivedMessages' },
                  { key: 'completedCampaigns' },
                  { key: 'weeklyReports' },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{t(`notifications.items.${item.key}.title`)}</p>
                      <p className="text-sm text-gray-500">{t(`notifications.items.${item.key}.description`)}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <EmailSettingsTab />
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <ProductsTab />
          )}

          {/* Discard Reasons Tab */}
          {activeTab === 'discardReasons' && (
            <DiscardReasonsTab />
          )}

          {/* Partners Tab */}
          {activeTab === 'partners' && (
            <PartnersAccessTab />
          )}

          {/* Other tabs placeholder */}
          {['billing', 'integrations', 'privacy'].includes(activeTab) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {tabs.find(t => t.id === activeTab)?.label}
              </h3>
              <p className="text-gray-500">{t('placeholder.title')}</p>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default SettingsPage;