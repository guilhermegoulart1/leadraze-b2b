import React, { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Check, RefreshCw, Bot, Mail, MessageCircle,
  Linkedin, MapPin, Target, Zap, BookOpen, Smile, Sparkles
} from 'lucide-react';
import api from '../services/api';
import LocationMapPicker from './LocationMapPicker';
import { BUSINESS_CATEGORIES, detectUserLanguage, getTranslatedCategories } from '../data/businessCategories';

const UnifiedAgentWizard = ({ isOpen, onClose, onSubmit, agent = null }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState('');

  // Avatar state
  const [avatarSeed, setAvatarSeed] = useState(Math.floor(Math.random() * 70) + 1);
  const [avatarUrl, setAvatarUrl] = useState(`https://i.pravatar.cc/200?img=${Math.floor(Math.random() * 70) + 1}`);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Common fields
    name: '',
    description: '',
    avatar_url: avatarUrl,
    agent_type: '', // linkedin, google_maps, email, whatsapp
    response_length: 'medium', // short, medium, long

    // Config will be built dynamically based on agent_type
    config: {}
  });

  const userLang = detectUserLanguage();
  const translatedCategories = getTranslatedCategories(userLang);

  // Load behavioral profiles for LinkedIn agents
  useEffect(() => {
    if (isOpen && !profiles) {
      loadProfiles();
    }
  }, [isOpen]);

  // Prefill form if editing
  useEffect(() => {
    if (isOpen && agent) {
      setFormData({
        name: agent.name || '',
        description: agent.description || '',
        avatar_url: agent.avatar_url || avatarUrl,
        agent_type: agent.agent_type || '',
        response_length: agent.response_length || 'medium',
        config: agent.config || {}
      });
      if (agent.avatar_url) {
        setAvatarUrl(agent.avatar_url);
      }
    }
  }, [isOpen, agent]);

  const loadProfiles = async () => {
    try {
      const response = await api.getBehavioralProfiles();
      setProfiles(response.data?.profiles || null);
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const updateConfig = (field, value) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
    setError('');
  };

  const refreshAvatar = () => {
    const newSeed = Math.floor(Math.random() * 70) + 1;
    setAvatarSeed(newSeed);
    const newUrl = `https://i.pravatar.cc/200?img=${newSeed}&t=${Date.now()}`; // Add timestamp to force reload

    // Preload the image before updating state to avoid flicker
    const img = new Image();
    img.onload = () => {
      setAvatarUrl(newUrl);
      updateField('avatar_url', newUrl);
      setAvatarError(false);
      setAvatarLoading(false);
    };
    img.onerror = () => {
      setAvatarError(true);
      setAvatarLoading(false);
    };
    img.src = newUrl;
  };

  const handleAvatarLoad = () => {
    setAvatarLoading(false);
    setAvatarError(false);
  };

  const handleAvatarError = () => {
    setAvatarLoading(false);
    setAvatarError(true);
  };

  // Get total steps based on agent type
  const getTotalSteps = () => {
    switch (formData.agent_type) {
      case 'linkedin': return 7; // Avatar+Nome+Tipo, Produtos, Negócio, Perfil, Escalação, Response Length, Review
      case 'google_maps': return 7; // Avatar+Nome+Tipo, Localização, Nicho, Filtros, Ações, Response Length, Review
      case 'email':
      case 'whatsapp': return 5; // Avatar+Nome+Tipo, Personalidade, Mensagens, Response Length, Review
      default: return 1;
    }
  };

  // Validate current step
  const validateStep = (step) => {
    // Step 1: Basic info + Agent Type
    if (step === 1) {
      if (!formData.name.trim()) {
        setError('Nome do agente é obrigatório');
        return false;
      }
      if (!formData.agent_type) {
        setError('Selecione o tipo de agente');
        return false;
      }
      return true;
    }

    // LinkedIn steps
    if (formData.agent_type === 'linkedin') {
      if (step === 2 && !formData.config.products_services) {
        setError('Descreva seus produtos/serviços');
        return false;
      }
      if (step === 4 && !formData.config.behavioral_profile) {
        setError('Selecione um perfil comportamental');
        return false;
      }
      if (step === 6 && !formData.config.initial_approach) {
        setError('Abordagem inicial é obrigatória');
        return false;
      }
    }

    // Google Maps steps
    if (formData.agent_type === 'google_maps') {
      if (step === 2 && (!formData.config.location || !formData.config.location.lat)) {
        setError('Selecione uma localização no mapa');
        return false;
      }
      if (step === 3 && !formData.config.business_category && !formData.config.business_specification) {
        setError('Preencha categoria OU especificação');
        return false;
      }
    }

    // Email/WhatsApp steps
    if (formData.agent_type === 'email' || formData.agent_type === 'whatsapp') {
      if (step === 3 && !formData.config.initial_message) {
        setError('Mensagem inicial é obrigatória');
        return false;
      }
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, getTotalSteps()));
      setError('');
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    try {
      setLoading(true);

      // Build final payload
      const payload = {
        name: formData.name.trim(),
        description: formData.description || null,
        avatar_url: formData.avatar_url,
        agent_type: formData.agent_type,
        response_length: formData.response_length,
        config: formData.config
      };

      await onSubmit(payload);
      handleClose();
    } catch (err) {
      console.error('Erro ao criar agente:', err);
      setError(err.message || 'Erro ao criar agente');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      name: '',
      description: '',
      avatar_url: avatarUrl,
      agent_type: '',
      response_length: 'medium',
      config: {}
    });
    setError('');
    onClose();
  };

  // Get agent type icon
  const getAgentTypeIcon = (type) => {
    switch (type) {
      case 'linkedin': return Linkedin;
      case 'google_maps': return MapPin;
      case 'email': return Mail;
      case 'whatsapp': return MessageCircle;
      default: return Bot;
    }
  };

  const getAgentTypeColor = (type) => {
    switch (type) {
      case 'linkedin': return 'purple';
      case 'google_maps': return 'green';
      case 'email': return 'blue';
      case 'whatsapp': return 'green';
      default: return 'gray';
    }
  };

  const iconMap = {
    consultivo: Target,
    direto: Zap,
    educativo: BookOpen,
    amigavel: Smile
  };

  if (!isOpen) return null;

  const totalSteps = getTotalSteps();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {agent ? 'Editar Agente' : 'Novo Agente de IA'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure seu agente inteligente
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress Bar */}
        {formData.agent_type && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Passo {currentStep} de {totalSteps}
              </span>
              <span className="text-sm text-gray-600">
                {Math.round((currentStep / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Avatar + Nome + Tipo */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Informações Básicas
                </h3>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  {avatarError ? (
                    <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
                      <Bot className="w-12 h-12 text-gray-400" />
                    </div>
                  ) : (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      key={avatarUrl}
                      className="w-24 h-24 rounded-full transition-opacity duration-300 ease-in-out"
                      onLoad={handleAvatarLoad}
                      onError={handleAvatarError}
                      style={{ opacity: avatarLoading ? 0.5 : 1 }}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Avatar do Agente</p>
                  <button
                    type="button"
                    onClick={refreshAvatar}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Trocar Avatar
                  </button>
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Agente *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Agente de Vendas LinkedIn"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Descreva a finalidade deste agente..."
                />
              </div>

              {/* Tipo de Agente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tipo de Agente *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'purple' },
                    { type: 'email', label: 'Email', icon: Mail, color: 'blue' },
                    { type: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'green' }
                  ].map(({ type, label, icon: Icon, color }) => {
                    const isSelected = formData.agent_type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => updateField('agent_type', type)}
                        className={`p-4 border-2 rounded-lg transition-all ${
                          isSelected
                            ? `border-${color}-600 bg-${color}-50`
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`w-8 h-8 mx-auto mb-2 ${
                          isSelected ? `text-${color}-600` : 'text-gray-400'
                        }`} />
                        <p className={`text-sm font-medium ${
                          isSelected ? `text-${color}-900` : 'text-gray-700'
                        }`}>
                          {label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* LINKEDIN STEPS */}
          {formData.agent_type === 'linkedin' && currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Produtos e Serviços
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Descreva o que sua empresa oferece
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Produtos/Serviços *
                </label>
                <textarea
                  value={formData.config.products_services || ''}
                  onChange={(e) => updateConfig('products_services', e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Descreva seus produtos e serviços..."
                />
              </div>
            </div>
          )}

          {formData.agent_type === 'linkedin' && currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Informações do Negócio
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Conte mais sobre sua empresa (opcional)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição da Empresa
                </label>
                <textarea
                  value={formData.config.company_description || ''}
                  onChange={(e) => updateConfig('company_description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Sobre a empresa..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposta de Valor
                </label>
                <textarea
                  value={formData.config.value_proposition || ''}
                  onChange={(e) => updateConfig('value_proposition', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="O que diferencia sua empresa..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Diferenciais (separados por vírgula)
                </label>
                <input
                  type="text"
                  value={formData.config.key_differentiators || ''}
                  onChange={(e) => updateConfig('key_differentiators', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Qualidade, Suporte 24/7, Garantia vitalícia..."
                />
              </div>
            </div>
          )}

          {formData.agent_type === 'linkedin' && currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Perfil Comportamental
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Escolha como seu agente deve se comunicar
                </p>
              </div>

              {profiles && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(profiles).map(([key, profile]) => {
                    const Icon = iconMap[key] || Bot;
                    const isSelected = formData.config.behavioral_profile === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateConfig('behavioral_profile', key)}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className={`w-6 h-6 flex-shrink-0 ${
                            isSelected ? 'text-purple-600' : 'text-gray-400'
                          }`} />
                          <div className="flex-1">
                            <h4 className={`font-semibold mb-1 ${
                              isSelected ? 'text-purple-900' : 'text-gray-900'
                            }`}>
                              {profile.name}
                            </h4>
                            <p className="text-sm text-gray-600">{profile.description}</p>
                          </div>
                          {isSelected && (
                            <Check className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {formData.agent_type === 'linkedin' && currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Transferir para Humano
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure quando o agente deve passar para atendimento humano
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.config.escalation_rules?.escalate_on_price_question || false}
                    onChange={(e) => updateConfig('escalation_rules', {
                      ...formData.config.escalation_rules,
                      escalate_on_price_question: e.target.checked
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Transferir em perguntas sobre preço</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.config.escalation_rules?.escalate_on_specific_feature || false}
                    onChange={(e) => updateConfig('escalation_rules', {
                      ...formData.config.escalation_rules,
                      escalate_on_specific_feature: e.target.checked
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Transferir em perguntas técnicas específicas</span>
                </label>

                <div>
                  <label className="flex items-center gap-3 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.config.escalation_rules?.enable_max_messages || false}
                      onChange={(e) => updateConfig('escalation_rules', {
                        ...formData.config.escalation_rules,
                        enable_max_messages: e.target.checked
                      })}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Definir o máximo de mensagens antes de transferir para um humano
                    </span>
                  </label>

                  {formData.config.escalation_rules?.enable_max_messages && (
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.config.escalation_rules?.max_messages_before_escalation || 10}
                      onChange={(e) => updateConfig('escalation_rules', {
                        ...formData.config.escalation_rules,
                        max_messages_before_escalation: parseInt(e.target.value) || 10
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Ex: 10"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {formData.agent_type === 'linkedin' && currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Configuração Final
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Abordagem inicial e tamanho de resposta
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Abordagem Inicial *
                </label>
                <textarea
                  value={formData.config.initial_approach || ''}
                  onChange={(e) => updateConfig('initial_approach', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Como o agente deve iniciar uma conversa..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Tamanho das Respostas
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'short', label: 'Curtas', desc: '1-2 linhas' },
                    { value: 'medium', label: 'Médias', desc: '2-4 linhas' },
                    { value: 'long', label: 'Longas', desc: '4-6 linhas' }
                  ].map(({ value, label, desc }) => {
                    const isSelected = formData.response_length === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updateField('response_length', value)}
                        className={`p-3 border-2 rounded-lg transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className={`font-medium ${
                          isSelected ? 'text-purple-900' : 'text-gray-900'
                        }`}>
                          {label}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.config.auto_schedule || false}
                    onChange={(e) => updateConfig('auto_schedule', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Agendar reuniões automaticamente</span>
                </label>

                {formData.config.auto_schedule && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Link de Agendamento
                    </label>
                    <input
                      type="url"
                      value={formData.config.scheduling_link || ''}
                      onChange={(e) => updateConfig('scheduling_link', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://calendly.com/..."
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* GOOGLE MAPS STEPS */}
          {formData.agent_type === 'google_maps' && currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Localização
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Escolha onde buscar estabelecimentos
                </p>
              </div>

              <LocationMapPicker
                initialLocation={formData.config.location}
                onLocationSelect={(location) => updateConfig('location', location)}
              />
            </div>
          )}

          {formData.agent_type === 'google_maps' && currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nicho de Negócio
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Defina o tipo de estabelecimento que quer encontrar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria (opcional)
                </label>
                <select
                  value={formData.config.business_category || ''}
                  onChange={(e) => updateConfig('business_category', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecione uma categoria...</option>
                  {translatedCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Especificação
                </label>
                <input
                  type="text"
                  value={formData.config.business_specification || ''}
                  onChange={(e) => updateConfig('business_specification', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Restaurantes italianos, Academias de crossfit..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Pelo menos um campo (Categoria ou Especificação) é obrigatório
                </p>
              </div>
            </div>
          )}

          {formData.agent_type === 'google_maps' && currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Filtros de Qualidade
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Refine sua busca com critérios específicos (opcional)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avaliação Mínima
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={formData.config.filters?.min_rating || ''}
                    onChange={(e) => updateConfig('filters', {
                      ...formData.config.filters,
                      min_rating: parseFloat(e.target.value) || null
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: 4.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reviews Mínimos
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.config.filters?.min_reviews || ''}
                    onChange={(e) => updateConfig('filters', {
                      ...formData.config.filters,
                      min_reviews: parseInt(e.target.value) || null
                    })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.config.filters?.require_phone || false}
                    onChange={(e) => updateConfig('filters', {
                      ...formData.config.filters,
                      require_phone: e.target.checked
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Apenas com telefone</span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.config.filters?.require_email || false}
                    onChange={(e) => updateConfig('filters', {
                      ...formData.config.filters,
                      require_email: e.target.checked
                    })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">Apenas com email</span>
                </label>
              </div>
            </div>
          )}

          {formData.agent_type === 'google_maps' && currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ações do Agente
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  O que o agente deve fazer com os contatos encontrados
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { value: 'crm_only', label: 'Apenas Salvar no CRM', desc: 'Sem contato automático' },
                  { value: 'crm_email', label: 'CRM + Email', desc: 'Salvar e enviar email' },
                  { value: 'crm_email_whatsapp', label: 'CRM + Email + WhatsApp', desc: 'Contato completo' }
                ].map(({ value, label, desc }) => {
                  const isSelected = formData.config.action_type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateConfig('action_type', value)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-medium ${
                            isSelected ? 'text-purple-900' : 'text-gray-900'
                          }`}>
                            {label}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">{desc}</p>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-purple-600" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {formData.agent_type === 'google_maps' && currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Tamanho das Respostas
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure o tamanho das mensagens automáticas
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'short', label: 'Curtas', desc: '1-2 linhas' },
                  { value: 'medium', label: 'Médias', desc: '2-4 linhas' },
                  { value: 'long', label: 'Longas', desc: '4-6 linhas' }
                ].map(({ value, label, desc }) => {
                  const isSelected = formData.response_length === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('response_length', value)}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`font-medium ${
                        isSelected ? 'text-purple-900' : 'text-gray-900'
                      }`}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* EMAIL/WHATSAPP STEPS */}
          {(formData.agent_type === 'email' || formData.agent_type === 'whatsapp') && currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Personalidade & Tom
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure como o agente deve se comunicar
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tom de Comunicação
                </label>
                <select
                  value={formData.config.tone || 'professional'}
                  onChange={(e) => updateConfig('tone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="professional">Profissional</option>
                  <option value="friendly">Amigável</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma
                </label>
                <select
                  value={formData.config.language || 'pt-BR'}
                  onChange={(e) => updateConfig('language', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="pt-BR">Português (BR)</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personalidade
                </label>
                <textarea
                  value={formData.config.personality || ''}
                  onChange={(e) => updateConfig('personality', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Descreva a personalidade do agente..."
                />
              </div>
            </div>
          )}

          {(formData.agent_type === 'email' || formData.agent_type === 'whatsapp') && currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Mensagens
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure as mensagens automáticas
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem Inicial *
                </label>
                <textarea
                  value={formData.config.initial_message || ''}
                  onChange={(e) => updateConfig('initial_message', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Primeira mensagem enviada ao contato..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mensagem de Follow-up
                </label>
                <textarea
                  value={formData.config.follow_up_message || ''}
                  onChange={(e) => updateConfig('follow_up_message', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Mensagem de acompanhamento..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instruções Customizadas
                </label>
                <textarea
                  value={formData.config.custom_instructions || ''}
                  onChange={(e) => updateConfig('custom_instructions', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="Instruções adicionais para o agente..."
                />
              </div>
            </div>
          )}

          {(formData.agent_type === 'email' || formData.agent_type === 'whatsapp') && currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Tamanho das Respostas
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure o tamanho das mensagens
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'short', label: 'Curtas', desc: '1-2 linhas' },
                  { value: 'medium', label: 'Médias', desc: '2-4 linhas' },
                  { value: 'long', label: 'Longas', desc: '4-6 linhas' }
                ].map(({ value, label, desc }) => {
                  const isSelected = formData.response_length === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateField('response_length', value)}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className={`font-medium ${
                        isSelected ? 'text-purple-900' : 'text-gray-900'
                      }`}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* REVIEW STEP (Last step for all types) */}
          {currentStep === getTotalSteps() && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Revisão
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Confirme as informações do seu agente
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={formData.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{formData.name}</h4>
                      {formData.description && (
                        <p className="text-sm text-gray-600 mt-1">{formData.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Tipo:</span>
                      <span className="ml-2 font-medium text-gray-900 capitalize">
                        {formData.agent_type === 'google_maps' ? 'Google Maps' : formData.agent_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Respostas:</span>
                      <span className="ml-2 font-medium text-gray-900 capitalize">
                        {formData.response_length === 'short' ? 'Curtas' : formData.response_length === 'medium' ? 'Médias' : 'Longas'}
                      </span>
                    </div>
                  </div>
                </div>

                {formData.agent_type === 'linkedin' && formData.config.behavioral_profile && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-purple-900">
                      Perfil: {profiles?.[formData.config.behavioral_profile]?.name}
                    </p>
                  </div>
                )}

                {formData.agent_type === 'google_maps' && formData.config.location && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-green-900">
                      Localização: {formData.config.location.city}, {formData.config.location.country}
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                      Raio: {formData.config.location.radius} km
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}

            {currentStep < getTotalSteps() ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Criando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Criar Agente
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedAgentWizard;
