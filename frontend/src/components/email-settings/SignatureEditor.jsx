/**
 * Signature Editor Component
 *
 * Template-based editor for creating professional email signatures
 * Flow: 1. Fill data → 2. Choose template with preview
 */

import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import {
  Plus,
  Trash2,
  Edit2,
  Star,
  Save,
  X,
  Loader2,
  FileSignature,
  Upload,
  Check,
  Palette,
  Building2,
  User as UserIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import {
  signatureTemplates,
  defaultAccentColors,
  placeholderPhoto,
  placeholderLogo
} from './signatureTemplates';

// Accent color options
const accentColorOptions = [
  { value: '#ec4899', name: 'Rosa' },
  { value: '#8b5cf6', name: 'Roxo' },
  { value: '#3b82f6', name: 'Azul' },
  { value: '#06b6d4', name: 'Ciano' },
  { value: '#22c55e', name: 'Verde' },
  { value: '#f59e0b', name: 'Laranja' },
  { value: '#ef4444', name: 'Vermelho' },
  { value: '#6b7280', name: 'Cinza' },
  { value: '#1a1a1a', name: 'Preto' },
];

// Image Upload Component
const ImageUploader = ({ label, icon: Icon, value, onChange, shape = 'circle' }) => {
  const { t } = useTranslation('emailSettings');
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(t('signatures.invalidImageType', 'Por favor selecione uma imagem'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(t('signatures.imageTooLarge', 'Imagem muito grande (máx 2MB)'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'signature');

      const response = await api.uploadFile(formData);
      onChange(response.url);
    } catch (err) {
      console.error('Error uploading image:', err);
      alert(t('signatures.uploadFailed', 'Erro ao fazer upload da imagem'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {label}
      </label>
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer border-2 border-dashed border-gray-300 hover:border-purple-400 transition-colors overflow-hidden ${
          shape === 'circle' ? 'w-24 h-24 rounded-full' : 'w-36 h-16 rounded-lg'
        }`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-xs">Upload</span>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
          }}
          className="mt-2 text-xs text-red-500 hover:text-red-700"
        >
          Remover
        </button>
      )}
    </div>
  );
};

// Signature Card Component (for list)
const SignatureCard = ({ signature, onEdit, onDelete, onSetDefault, isDefault }) => {
  const { t } = useTranslation('emailSettings');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(t('signatures.confirmDelete', 'Tem certeza que deseja excluir esta assinatura?'))) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(signature.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{signature.name}</h4>
          {isDefault && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
              {t('signatures.default', 'Padrão')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isDefault && (
            <button
              onClick={() => onSetDefault(signature.id)}
              className="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded"
              title={t('signatures.setAsDefault', 'Definir como padrão')}
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(signature)}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-gray-100 rounded"
            title={t('signatures.edit', 'Editar')}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded disabled:opacity-50"
            title={t('signatures.delete', 'Excluir')}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div
        className="text-sm text-gray-600 max-w-none overflow-hidden"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(signature.html_content || '') }}
      />
    </div>
  );
};

// Main Signature Editor Component
const SignatureEditor = ({ signatures, onSignaturesChange, preferences, onPreferencesChange }) => {
  const { t } = useTranslation('emailSettings');
  const [editingSignature, setEditingSignature] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: data, 2: template/preview

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState(signatureTemplates[0]);
  const [accentColor, setAccentColor] = useState(defaultAccentColors[signatureTemplates[0].id]);
  const [formData, setFormData] = useState({
    name: '',
    full_name: '',
    title: '',
    department: '',
    company: '',
    pronouns: '',
    phone: '',
    mobile: '',
    email: '',
    website: '',
    address: '',
    photo_url: '',
    logo_url: '',
  });

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      full_name: '',
      title: '',
      department: '',
      company: '',
      pronouns: '',
      phone: '',
      mobile: '',
      email: '',
      website: '',
      address: '',
      photo_url: '',
      logo_url: '',
    });
    setSelectedTemplate(signatureTemplates[0]);
    setAccentColor(defaultAccentColors[signatureTemplates[0].id]);
    setEditingSignature(null);
    setIsCreating(false);
    setCurrentStep(1);
  }, []);

  const handleEdit = useCallback((signature) => {
    setEditingSignature(signature);
    setIsCreating(true);
    setFormData({
      name: signature.name || '',
      full_name: signature.full_name || '',
      title: signature.title || '',
      department: signature.department || '',
      company: signature.company || '',
      pronouns: signature.pronouns || '',
      phone: signature.phone || '',
      mobile: signature.mobile || '',
      email: signature.email || '',
      website: signature.website || '',
      address: signature.address || '',
      photo_url: signature.photo_url || '',
      logo_url: signature.logo_url || '',
    });
    const template = signatureTemplates.find(t => t.id === signature.template_id) || signatureTemplates[0];
    setSelectedTemplate(template);
    setAccentColor(signature.accent_color || defaultAccentColors[template.id]);
    setCurrentStep(1);
  }, []);

  const handleCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  // Generate HTML from template and data
  const generateSignatureHtml = useCallback((template = selectedTemplate, color = accentColor) => {
    return template.html({
      fullName: formData.full_name,
      title: formData.title,
      department: formData.department,
      company: formData.company,
      pronouns: formData.pronouns,
      phone: formData.phone,
      mobile: formData.mobile,
      email: formData.email,
      website: formData.website,
      address: formData.address,
      photoUrl: formData.photo_url,
      logoUrl: formData.logo_url,
      accentColor: color,
    });
  }, [selectedTemplate, formData, accentColor]);

  // Generate plain text version
  const generateSignatureText = useCallback(() => {
    const parts = [];
    if (formData.full_name) parts.push(formData.full_name);
    if (formData.title) parts.push(formData.title);
    if (formData.company) parts.push(formData.company);
    if (formData.phone) parts.push(`Tel: ${formData.phone}`);
    if (formData.email) parts.push(formData.email);
    if (formData.website) parts.push(formData.website);
    return parts.join('\n');
  }, [formData]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert(t('signatures.nameRequired', 'Nome da assinatura é obrigatório'));
      return;
    }

    setSaving(true);
    try {
      const htmlContent = generateSignatureHtml();
      const textContent = generateSignatureText();

      const signatureData = {
        ...formData,
        template_id: selectedTemplate.id,
        accent_color: accentColor,
        html_content: htmlContent,
        text_content: textContent,
      };

      let result;
      if (editingSignature) {
        result = await api.updateEmailSignature(editingSignature.id, signatureData);
        onSignaturesChange(signatures.map(s => s.id === editingSignature.id ? result.signature : s));
      } else {
        result = await api.createEmailSignature(signatureData);
        onSignaturesChange([...signatures, result.signature]);
      }

      resetForm();
    } catch (err) {
      console.error('Error saving signature:', err);
      alert(t('signatures.saveFailed', 'Erro ao salvar assinatura'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteEmailSignature(id);
      onSignaturesChange(signatures.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting signature:', err);
      alert(t('signatures.deleteFailed', 'Erro ao excluir assinatura'));
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.setDefaultSignature(id);
      if (onPreferencesChange) {
        onPreferencesChange({ ...preferences, signature_id: id });
      }
    } catch (err) {
      console.error('Error setting default signature:', err);
      alert(t('signatures.setDefaultFailed', 'Erro ao definir assinatura padrão'));
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    // Keep current accent color or use template default
    if (!accentColor) {
      setAccentColor(defaultAccentColors[template.id]);
    }
  };

  // Check if has minimum data to proceed
  const hasMinimumData = formData.name.trim() && formData.full_name.trim();

  return (
    <div className="space-y-6">
      {/* Signatures List */}
      {!isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">
              {t('signatures.title', 'Assinaturas de Email')}
            </h3>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('signatures.create', 'Nova Assinatura')}
            </button>
          </div>

          {signatures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('signatures.empty', 'Nenhuma assinatura criada')}</p>
              <p className="text-sm mt-1">
                {t('signatures.emptyHint', 'Crie uma assinatura para usar em seus emails')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {signatures.map((signature) => (
                <SignatureCard
                  key={signature.id}
                  signature={signature}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                  isDefault={preferences?.signature_id === signature.id || signature.is_default}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {editingSignature
                  ? t('signatures.editTitle', 'Editar Assinatura')
                  : t('signatures.createTitle', 'Nova Assinatura')
                }
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {currentStep === 1 && 'Preencha suas informações'}
                {currentStep === 2 && 'Escolha o template e veja o preview'}
              </p>
            </div>
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((step) => (
              <React.Fragment key={step}>
                <button
                  onClick={() => step === 1 && setCurrentStep(step)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    currentStep === step
                      ? 'bg-purple-600 text-white'
                      : currentStep > step
                      ? 'bg-purple-100 text-purple-700 cursor-pointer hover:bg-purple-200'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {currentStep > step ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="w-5 h-5 flex items-center justify-center">{step}</span>
                  )}
                  {step === 1 && 'Seus Dados'}
                  {step === 2 && 'Template & Preview'}
                </button>
                {step < 2 && (
                  <div className={`flex-1 h-0.5 ${currentStep > step ? 'bg-purple-300' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Data Entry */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Signature Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('signatures.name', 'Nome da Assinatura')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('signatures.namePlaceholder', 'Ex: Assinatura Principal')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Image Uploads (optional) */}
              <div className="p-6 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-4 text-center">
                  Imagens (opcional)
                </h4>
                <div className="flex flex-wrap gap-8 justify-center">
                  <ImageUploader
                    label="Sua Foto"
                    icon={UserIcon}
                    value={formData.photo_url}
                    onChange={(url) => setFormData({ ...formData, photo_url: url })}
                    shape="circle"
                  />
                  <ImageUploader
                    label="Logo da Empresa"
                    icon={Building2}
                    value={formData.logo_url}
                    onChange={(url) => setFormData({ ...formData, logo_url: url })}
                    shape="rectangle"
                  />
                </div>
              </div>

              {/* Personal Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Informações Pessoais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="João Silva"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Cargo</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Gerente de Marketing"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Departamento</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Marketing"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Empresa</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Empresa ABC"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Pronomes</label>
                    <input
                      type="text"
                      value={formData.pronouns}
                      onChange={(e) => setFormData({ ...formData, pronouns: e.target.value })}
                      placeholder="Ele/Dele"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Informações de Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Telefone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+55 11 3000-0000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Celular</label>
                    <input
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="+55 11 99999-9999"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="joao@empresa.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Website</label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="https://www.empresa.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Endereço</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="São Paulo, SP - Brasil"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Next Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!hasMinimumData}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Escolher Template
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Template Selection with Live Preview */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Live Preview with User's Data */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">Preview com seus dados</h4>
                </div>
                <div className="bg-white p-6">
                  <div
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(generateSignatureHtml()) }}
                  />
                </div>
              </div>

              {/* Template Selection Grid */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Escolha um Template</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {signatureTemplates.map((template) => {
                    const isSelected = selectedTemplate.id === template.id;
                    // Check if template is compatible with user's uploads
                    const needsPhoto = template.hasPhoto && !formData.photo_url;
                    const needsLogo = template.hasLogo && !formData.logo_url;

                    return (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center z-10">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="mb-1">
                          <h5 className="font-medium text-xs text-gray-900">{template.name}</h5>
                        </div>
                        <div className="flex gap-1 mb-1">
                          {template.hasPhoto && (
                            <span className={`px-1 py-0.5 text-[10px] rounded ${needsPhoto ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-700'}`}>
                              Foto
                            </span>
                          )}
                          {template.hasLogo && (
                            <span className={`px-1 py-0.5 text-[10px] rounded ${needsLogo ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'}`}>
                              Logo
                            </span>
                          )}
                          {!template.hasPhoto && !template.hasLogo && (
                            <span className="px-1 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                              Texto
                            </span>
                          )}
                        </div>
                        {/* Mini preview with actual user data */}
                        <div
                          className="transform scale-[0.3] origin-top-left w-[330%] h-[90px] overflow-hidden pointer-events-none"
                          dangerouslySetInnerHTML={{
                            __html: generateSignatureHtml(template, isSelected ? accentColor : defaultAccentColors[template.id])
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Color Picker */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Palette className="w-4 h-4" />
                  Cor:
                </label>
                <div className="flex gap-2">
                  {accentColorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setAccentColor(color.value)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        accentColor === color.value
                          ? 'border-gray-800 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4 border-t border-gray-200">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Editar Dados
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar Assinatura
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SignatureEditor;
