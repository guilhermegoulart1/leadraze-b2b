// frontend/src/components/KnowledgeBaseModal.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Plus, Edit2, Trash2, Search, BookOpen, AlertCircle,
  Package, TrendingUp, FileText, Save, Lightbulb, FlaskConical,
  Settings2, Pin
} from 'lucide-react';
import api from '../services/api';

const KnowledgeBaseModal = ({ isOpen, onClose, agent, onAgentUpdate }) => {
  const { t } = useTranslation(['knowledge', 'common']);

  // Tab state
  const [activeTab, setActiveTab] = useState('knowledge');

  // Knowledge list state
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    type: 'faq',
    question: '',
    answer: '',
    content: '',
    category: '',
    tags: '',
    always_include: false
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Similarity threshold state
  const [similarityThreshold, setSimilarityThreshold] = useState(0.7);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  // Messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const knowledgeTypes = {
    faq: { icon: BookOpen, label: t('types.faq'), color: 'blue' },
    objection: { icon: AlertCircle, label: t('types.objection'), color: 'orange' },
    product_info: { icon: Package, label: t('types.product_info'), color: 'purple' },
    case_study: { icon: TrendingUp, label: t('types.case_study'), color: 'green' },
    document: { icon: FileText, label: t('types.document'), color: 'gray' }
  };

  useEffect(() => {
    if (isOpen && agent) {
      loadKnowledge();
      setActiveTab('knowledge');
      setShowForm(false);
      setSearchResults(null);
      // Load similarity threshold from agent
      setSimilarityThreshold(
        agent.knowledge_similarity_threshold !== undefined && agent.knowledge_similarity_threshold !== null
          ? parseFloat(agent.knowledge_similarity_threshold)
          : 0.7
      );
    }
  }, [isOpen, agent]);

  const loadKnowledge = async () => {
    try {
      setLoading(true);
      const response = await api.getAgentKnowledge(agent.id);
      setKnowledge(response.data?.knowledge || []);
    } catch (err) {
      console.error('Error loading knowledge:', err);
      setError(t('messages.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Validation
    if (formData.type === 'faq' || formData.type === 'objection') {
      if (!formData.question || !formData.answer) {
        setError(t('messages.requiredFields'));
        return;
      }
    } else {
      if (!formData.content) {
        setError(t('messages.requiredContent'));
        return;
      }
    }

    setIsSaving(true);
    try {
      const data = {
        type: formData.type,
        question: formData.question || null,
        answer: formData.answer || null,
        content: formData.content || null,
        category: formData.category || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
        always_include: formData.always_include || false
      };

      if (editingItem) {
        await api.updateAgentKnowledge(agent.id, editingItem.id, data);
        setSuccess(t('messages.updateSuccess'));
      } else {
        await api.addAgentKnowledge(agent.id, data);
        setSuccess(t('messages.addSuccess'));
      }

      resetForm();
      loadKnowledge();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving knowledge:', err);
      setError(err.message || t('messages.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      question: item.question || '',
      answer: item.answer || '',
      content: item.content || '',
      category: item.category || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      always_include: item.always_include || false
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('list.confirmDelete'))) return;

    try {
      await api.deleteAgentKnowledge(agent.id, id);
      setSuccess(t('messages.deleteSuccess'));
      loadKnowledge();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting knowledge:', err);
      setError(err.message || t('messages.deleteError'));
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError(t('messages.emptyQuery'));
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await api.searchAgentKnowledge(agent.id, searchQuery, {
        limit: 5,
        minSimilarity: similarityThreshold
      });
      setSearchResults(response.data?.results || []);
    } catch (err) {
      console.error('Error searching:', err);
      setError(t('messages.searchError'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveThreshold = async () => {
    setIsSavingThreshold(true);
    setError('');

    try {
      await api.updateAIAgent(agent.id, {
        knowledge_similarity_threshold: similarityThreshold
      });
      setSuccess(t('settings.thresholdSaved'));
      // Notify parent to update agent data
      if (onAgentUpdate) {
        onAgentUpdate({ ...agent, knowledge_similarity_threshold: similarityThreshold });
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving threshold:', err);
      setError(t('settings.thresholdError'));
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
      type: 'faq',
      question: '',
      answer: '',
      content: '',
      category: '',
      tags: '',
      always_include: false
    });
    setError('');
  };

  if (!isOpen) return null;

  const filteredKnowledge = activeFilter === 'all'
    ? knowledge
    : knowledge.filter(k => k.type === activeFilter);

  const getTypeIcon = (type) => {
    const config = knowledgeTypes[type];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeColor = (type) => {
    const colors = {
      faq: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      objection: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      product_info: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      case_study: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      document: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    return colors[type] || colors.document;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                {t('title')} - {agent?.name}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'knowledge'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {t('tabs.knowledge')}
              <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                {knowledge.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              {t('tabs.search')}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              {t('tabs.settings')}
            </div>
          </button>
        </div>

        {/* Messages */}
        {(error || success) && (
          <div className="px-6 pt-4 flex-shrink-0">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg text-green-700 dark:text-green-400 text-sm">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'knowledge' && (
            <div className="p-6">
              {/* Add Form */}
              {showForm ? (
                <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
                    {editingItem ? t('form.editTitle') : t('form.title')}
                  </h3>

                  <div className="space-y-4">
                    {/* Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('form.type')} *
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {Object.entries(knowledgeTypes).map(([key, config]) => {
                          const Icon = config.icon;
                          const isSelected = formData.type === key;
                          return (
                            <button
                              key={key}
                              onClick={() => setFormData({ ...formData, type: key })}
                              className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                              }`}
                            >
                              <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* FAQ/Objection Fields */}
                    {(formData.type === 'faq' || formData.type === 'objection') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {formData.type === 'faq' ? t('form.question') : t('form.objection')} *
                          </label>
                          <input
                            type="text"
                            value={formData.question}
                            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                            placeholder={formData.type === 'faq' ? t('form.placeholders.question') : t('form.placeholders.objection')}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {formData.type === 'faq' ? t('form.answer') : t('form.howToRespond')} *
                          </label>
                          <textarea
                            value={formData.answer}
                            onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                            placeholder={formData.type === 'faq' ? t('form.placeholders.answerFaq') : t('form.placeholders.answerObjection')}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </>
                    )}

                    {/* Other Types Content */}
                    {formData.type !== 'faq' && formData.type !== 'objection' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('form.content')} *
                        </label>
                        <textarea
                          value={formData.content}
                          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                          placeholder={t('form.placeholders.content')}
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    )}

                    {/* Category & Tags */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('form.category')}
                        </label>
                        <input
                          type="text"
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          placeholder={t('form.placeholders.category')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('form.tags')}
                        </label>
                        <input
                          type="text"
                          value={formData.tags}
                          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                          placeholder={t('form.tagsPlaceholder')}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </div>

                    {/* Always Include Toggle */}
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.always_include}
                          onChange={(e) => setFormData({ ...formData, always_include: e.target.checked })}
                          className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {t('form.alwaysInclude', 'Sempre incluir no contexto')}
                          </span>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {t('form.alwaysIncludeDescription', 'Este conhecimento será incluído em todas as conversas do agente, independente da pergunta do lead. Use para informações essenciais sobre seu produto/serviço.')}
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            {t('form.saving', 'Salvando...')}
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            {editingItem ? t('form.saveChanges') : t('form.add')}
                          </>
                        )}
                      </button>
                      <button
                        onClick={resetForm}
                        disabled={isSaving}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t('form.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Action Bar */
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('addButton')}
                  </button>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t('total', { count: knowledge.length })}
                  </div>
                </div>
              )}

              {/* Filter Tabs */}
              {!showForm && (
                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeFilter === 'all'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {t('list.all')} ({knowledge.length})
                  </button>
                  {Object.entries(knowledgeTypes).map(([key, config]) => {
                    const count = knowledge.filter(k => k.type === key).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveFilter(key)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                          activeFilter === key
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {config.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Knowledge Table */}
              {!showForm && (
                loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredKnowledge.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">
                      {activeFilter === 'all'
                        ? t('list.empty')
                        : t('list.emptyFiltered', { type: knowledgeTypes[activeFilter]?.label })}
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            {t('form.type')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t('form.content')}
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                            {t('form.category')}
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                            {t('common:actions', 'Ações')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredKnowledge.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                                  {getTypeIcon(item.type)}
                                  {knowledgeTypes[item.type]?.label || item.type}
                                </span>
                                {item.always_include && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    <Pin className="w-3 h-3" />
                                    {t('list.essential', 'Essencial')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="max-w-md">
                                {item.question && (
                                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                    {item.question}
                                  </p>
                                )}
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {item.answer || item.content}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {item.category && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {item.category}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Deletar"
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
                )
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="p-6">
              {/* Search Info */}
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      {t('search.title')}
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {t('search.description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Search Input */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t('search.placeholder')}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {isSearching ? t('search.searching') : t('search.button')}
                </button>
              </div>

              {/* Search Results */}
              {searchResults !== null && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {searchResults.length > 0
                      ? t('search.results', { count: searchResults.length })
                      : t('search.noResults')
                    }
                  </h4>

                  {searchResults.length > 0 && (
                    <div className="space-y-3">
                      {searchResults.map((result, index) => (
                        <div
                          key={index}
                          className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(result.type)}`}>
                              {getTypeIcon(result.type)}
                              {knowledgeTypes[result.type]?.label || result.type}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              {t('search.similarity')}: {(result.similarity * 100).toFixed(1)}%
                            </span>
                          </div>
                          {result.question && (
                            <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                              {result.question}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {result.answer || result.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tip */}
                  <div className="mt-6 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <strong>Dica:</strong> {t('search.tip')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              {/* Settings Info */}
              <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <Settings2 className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-1">
                      {t('settings.title')}
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      {t('settings.description')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Similarity Threshold Slider */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {t('settings.sensitivityLabel')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('settings.sensitivityDescription')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(similarityThreshold * 100)}%
                    </span>
                  </div>
                </div>

                {/* Slider */}
                <div className="mb-4">
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={similarityThreshold * 100}
                    onChange={(e) => setSimilarityThreshold(parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>{t('settings.moreResults')}</span>
                    <span>{t('settings.morePrecise')}</span>
                  </div>
                </div>

                {/* Level Indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('settings.level')}:
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    similarityThreshold <= 0.6
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : similarityThreshold <= 0.75
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : similarityThreshold <= 0.85
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {similarityThreshold <= 0.6
                      ? t('settings.levels.low')
                      : similarityThreshold <= 0.75
                        ? t('settings.levels.medium')
                        : similarityThreshold <= 0.85
                          ? t('settings.levels.high')
                          : t('settings.levels.veryHigh')
                    }
                  </span>
                </div>

                {/* Explanation */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {similarityThreshold <= 0.6 && t('settings.explanations.low')}
                    {similarityThreshold > 0.6 && similarityThreshold <= 0.75 && t('settings.explanations.medium')}
                    {similarityThreshold > 0.75 && similarityThreshold <= 0.85 && t('settings.explanations.high')}
                    {similarityThreshold > 0.85 && t('settings.explanations.veryHigh')}
                  </p>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveThreshold}
                  disabled={isSavingThreshold}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingThreshold ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('settings.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {t('settings.save')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;
