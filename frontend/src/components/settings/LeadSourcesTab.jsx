import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Share2, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader, Lock } from 'lucide-react';
import api from '../../services/api';

const LeadSourcesTab = () => {
  const { t } = useTranslation('leads');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    description: '',
    color: '#6b7280',
    icon: '?'
  });

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      setLoading(true);
      const response = await api.getLeadSources();
      if (response.success) {
        setSources(response.data.sources || []);
      }
    } catch (error) {
      console.error('Error loading lead sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setSaving(true);
      await api.seedLeadSources();
      await loadSources();
    } catch (error) {
      console.error('Error seeding default sources:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (source) => {
    setEditingSource(source);
    setFormData({
      name: source.name,
      label: source.label,
      description: source.description || '',
      color: source.color || '#6b7280',
      icon: source.icon || '?'
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSource(null);
    setFormData({ name: '', label: '', description: '', color: '#6b7280', icon: '?' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.label.trim()) return;

    try {
      setSaving(true);
      if (editingSource) {
        await api.updateLeadSource(editingSource.id, formData);
      } else {
        await api.createLeadSource(formData);
      }
      await loadSources();
      handleCancel();
    } catch (error) {
      console.error('Error saving lead source:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (source) => {
    if (!window.confirm(t('leadSources.confirmDelete'))) return;

    try {
      await api.deleteLeadSource(source.id);
      await loadSources();
    } catch (error) {
      console.error('Error deleting lead source:', error);
      alert(t('leadSources.deleteError'));
    }
  };

  const handleToggleActive = async (source) => {
    try {
      await api.updateLeadSource(source.id, {
        ...source,
        is_active: !source.is_active
      });
      await loadSources();
    } catch (error) {
      console.error('Error toggling lead source status:', error);
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
              <Share2 className="w-5 h-5 text-blue-500" />
              {t('leadSources.title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('leadSources.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            {sources.length === 0 && (
              <button
                onClick={handleSeedDefaults}
                disabled={saving}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium text-sm flex items-center gap-2"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {t('leadSources.seedDefaults')}
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('leadSources.addSource')}
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-4">
              {editingSource ? t('leadSources.editSource') : t('leadSources.addSource')}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('leadSources.name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder={t('leadSources.namePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                  disabled={editingSource?.is_default}
                />
                <p className="text-xs text-gray-400 mt-1">{t('leadSources.nameHint')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('leadSources.label')} *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder={t('leadSources.labelPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('leadSources.color')}
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('leadSources.icon')}
                </label>
                <div className="flex gap-2 items-center">
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: formData.color }}
                  >
                    {formData.icon}
                  </div>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value.slice(0, 2) })}
                    placeholder={t('leadSources.iconPlaceholder')}
                    maxLength={2}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('leadSources.description')}
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('leadSources.descriptionPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('leadSources.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim() || !formData.label.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  {t('leadSources.save')}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Table */}
        {sources.length === 0 ? (
          <div className="text-center py-12">
            <Share2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t('leadSources.noSources')}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('leadSources.createFirst')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('leadSources.icon')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('leadSources.label')}</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t('leadSources.name')}</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400"></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: source.color || '#6b7280' }}
                      >
                        {source.icon || '?'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900 dark:text-white">{source.label}</span>
                      {source.is_default && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                          <Lock className="w-3 h-3 mr-0.5" />
                          {t('leadSources.isDefault')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{source.name}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        source.is_active
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      }`}>
                        {source.is_active ? t('leadSources.active') : t('leadSources.inactive')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(source)}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
                          title={t('leadSources.editSource')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(source)}
                          className={`p-2 rounded-lg ${
                            source.is_active
                              ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          }`}
                          title={source.is_active ? t('leadSources.inactive') : t('leadSources.active')}
                        >
                          {source.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        {!source.is_default && (
                          <button
                            onClick={() => handleDelete(source)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                            title={t('leadSources.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
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

export default LeadSourcesTab;
