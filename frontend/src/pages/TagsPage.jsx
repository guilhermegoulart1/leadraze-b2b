import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Tag, Plus, Trash2, Edit2, X, Check, Pipette } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import api from '../services/api';

// Cores pré-definidas para seleção rápida
const PRESET_COLORS = [
  { name: 'Roxo', hex: '#9333ea' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Amarelo', hex: '#ca8a04' },
  { name: 'Vermelho', hex: '#dc2626' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Laranja', hex: '#ea580c' },
  { name: 'Ciano', hex: '#0891b2' },
];

// Função para gerar cor de fundo clara a partir de hex
const getTagStyles = (hexColor) => {
  // Se for uma cor antiga (nome), converter para hex
  const colorMap = {
    purple: '#9333ea',
    blue: '#2563eb',
    green: '#16a34a',
    yellow: '#ca8a04',
    red: '#dc2626',
    pink: '#db2777',
    orange: '#ea580c',
    gray: '#6b7280',
  };

  const hex = colorMap[hexColor] || hexColor || '#9333ea';

  // Criar cor de fundo com 20% de opacidade
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    color: hex,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
  };
};

// Componente de seleção de cor - FORA do TagsPage para evitar re-render
const ColorPicker = ({ value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customHex, setCustomHex] = useState(value);

  // Atualizar customHex quando value muda (mas não resetar showCustom)
  useEffect(() => {
    setCustomHex(value);
  }, [value]);

  const handleCustomChange = (e) => {
    let hex = e.target.value;
    setCustomHex(hex);
    // Validar e aplicar se for hex válido
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  const handlePresetClick = (hex) => {
    onChange(hex);
    setCustomHex(hex);
    setShowCustom(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Cores pré-definidas */}
      {PRESET_COLORS.map((color) => (
        <button
          key={color.hex}
          type="button"
          onClick={() => handlePresetClick(color.hex)}
          className={`w-5 h-5 rounded-full border-2 transition-all ${
            value === color.hex
              ? 'ring-2 ring-offset-1 ring-purple-500 border-white'
              : 'border-gray-300 dark:border-gray-600 hover:scale-110'
          }`}
          style={{ backgroundColor: color.hex }}
          title={color.name}
        />
      ))}

      {/* Botão para cor customizada */}
      <button
        type="button"
        onClick={() => setShowCustom(true)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          !PRESET_COLORS.find(c => c.hex === value)
            ? 'ring-2 ring-offset-1 ring-purple-500 border-purple-400'
            : 'border-gray-300 dark:border-gray-600 hover:scale-110'
        }`}
        style={{
          backgroundColor: !PRESET_COLORS.find(c => c.hex === value) ? value : 'transparent'
        }}
        title="Cor customizada"
      >
        {PRESET_COLORS.find(c => c.hex === value) && (
          <Pipette className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {/* Modal via Portal */}
      {showCustom && ReactDOM.createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          onClick={(e) => {
            // Fechar apenas se clicar no overlay (fora do modal)
            if (e.target === e.currentTarget) {
              setShowCustom(false);
            }
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/30" />
          {/* Modal */}
          <div
            className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-4 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Cor Customizada</span>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Color Picker */}
            <HexColorPicker
              color={value}
              onChange={(newColor) => {
                onChange(newColor);
                setCustomHex(newColor);
              }}
              style={{ width: '100%' }}
            />

            {/* HEX Input */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-gray-500 dark:text-gray-400">HEX:</label>
              <input
                type="text"
                value={customHex}
                onChange={handleCustomChange}
                placeholder="#ff0099"
                className="flex-1 px-2 py-1.5 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Preview */}
            <div
              className="flex items-center justify-center px-4 py-2 rounded text-sm font-medium border"
              style={getTagStyles(value)}
            >
              Preview: {value}
            </div>

            <button
              type="button"
              onClick={() => setShowCustom(false)}
              className="px-4 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Preview da cor atual */}
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border"
        style={getTagStyles(value)}
      >
        {value}
      </div>
    </div>
  );
};

const TagsPage = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', color: '#9333ea' });
  const [editForm, setEditForm] = useState({ name: '', color: '#9333ea' });

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
        setNewTag({ name: '', color: '#9333ea' });
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
        setEditForm({ name: '', color: '#9333ea' });
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
    // Converter cor antiga para hex se necessário
    const colorMap = {
      purple: '#9333ea',
      blue: '#2563eb',
      green: '#16a34a',
      yellow: '#ca8a04',
      red: '#dc2626',
      pink: '#db2777',
      orange: '#ea580c',
      gray: '#6b7280',
    };
    const hexColor = colorMap[tag.color] || tag.color || '#9333ea';
    setEditForm({ name: tag.name, color: hexColor });
  };

  const cancelEditing = () => {
    setEditingTag(null);
    setEditForm({ name: '', color: '#9333ea' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Etiquetas</h1>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Gerencie as etiquetas do sistema
          </p>
        </div>
        <button
          onClick={() => setShowNewTagForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Etiqueta
        </button>
      </div>

      {/* New Tag Form */}
      {showNewTagForm && (
        <div className="mb-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
          <form onSubmit={handleCreateTag} className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-10">
                Nome:
              </label>
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                placeholder="Nome da etiqueta..."
                autoFocus
                className="flex-1 px-2 py-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-start gap-3">
              <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-10 pt-1">
                Cor:
              </label>
              <ColorPicker
                value={newTag.color}
                onChange={(color) => setNewTag({ ...newTag, color })}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!newTag.name.trim()}
                className="px-2.5 py-1 text-[11px] bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Criar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewTagForm(false);
                  setNewTag({ name: '', color: '#9333ea' });
                }}
                className="px-2.5 py-1 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tags List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        {tags.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-[11px]">Nenhuma etiqueta cadastrada</p>
            <p className="text-[10px] mt-0.5">Crie sua primeira etiqueta para começar</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {tags.map((tag) => {
              const tagStyles = getTagStyles(tag.color);
              const isEditing = editingTag?.id === tag.id;

              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="flex-1 px-2 py-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>
                      <ColorPicker
                        value={editForm.color}
                        onChange={(color) => setEditForm({ ...editForm, color })}
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleUpdateTag}
                          className="px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Salvar
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-2 py-0.5 text-[10px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 text-[11px] font-medium rounded border"
                          style={tagStyles}
                        >
                          {tag.name}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {tag.usage_count || 0} uso(s)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditingTag(tag)}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagsPage;
