/**
 * Template List Component
 *
 * Manages email templates for the account
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  Save,
  X,
  FileText,
  Loader2,
  Copy,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';

// Template Categories
const CATEGORIES = [
  { id: 'outreach', label: 'Prospecção' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'meeting', label: 'Reunião' },
  { id: 'thank_you', label: 'Agradecimento' },
  { id: 'custom', label: 'Personalizado' },
];

// Template Card Component
const TemplateCard = ({ template, onEdit, onDelete, onPreview, onDuplicate }) => {
  const { t } = useTranslation('emailSettings');
  const [deleting, setDeleting] = useState(false);

  const category = CATEGORIES.find(c => c.id === template.category);

  const handleDelete = async () => {
    if (!confirm(t('templates.confirmDelete', 'Tem certeza que deseja excluir este template?'))) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(template.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900">{template.name}</h4>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
              {category?.label || template.category}
            </span>
          </div>
          {template.description && (
            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPreview(template)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
            title={t('templates.preview', 'Visualizar')}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDuplicate(template)}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-gray-100 rounded"
            title={t('templates.duplicate', 'Duplicar')}
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(template)}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-gray-100 rounded"
            title={t('templates.edit', 'Editar')}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded disabled:opacity-50"
            title={t('templates.delete', 'Excluir')}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Subject preview */}
      {template.subject_template && (
        <div className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{t('templates.subject', 'Assunto')}: </span>
          {template.subject_template}
        </div>
      )}

      {/* Available Variables */}
      {template.available_variables?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.available_variables.slice(0, 5).map((variable, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-xs rounded">
              {`{{${variable}}}`}
            </span>
          ))}
          {template.available_variables.length > 5 && (
            <span className="px-1.5 py-0.5 text-gray-500 text-xs">
              +{template.available_variables.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// Preview Modal Component
const PreviewModal = ({ template, onClose }) => {
  const { t } = useTranslation('emailSettings');
  const [previewData, setPreviewData] = useState({
    nome: 'João Silva',
    empresa: 'Empresa Exemplo',
    cargo: 'Diretor de Marketing',
    industria: 'Tecnologia',
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const result = await api.previewEmailTemplate(template.id, previewData);
      setPreview(result);
    } catch (err) {
      console.error('Error loading preview:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadPreview();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-bold">{t('templates.previewTitle', 'Visualização do Template')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sample Data */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-700 mb-3">{t('templates.sampleData', 'Dados de Exemplo')}</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(previewData).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{key}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setPreviewData({ ...previewData, [key]: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-sm"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={loadPreview}
              disabled={loading}
              className="mt-3 text-sm text-purple-600 hover:text-purple-700"
            >
              {loading ? t('templates.loading', 'Carregando...') : t('templates.updatePreview', 'Atualizar Preview')}
            </button>
          </div>

          {/* Preview */}
          {preview && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {preview.subject && (
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-sm font-medium text-gray-600">{t('templates.subject', 'Assunto')}: </span>
                  <span className="text-sm">{preview.subject}</span>
                </div>
              )}
              <div
                className="p-4 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.preview || '') }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Template List Component
const TemplateList = ({ templates, onTemplatesChange }) => {
  const { t } = useTranslation('emailSettings');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category: 'custom',
    subject_template: '',
    description: '',
    available_variables: ['nome', 'empresa', 'cargo'],
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: t('templates.editorPlaceholder', 'Digite o conteúdo do template aqui... Use {{variavel}} para inserir variáveis.'),
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none',
      },
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      category: 'custom',
      subject_template: '',
      description: '',
      available_variables: ['nome', 'empresa', 'cargo'],
    });
    editor?.commands.clearContent();
    setEditingTemplate(null);
    setIsCreating(false);
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setIsCreating(true);
    setFormData({
      name: template.name || '',
      slug: template.slug || '',
      category: template.category || 'custom',
      subject_template: template.subject_template || '',
      description: template.description || '',
      available_variables: template.available_variables || ['nome', 'empresa', 'cargo'],
    });
    editor?.commands.setContent(template.html_template || '');
  };

  const handleDuplicate = (template) => {
    setEditingTemplate(null);
    setIsCreating(true);
    setFormData({
      name: `${template.name} (Cópia)`,
      slug: `${template.slug}-copy-${Date.now()}`,
      category: template.category || 'custom',
      subject_template: template.subject_template || '',
      description: template.description || '',
      available_variables: template.available_variables || ['nome', 'empresa', 'cargo'],
    });
    editor?.commands.setContent(template.html_template || '');
  };

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t('templates.nameRequired', 'Nome do template é obrigatório'));
      return;
    }

    if (!formData.slug.trim()) {
      // Auto-generate slug from name
      formData.slug = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    setSaving(true);
    try {
      const htmlContent = editor?.getHTML() || '';
      const textContent = editor?.getText() || '';

      const templateData = {
        ...formData,
        html_template: htmlContent,
        text_template: textContent,
      };

      let result;
      if (editingTemplate) {
        result = await api.updateEmailTemplate(editingTemplate.id, templateData);
        onTemplatesChange(templates.map(t => t.id === editingTemplate.id ? result.template : t));
      } else {
        result = await api.createEmailTemplate(templateData);
        onTemplatesChange([...templates, result.template]);
      }

      resetForm();
    } catch (err) {
      console.error('Error saving template:', err);
      alert(err.message || t('templates.saveFailed', 'Erro ao salvar template'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteEmailTemplate(id);
      onTemplatesChange(templates.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting template:', err);
      alert(t('templates.deleteFailed', 'Erro ao excluir template'));
    }
  };

  // Filter templates by category
  const filteredTemplates = activeCategory === 'all'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  // Insert variable at cursor
  const insertVariable = (variable) => {
    editor?.commands.insertContent(`{{${variable}}}`);
  };

  return (
    <div className="space-y-6">
      {/* Templates List */}
      {!isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              {t('templates.title', 'Templates de Email')}
            </h3>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('templates.create', 'Novo Template')}
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-full text-sm ${
                activeCategory === 'all'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t('templates.allCategories', 'Todos')}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-sm ${
                  activeCategory === cat.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('templates.empty', 'Nenhum template criado')}</p>
              <p className="text-sm mt-1">
                {t('templates.emptyHint', 'Crie templates para agilizar a criação de emails')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onPreview={setPreviewingTemplate}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              {editingTemplate
                ? t('templates.editTitle', 'Editar Template')
                : t('templates.createTitle', 'Novo Template')
              }
            </h3>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('templates.name', 'Nome do Template')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('templates.namePlaceholder', 'Ex: Primeiro Contato')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('templates.category', 'Categoria')}
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('templates.description', 'Descrição')}
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('templates.descriptionPlaceholder', 'Breve descrição do uso deste template')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('templates.subjectTemplate', 'Template do Assunto')}
              </label>
              <input
                type="text"
                value={formData.subject_template}
                onChange={(e) => setFormData({ ...formData, subject_template: e.target.value })}
                placeholder={t('templates.subjectPlaceholder', 'Ex: {{nome}}, oportunidade para {{empresa}}')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Variables */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('templates.variables', 'Variáveis Disponíveis')}
              </label>
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                {formData.available_variables.map((variable, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded hover:bg-purple-200 transition-colors"
                  >
                    {`{{${variable}}}`}
                  </button>
                ))}
                <span className="text-sm text-gray-500 self-center ml-2">
                  {t('templates.clickToInsert', 'Clique para inserir')}
                </span>
              </div>
            </div>

            {/* Template Content Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('templates.content', 'Conteúdo do Template')}
              </label>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                {t('templates.cancel', 'Cancelar')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {t('templates.save', 'Salvar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewingTemplate && (
        <PreviewModal
          template={previewingTemplate}
          onClose={() => setPreviewingTemplate(null)}
        />
      )}
    </div>
  );
};

export default TemplateList;
