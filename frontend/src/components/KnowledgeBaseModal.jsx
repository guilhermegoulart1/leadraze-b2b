// frontend/src/components/KnowledgeBaseModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Edit, Trash2, Search, BookOpen, AlertCircle, Package, TrendingUp, FileText, Save, XCircle } from 'lucide-react';
import api from '../services/api';

const KnowledgeBaseModal = ({ isOpen, onClose, agent }) => {
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [formData, setFormData] = useState({
    type: 'faq',
    question: '',
    answer: '',
    content: '',
    category: '',
    tags: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && agent) {
      loadKnowledge();
    }
  }, [isOpen, agent]);

  const loadKnowledge = async () => {
    try {
      setLoading(true);
      const response = await api.getAgentKnowledge(agent.id);
      setKnowledge(response.data?.knowledge || []);
    } catch (err) {
      console.error('Erro ao carregar conhecimento:', err);
      setError('Erro ao carregar base de conhecimento');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKnowledge = async () => {
    setError('');
    setSuccess('');

    // Validação
    if (formData.type === 'faq' || formData.type === 'objection') {
      if (!formData.question || !formData.answer) {
        setError('Pergunta e resposta são obrigatórias');
        return;
      }
    } else {
      if (!formData.content) {
        setError('Conteúdo é obrigatório');
        return;
      }
    }

    try {
      const data = {
        type: formData.type,
        question: formData.question || null,
        answer: formData.answer || null,
        content: formData.content || null,
        category: formData.category || null,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : []
      };

      if (editingItem) {
        await api.updateAgentKnowledge(agent.id, editingItem.id, data);
        setSuccess('Conhecimento atualizado com sucesso!');
      } else {
        await api.addAgentKnowledge(agent.id, data);
        setSuccess('Conhecimento adicionado com sucesso!');
      }

      // Reset form
      setFormData({
        type: 'faq',
        question: '',
        answer: '',
        content: '',
        category: '',
        tags: ''
      });
      setShowAddForm(false);
      setEditingItem(null);
      loadKnowledge();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao salvar conhecimento:', err);
      setError(err.message || 'Erro ao salvar conhecimento');
    }
  };

  const handleEditKnowledge = (item) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      question: item.question || '',
      answer: item.answer || '',
      content: item.content || '',
      category: item.category || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : ''
    });
    setShowAddForm(true);
  };

  const handleDeleteKnowledge = async (id) => {
    if (!window.confirm('Tem certeza que deseja deletar este conhecimento?')) {
      return;
    }

    try {
      await api.deleteAgentKnowledge(agent.id, id);
      setSuccess('Conhecimento removido com sucesso!');
      loadKnowledge();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao deletar conhecimento:', err);
      setError(err.message || 'Erro ao deletar conhecimento');
    }
  };

  const handleTestSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Digite uma query para testar a busca');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await api.searchAgentKnowledge(agent.id, searchQuery, {
        limit: 5,
        minSimilarity: 0.7
      });
      setSearchResults(response.data?.results || []);
    } catch (err) {
      console.error('Erro ao buscar:', err);
      setError('Erro ao testar busca semântica');
    } finally {
      setIsSearching(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingItem(null);
    setFormData({
      type: 'faq',
      question: '',
      answer: '',
      content: '',
      category: '',
      tags: ''
    });
    setError('');
  };

  if (!isOpen) return null;

  const knowledgeTypes = {
    faq: { icon: BookOpen, label: 'FAQs', color: 'blue' },
    objection: { icon: AlertCircle, label: 'Objeções', color: 'orange' },
    product_info: { icon: Package, label: 'Info Produtos', color: 'purple' },
    case_study: { icon: TrendingUp, label: 'Casos de Sucesso', color: 'green' },
    document: { icon: FileText, label: 'Documentos', color: 'gray' }
  };

  const filteredKnowledge = activeFilter === 'all'
    ? knowledge
    : knowledge.filter(k => k.type === activeFilter);

  const knowledgeByType = {};
  filteredKnowledge.forEach(item => {
    if (!knowledgeByType[item.type]) {
      knowledgeByType[item.type] = [];
    }
    knowledgeByType[item.type].push(item);
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Base de Conhecimento - {agent?.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie FAQs, objeções, casos de sucesso e mais
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        {(error || success) && (
          <div className="px-6 pt-4 flex-shrink-0">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Action Buttons */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar Conhecimento
              </button>

              <div className="text-sm text-gray-600">
                Total: <span className="font-semibold">{knowledge.length}</span> itens
              </div>
            </div>

            {/* Add/Edit Form */}
            {showAddForm && (
              <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-lg font-medium mb-4">
                  {editingItem ? 'Editar Conhecimento' : 'Adicionar Novo Conhecimento'}
                </h3>

                <div className="space-y-4">
                  {/* Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo *
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {Object.entries(knowledgeTypes).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                          <button
                            key={key}
                            onClick={() => setFormData({ ...formData, type: key })}
                            className={`p-3 border-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                              formData.type === key
                                ? `border-${config.color}-500 bg-${config.color}-50`
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon className={`w-5 h-5 text-${config.color}-600`} />
                            <span className="text-xs font-medium">{config.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* FAQ/Objection Fields */}
                  {(formData.type === 'faq' || formData.type === 'objection') && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {formData.type === 'faq' ? 'Pergunta' : 'Objeção'} *
                        </label>
                        <input
                          type="text"
                          value={formData.question}
                          onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                          placeholder={formData.type === 'faq' ? 'Ex: Qual o prazo de entrega?' : 'Ex: Está muito caro'}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {formData.type === 'faq' ? 'Resposta' : 'Como Responder'} *
                        </label>
                        <textarea
                          value={formData.answer}
                          onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                          placeholder={formData.type === 'faq' ? 'Digite a resposta completa...' : 'Como o agente deve responder a essa objeção...'}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </>
                  )}

                  {/* Other Types Content */}
                  {formData.type !== 'faq' && formData.type !== 'objection' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Conteúdo *
                      </label>
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="Digite o conteúdo completo..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Categoria (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="Ex: Preços, Funcionalidades, Suporte"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="Separe por vírgula: preço, entrega, suporte"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAddKnowledge}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {editingItem ? 'Salvar Alterações' : 'Adicionar'}
                    </button>
                    <button
                      onClick={cancelForm}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Test Search */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Testar Busca Semântica
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleTestSearch()}
                  placeholder="Ex: Quanto custa? Como funciona a entrega?"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleTestSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {isSearching ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {searchResults && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">
                    {searchResults.length} resultados encontrados:
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((result, index) => (
                      <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-xs font-medium text-blue-600 uppercase">
                            {knowledgeTypes[result.type]?.label || result.type}
                          </span>
                          <span className="text-xs text-gray-500">
                            Similaridade: {(result.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                        {result.question && (
                          <p className="text-sm font-medium">{result.question}</p>
                        )}
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {result.answer || result.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todos ({knowledge.length})
              </button>
              {Object.entries(knowledgeTypes).map(([key, config]) => {
                const count = knowledge.filter(k => k.type === key).length;
                if (count === 0) return null;

                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activeFilter === key
                        ? `bg-${config.color}-100 text-${config.color}-700`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {config.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Knowledge List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredKnowledge.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">
                  {activeFilter === 'all'
                    ? 'Nenhum conhecimento adicionado ainda'
                    : `Nenhum item do tipo ${knowledgeTypes[activeFilter]?.label}`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(knowledgeByType).map(([type, items]) => {
                  const config = knowledgeTypes[type];
                  const Icon = config.icon;

                  return (
                    <div key={type}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Icon className={`w-4 h-4 text-${config.color}-600`} />
                        {config.label} ({items.length})
                      </h3>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                {item.question && (
                                  <p className="font-medium text-gray-900 mb-1">
                                    {item.question}
                                  </p>
                                )}
                                <p className="text-sm text-gray-600 line-clamp-2">
                                  {item.answer || item.content}
                                </p>
                                {item.category && (
                                  <span className="inline-block mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => handleEditKnowledge(item)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteKnowledge(item.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Deletar"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseModal;
