import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XCircle, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader } from 'lucide-react';
import api from '../../services/api';

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
      <div className="p-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-center">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
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
    </div>
  );
};

export default DiscardReasonsTab;
