import React, { useState } from 'react';
import {
  X, Bot, Mail, MessageCircle, Linkedin, ChevronLeft, ChevronRight,
  RefreshCw, Check, Smile, Briefcase, MessageSquare, Sparkles
} from 'lucide-react';

const ActivationAgentWizard = ({ onClose, onSubmit, agent = null }) => {
  const isEditing = !!agent;
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Avatar state
  const [avatarSeed, setAvatarSeed] = useState(Math.floor(Math.random() * 70) + 1);
  const [avatarUrl, setAvatarUrl] = useState(
    agent?.avatar_url || `https://i.pravatar.cc/200?img=${Math.floor(Math.random() * 70) + 1}`
  );
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    description: agent?.description || '',
    avatarUrl: avatarUrl,
    activation_type: agent?.activation_type || '',
    tone: agent?.tone || 'professional',
    language: agent?.language || 'pt-BR',
    personality: agent?.personality || '',
    initial_message: agent?.initial_message || '',
    follow_up_message: agent?.follow_up_message || '',
    custom_instructions: agent?.custom_instructions || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Update field
  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  // Refresh avatar
  const refreshAvatar = () => {
    const newSeed = Math.floor(Math.random() * 70) + 1;
    setAvatarSeed(newSeed);
    setAvatarLoading(true);
    setAvatarError(false);
    const newUrl = `https://i.pravatar.cc/200?img=${newSeed}`;
    setAvatarUrl(newUrl);
    updateField('avatarUrl', newUrl);
  };

  // Handle avatar load/error
  const handleAvatarLoad = () => {
    setAvatarLoading(false);
    setAvatarError(false);
  };

  const handleAvatarError = (e) => {
    console.error('Avatar loading error:', e);
    setAvatarLoading(false);
    setAvatarError(true);
  };

  // Validation
  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setError('Nome do agente é obrigatório');
          return false;
        }
        return true;

      case 2:
        if (!formData.activation_type) {
          setError('Selecione um tipo de ativação');
          return false;
        }
        return true;

      case 3:
        if (!formData.tone) {
          setError('Selecione um tom de comunicação');
          return false;
        }
        return true;

      case 4:
        if (!formData.initial_message.trim()) {
          setError('Mensagem inicial é obrigatória');
          return false;
        }
        return true;

      case 5:
        return true;

      default:
        return true;
    }
  };

  // Navigate steps
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      setError(null);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    try {
      setLoading(true);
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao salvar agente');
    } finally {
      setLoading(false);
    }
  };

  // Progress bar
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Editar Agente' : 'Novo Agente de Ativação'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Etapa {currentStep} de {totalSteps}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-purple-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Avatar + Name */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Identidade do Agente
                </h3>
                <p className="text-sm text-gray-600">
                  Escolha um avatar e dê um nome ao seu agente
                </p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  {avatarLoading && !avatarError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-full">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                    </div>
                  )}
                  {avatarError ? (
                    <div className="w-32 h-32 rounded-full bg-purple-100 flex items-center justify-center">
                      <Bot className="w-16 h-16 text-purple-600" />
                    </div>
                  ) : (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-32 h-32 rounded-full object-cover"
                      onLoad={handleAvatarLoad}
                      onError={handleAvatarError}
                      style={{ display: avatarLoading ? 'none' : 'block' }}
                    />
                  )}
                </div>
                <button
                  onClick={refreshAvatar}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Trocar Avatar
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Agente *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Ex: Ana Silva - Vendas"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Descreva o objetivo deste agente..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Activation Type */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Tipo de Ativação
                </h3>
                <p className="text-sm text-gray-600">
                  Escolha o canal que este agente irá utilizar
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Email */}
                <button
                  onClick={() => updateField('activation_type', 'email')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    formData.activation_type === 'email'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <Mail className={`w-12 h-12 mx-auto mb-3 ${
                    formData.activation_type === 'email' ? 'text-blue-600' : 'text-gray-400'
                  }`} />
                  <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
                  <p className="text-sm text-gray-600">
                    Envio de emails personalizados
                  </p>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={() => updateField('activation_type', 'whatsapp')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    formData.activation_type === 'whatsapp'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <MessageCircle className={`w-12 h-12 mx-auto mb-3 ${
                    formData.activation_type === 'whatsapp' ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <h4 className="font-semibold text-gray-900 mb-1">WhatsApp</h4>
                  <p className="text-sm text-gray-600">
                    Mensagens via WhatsApp Business
                  </p>
                </button>

                {/* LinkedIn */}
                <button
                  onClick={() => updateField('activation_type', 'linkedin')}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    formData.activation_type === 'linkedin'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <Linkedin className={`w-12 h-12 mx-auto mb-3 ${
                    formData.activation_type === 'linkedin' ? 'text-purple-600' : 'text-gray-400'
                  }`} />
                  <h4 className="font-semibold text-gray-900 mb-1">LinkedIn</h4>
                  <p className="text-sm text-gray-600">
                    Conexões e mensagens no LinkedIn
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Personality */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Personalidade e Tom
                </h3>
                <p className="text-sm text-gray-600">
                  Defina como seu agente irá se comunicar
                </p>
              </div>

              {/* Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tom de Comunicação *
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { value: 'formal', label: 'Formal', icon: Briefcase },
                    { value: 'casual', label: 'Casual', icon: Smile },
                    { value: 'professional', label: 'Profissional', icon: Briefcase },
                    { value: 'friendly', label: 'Amigável', icon: Smile }
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => updateField('tone', value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.tone === value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${
                        formData.tone === value ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => updateField('language', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </div>

              {/* Personality */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personalidade (opcional)
                </label>
                <textarea
                  value={formData.personality}
                  onChange={(e) => updateField('personality', e.target.value)}
                  placeholder="Ex: Entusiástico, prestativo e focado em resultados..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 4: Messages */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Mensagens
                </h3>
                <p className="text-sm text-gray-600">
                  Configure as mensagens que o agente enviará
                </p>
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem Inicial *
                </label>
                <textarea
                  value={formData.initial_message}
                  onChange={(e) => updateField('initial_message', e.target.value)}
                  placeholder="Olá {{nome}}, tudo bem?&#10;&#10;Meu nome é {{agente}} e trabalho na {{empresa}}..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Variáveis disponíveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{cargo}}'}, {'{{agente}}'}
                </p>
              </div>

              {/* Follow-up Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem de Follow-up (opcional)
                </label>
                <textarea
                  value={formData.follow_up_message}
                  onChange={(e) => updateField('follow_up_message', e.target.value)}
                  placeholder="Oi {{nome}}, vi que você visualizou minha mensagem..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                />
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instruções Customizadas (opcional)
                </label>
                <textarea
                  value={formData.custom_instructions}
                  onChange={(e) => updateField('custom_instructions', e.target.value)}
                  placeholder="Instruções especiais para o agente..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Revisar e Confirmar
                </h3>
                <p className="text-sm text-gray-600">
                  Confira as informações do seu agente antes de criar
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-4">
                  {avatarError ? (
                    <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-10 h-10 text-purple-600" />
                    </div>
                  ) : (
                    <img
                      src={formData.avatarUrl}
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-900">{formData.name}</h4>
                    {formData.description && (
                      <p className="text-sm text-gray-600 mt-1">{formData.description}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Canal</span>
                    <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                      {formData.activation_type}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Tom</span>
                    <p className="text-sm font-medium text-gray-900 mt-1 capitalize">
                      {formData.tone}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Idioma</span>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {formData.language === 'pt-BR' ? 'Português' : formData.language}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase">Mensagens</span>
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      {formData.follow_up_message ? '2 configuradas' : '1 configurada'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={prevStep}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentStep === 1 || loading}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index + 1 === currentStep
                    ? 'bg-purple-600'
                    : index + 1 < currentStep
                    ? 'bg-purple-400'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {currentStep < totalSteps ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Agente'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivationAgentWizard;
