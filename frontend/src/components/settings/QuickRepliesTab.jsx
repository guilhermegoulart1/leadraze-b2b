// frontend/src/components/settings/QuickRepliesTab.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, MessageSquare, Globe, User, Loader } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const QuickRepliesTab = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    shortcut: '',
    is_global: false
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadReplies();
  }, []);

  const loadReplies = async () => {
    try {
      setLoading(true);
      const response = await api.getQuickReplies();
      if (response.success) {
        setReplies(response.data);
      }
    } catch (error) {
      console.error('Error loading quick replies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    try {
      setSaving(true);
      let response;
      if (editingId) {
        response = await api.updateQuickReply(editingId, formData);
      } else {
        response = await api.createQuickReply(formData);
      }

      if (response.success) {
        await loadReplies();
        resetForm();
      }
    } catch (error) {
      console.error('Error saving quick reply:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (reply) => {
    setFormData({
      title: reply.title,
      content: reply.content,
      shortcut: reply.shortcut || '',
      is_global: reply.is_global
    });
    setEditingId(reply.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('quickReplies.confirmDelete'))) return;

    try {
      const response = await api.deleteQuickReply(id);
      if (response.success) {
        await loadReplies();
      }
    } catch (error) {
      console.error('Error deleting quick reply:', error);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', shortcut: '', is_global: false });
    setEditingId(null);
    setShowForm(false);
  };

  const myReplies = replies.filter(r => r.user_id === user?.id);
  const globalReplies = replies.filter(r => r.is_global && r.user_id !== user?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('quickReplies.title')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('quickReplies.description')}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('quickReplies.newReply')}
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {editingId ? t('quickReplies.edit') : t('quickReplies.newReply')}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('quickReplies.titleLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t('quickReplies.titlePlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('quickReplies.contentLabel')}
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={t('quickReplies.contentPlaceholder')}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('quickReplies.shortcutLabel')}
                  </label>
                  <input
                    type="text"
                    value={formData.shortcut}
                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                    placeholder={t('quickReplies.shortcutPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="is_global"
                      checked={formData.is_global}
                      onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                      className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <label htmlFor="is_global" className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">{t('quickReplies.globalLabel')}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        - {t('quickReplies.globalDescription')}
                      </span>
                    </label>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {t('quickReplies.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader className="w-4 h-4 animate-spin" />}
                    {t('quickReplies.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {replies.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            {t('quickReplies.noReplies')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('quickReplies.createFirst')}
          </p>
        </div>
      )}

      {/* My Replies */}
      {myReplies.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            {t('quickReplies.myReplies')}
          </h3>
          <div className="space-y-3">
            {myReplies.map(reply => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                t={t}
                canEdit={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Global Replies */}
      {globalReplies.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('quickReplies.globalReplies')}
          </h3>
          <div className="space-y-3">
            {globalReplies.map(reply => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                t={t}
                canEdit={isAdmin}
                showCreator={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ReplyCard = ({ reply, onEdit, onDelete, t, canEdit, showCreator }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">{reply.title}</h4>
          {reply.is_global && (
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
              Global
            </span>
          )}
          {reply.shortcut && (
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full font-mono">
              /{reply.shortcut}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
          {reply.content}
        </p>
        {showCreator && reply.user_name && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {t('quickReplies.createdBy')}: {reply.user_name}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => onEdit(reply)}
            className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(reply.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  </div>
);

export default QuickRepliesTab;
