import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import api from '../services/api';

const TAG_COLORS = [
  { name: 'Roxo', value: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  { name: 'Azul', value: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  { name: 'Verde', value: 'green', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  { name: 'Amarelo', value: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  { name: 'Vermelho', value: 'red', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  { name: 'Rosa', value: 'pink', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400' },
  { name: 'Laranja', value: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  { name: 'Cinza', value: 'gray', bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400' },
];

const TagsPage = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', color: 'purple' });
  const [editForm, setEditForm] = useState({ name: '', color: 'purple' });

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      setLoading(true);
      const response = await api.getTags();
      if (response.success) {
        setTags(response.data.tags || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    if (!newTag.name.trim()) return;

    try {
      const response = await api.createTag({
        name: newTag.name.trim(),
        color: newTag.color
      });

      if (response.success) {
        setTags(prev => [...prev, response.data.tag]);
        setNewTag({ name: '', color: 'purple' });
        setShowNewTagForm(false);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      alert('Erro ao criar etiqueta');
    }
  };

  const handleUpdateTag = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editingTag) return;

    try {
      const response = await api.updateTag(editingTag.id, {
        name: editForm.name.trim(),
        color: editForm.color
      });

      if (response.success) {
        setTags(prev => prev.map(t =>
          t.id === editingTag.id ? response.data.tag : t
        ));
        setEditingTag(null);
        setEditForm({ name: '', color: 'purple' });
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      alert('Erro ao atualizar etiqueta');
    }
  };

  const handleDeleteTag = async (tagId) => {
    if (!confirm('Tem certeza que deseja excluir esta etiqueta?')) return;

    try {
      await api.deleteTag(tagId);
      setTags(prev => prev.filter(t => t.id !== tagId));
    } catch (error) {
      console.error('Error deleting tag:', error);
      alert('Erro ao excluir etiqueta');
    }
  };

  const startEditingTag = (tag) => {
    setEditingTag(tag);
    setEditForm({ name: tag.name, color: tag.color || 'purple' });
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditForm({ name: '', color: 'purple' });
  };

  const getColorClasses = (colorValue) => {
    const color = TAG_COLORS.find(c => c.value === colorValue) || TAG_COLORS[0];
    return { bg: color.bg, text: color.text };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Etiquetas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerencie as etiquetas do sistema
          </p>
        </div>
        <button
          onClick={() => setShowNewTagForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Etiqueta
        </button>
      </div>

      {/* New Tag Form */}
      {showNewTagForm && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <form onSubmit={handleCreateTag} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome da Etiqueta
              </label>
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="Digite o nome da etiqueta..."
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cor
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewTag({ ...newTag, color: color.value })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      newTag.color === color.value
                        ? `${color.bg} ${color.text} ring-2 ring-offset-2 ring-purple-500`
                        : `${color.bg} ${color.text} opacity-60 hover:opacity-100`
                    }`}
                  >
                    {color.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!newTag.name.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Criar Etiqueta
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewTagForm(false);
                  setNewTag({ name: '', color: 'purple' });
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tags List */}
      <div className="space-y-2">
        {tags.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma etiqueta cadastrada</p>
            <p className="text-sm mt-1">Crie sua primeira etiqueta para começar</p>
          </div>
        ) : (
          tags.map((tag) => {
            const colorClasses = getColorClasses(tag.color);
            const isEditing = editingTag?.id === tag.id;

            return (
              <div
                key={tag.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
              >
                {isEditing ? (
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, color: color.value })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            editForm.color === color.value
                              ? `${color.bg} ${color.text} ring-2 ring-offset-2 ring-purple-500`
                              : `${color.bg} ${color.text} opacity-60 hover:opacity-100`
                          }`}
                        >
                          {color.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateTag}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Salvar
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1.5 ${colorClasses.bg} ${colorClasses.text} text-sm font-medium rounded-md`}>
                        {tag.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {tag.usage_count || 0} uso(s)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditingTag(tag)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TagsPage;
