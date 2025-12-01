import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Check, RefreshCw, Bot, Mail, MessageCircle,
  Linkedin, MapPin, Target, Zap, BookOpen, Smile, Calendar, Phone, UserCheck,
  MessageSquare, TrendingUp, GripVertical, Plus, Trash2, UserX, AlertTriangle,
  Frown, Meh, ThumbsUp, HelpCircle, Tag, Save, Play, Brain, Loader2
} from 'lucide-react';
import api from '../services/api';
import LocationMapPicker from './LocationMapPicker';
import AgentWizardSidebar, { SECTIONS_BY_TYPE } from './AgentWizardSidebar';
import AgentTypeSelector from './AgentTypeSelector';
import SectorSelector from './SectorSelector';
import HandoffConfigSection from './HandoffConfigSection';
import { detectUserLanguage, getTranslatedCategories } from '../data/businessCategories';

const UnifiedAgentWizard = ({ isOpen, onClose, onSubmit, agent = null }) => {
  const [activeSection, setActiveSection] = useState('basic');
  const [sectionStatus, setSectionStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState('');

  // Email settings state
  const [emailSignatures, setEmailSignatures] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(`https://i.pravatar.cc/200?img=${Math.floor(Math.random() * 70) + 1}`);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    avatar_url: avatarUrl,
    agent_type: '',
    response_length: 'medium',
    config: {},
    // Handoff/Transfer config (all agents)
    sector_id: null,
    agent_mode: 'full', // 'full' or 'facilitator'
    handoff_after_exchanges: null,
    handoff_silent: true,
    handoff_message: '',
    notify_on_handoff: true,
    assignee_users: []
  });

  const [errors, setErrors] = useState({});

  const userLang = detectUserLanguage();
  const translatedCategories = getTranslatedCategories(userLang);

  // Load behavioral profiles for LinkedIn agents
  useEffect(() => {
    if (isOpen && !profiles) {
      loadProfiles();
    }
  }, [isOpen]);

  // Load email settings when wizard opens
  useEffect(() => {
    if (isOpen) {
      loadEmailSettings();
    }
  }, [isOpen]);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (agent) {
        // Editing existing agent
        setFormData({
          name: agent.name || '',
          description: agent.description || '',
          avatar_url: agent.avatar_url || avatarUrl,
          agent_type: agent.agent_type || '',
          response_length: agent.response_length || 'medium',
          config: agent.config || {},
          sector_id: agent.sector_id || null,
          agent_mode: agent.agent_mode || 'full',
          handoff_after_exchanges: agent.handoff_after_exchanges || null,
          handoff_silent: agent.handoff_silent !== false,
          handoff_message: agent.handoff_message || '',
          notify_on_handoff: agent.notify_on_handoff !== false,
          assignee_users: agent.assignees || []
        });
        if (agent.avatar_url) {
          setAvatarUrl(agent.avatar_url);
        }
      } else {
        // New agent - reset form
        const newAvatarUrl = `https://i.pravatar.cc/200?img=${Math.floor(Math.random() * 70) + 1}`;
        setFormData({
          name: '',
          description: '',
          avatar_url: newAvatarUrl,
          agent_type: '',
          response_length: 'medium',
          config: {},
          sector_id: null,
          agent_mode: 'full',
          handoff_after_exchanges: null,
          handoff_silent: true,
          handoff_message: '',
          notify_on_handoff: true,
          assignee_users: []
        });
        setAvatarUrl(newAvatarUrl);
      }
      setActiveSection('basic');
      setSectionStatus({});
      setErrors({});
      setError('');
    }
  }, [isOpen, agent]);

  const loadEmailSettings = async () => {
    try {
      const [signaturesRes, templatesRes] = await Promise.all([
        api.getEmailSignatures(),
        api.getEmailTemplates(),
      ]);
      setEmailSignatures(signaturesRes.signatures || []);
      setEmailTemplates(templatesRes.templates || []);
    } catch (err) {
      console.error('Erro ao carregar configurações de email:', err);
    }
  };

  const loadProfiles = async () => {
    try {
      const response = await api.getBehavioralProfiles();
      setProfiles(response.data?.profiles || null);
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
    }
  };

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    // Clear field-specific error
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const updateConfig = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [field]: value
      }
    }));
    setError('');
  }, []);

  // Update handoff config
  const updateHandoffConfig = useCallback((config) => {
    setFormData(prev => ({
      ...prev,
      sector_id: config.sector_id,
      handoff_after_exchanges: config.handoff_after_exchanges,
      handoff_silent: config.handoff_silent,
      handoff_message: config.handoff_message,
      notify_on_handoff: config.notify_on_handoff,
      assignee_users: config.assignee_users || []
    }));
    setErrors(prev => ({ ...prev, sector_id: null, assignee_users: null }));
  }, []);

  const refreshAvatar = () => {
    const newSeed = Math.floor(Math.random() * 70) + 1;
    const newUrl = `https://i.pravatar.cc/200?img=${newSeed}&t=${Date.now()}`;

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

  // Validate specific section
  const validateSection = useCallback((sectionId) => {
    const newErrors = {};

    if (sectionId === 'basic') {
      if (!formData.name.trim()) {
        newErrors.name = 'Nome do agente é obrigatório';
      }
      if (!formData.agent_type) {
        newErrors.agent_type = 'Selecione o tipo de agente';
      }
    }

    if (sectionId === 'transfer') {
      if (!formData.sector_id) {
        newErrors.sector_id = 'Setor é obrigatório';
      }
      if (formData.agent_type === 'facilitador' || formData.agent_mode === 'facilitator') {
        if (!formData.handoff_after_exchanges || formData.handoff_after_exchanges < 1) {
          newErrors.handoff_after_exchanges = 'Número de interações é obrigatório para agente facilitador';
        }
      }
      if (!formData.handoff_silent && !formData.handoff_message?.trim()) {
        newErrors.handoff_message = 'Mensagem de transferência é obrigatória quando não silenciosa';
      }
    }

    if (sectionId === 'ai_config' && formData.agent_type === 'linkedin') {
      if (!formData.config.products_services) {
        newErrors.products_services = 'Descreva seus produtos/serviços';
      }
      if (!formData.config.objective) {
        newErrors.objective = 'Selecione o objetivo principal';
      }
      if (!formData.config.behavioral_profile) {
        newErrors.behavioral_profile = 'Selecione um perfil comportamental';
      }
    }

    if (sectionId === 'location' && formData.agent_type === 'google_maps') {
      if (!formData.config.location?.lat) {
        newErrors.location = 'Selecione uma localização no mapa';
      }
    }

    if (sectionId === 'business' && formData.agent_type === 'google_maps') {
      if (!formData.config.business_category && !formData.config.business_specification) {
        newErrors.business = 'Preencha categoria OU especificação';
      }
    }

    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Validate all required sections
  const validateAll = useCallback(() => {
    const sections = SECTIONS_BY_TYPE[formData.agent_type] || [];
    let allValid = true;
    const newStatus = {};

    for (const section of sections) {
      if (section.id === 'test') continue; // Skip test section
      const isValid = validateSection(section.id);
      newStatus[section.id] = isValid ? 'complete' : 'error';
      if (!isValid) allValid = false;
    }

    setSectionStatus(newStatus);
    return allValid;
  }, [formData.agent_type, validateSection]);

  const handleSubmit = async () => {
    if (!validateAll()) {
      setError('Por favor, corrija os erros antes de salvar');
      return;
    }

    try {
      setLoading(true);

      // Build final payload
      const payload = {
        name: formData.name.trim(),
        description: formData.description || null,
        avatar_url: formData.avatar_url,
        agent_type: formData.agent_type,
        response_length: formData.response_length,
        config: formData.config,
        // Handoff config
        sector_id: formData.sector_id,
        agent_mode: formData.agent_type === 'facilitador' ? 'facilitator' : formData.agent_mode,
        handoff_after_exchanges: formData.handoff_after_exchanges,
        handoff_silent: formData.handoff_silent,
        handoff_message: formData.handoff_message || null,
        notify_on_handoff: formData.notify_on_handoff,
        assignee_user_ids: formData.assignee_users?.map(u => u.id) || []
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
    setActiveSection('basic');
    setSectionStatus({});
    setErrors({});
    setError('');
    onClose();
  };

  const iconMap = {
    consultivo: Target,
    direto: Zap,
    educativo: BookOpen,
    amigavel: Smile
  };

  if (!isOpen) return null;

  // Get handoff config object for HandoffConfigSection
  const handoffConfig = {
    sector_id: formData.sector_id,
    handoff_after_exchanges: formData.handoff_after_exchanges,
    handoff_silent: formData.handoff_silent,
    handoff_message: formData.handoff_message,
    notify_on_handoff: formData.notify_on_handoff,
    assignee_users: formData.assignee_users
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-lg">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {agent ? 'Editar Agente' : 'Novo Agente de IA'}
              </h2>
              <p className="text-xs text-gray-500">
                Configure seu agente inteligente
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-52 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-2 overflow-y-auto hidden sm:block">
            <AgentWizardSidebar
              agentType={formData.agent_type}
              activeSection={activeSection}
              sectionStatus={sectionStatus}
              onSectionChange={setActiveSection}
              disabled={!formData.agent_type && activeSection !== 'basic'}
            />
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {/* BASIC SECTION */}
            {activeSection === 'basic' && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Bot className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Informações Básicas
                    </h3>
                    <p className="text-xs text-gray-500">
                      Nome, avatar e tipo do agente
                    </p>
                  </div>
                </div>

                {/* Avatar */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {avatarError ? (
                      <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center">
                        <Bot className="w-7 h-7 text-gray-400" />
                      </div>
                    ) : (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        key={avatarUrl}
                        className="w-14 h-14 rounded-full transition-opacity duration-300 ease-in-out border-2 border-gray-200"
                        onLoad={() => { setAvatarLoading(false); setAvatarError(false); }}
                        onError={() => { setAvatarLoading(false); setAvatarError(true); }}
                        style={{ opacity: avatarLoading ? 0.5 : 1 }}
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Avatar do Agente</p>
                    <button
                      type="button"
                      onClick={refreshAvatar}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Trocar Avatar
                    </button>
                  </div>
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nome do Agente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                      errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                    }`}
                    placeholder="Ex: Agente de Vendas LinkedIn"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                  )}
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                    placeholder="Descreva a finalidade deste agente..."
                  />
                </div>

                {/* Tipo de Agente */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Tipo de Agente <span className="text-red-500">*</span>
                  </label>
                  <AgentTypeSelector
                    value={formData.agent_type}
                    onChange={(type) => {
                      updateField('agent_type', type);
                      // Set default mode for facilitador
                      if (type === 'facilitador') {
                        updateField('agent_mode', 'facilitator');
                        updateField('handoff_after_exchanges', 2);
                      }
                    }}
                    showFeatures={true}
                    compact={false}
                  />
                  {errors.agent_type && (
                    <p className="mt-1 text-xs text-red-600">{errors.agent_type}</p>
                  )}
                </div>
              </div>
            )}

            {/* AI CONFIG SECTION (LinkedIn, WhatsApp, Email) */}
            {activeSection === 'ai_config' && ['linkedin', 'whatsapp', 'email'].includes(formData.agent_type) && (
              <div className="space-y-4 max-w-4xl">
                <div className="flex items-center gap-2 pb-3 border-b border-gray-200">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Brain className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Configuração de IA
                    </h3>
                    <p className="text-xs text-gray-500">
                      Defina o comportamento e personalidade do agente
                    </p>
                  </div>
                </div>

                {/* LinkedIn specific AI config */}
                {formData.agent_type === 'linkedin' && (
                  <>
                    {/* Products/Services */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Produtos/Serviços <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={formData.config.products_services || ''}
                        onChange={(e) => updateConfig('products_services', e.target.value)}
                        rows={3}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none ${
                          errors.products_services ? 'border-red-300 bg-red-50' : 'border-gray-300'
                        }`}
                        placeholder="Descreva seus produtos e serviços..."
                      />
                      {errors.products_services && (
                        <p className="mt-1 text-xs text-red-600">{errors.products_services}</p>
                      )}
                    </div>

                    {/* Objective */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Objetivo Principal <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          { value: 'schedule_meeting', label: 'Agendar Reunião', desc: 'Marcar call ou demonstração', icon: Calendar },
                          { value: 'qualify_lead', label: 'Qualificar Lead', desc: 'Descobrir se é potencial cliente', icon: UserCheck },
                          { value: 'generate_interest', label: 'Gerar Interesse', desc: 'Despertar curiosidade sobre produto', icon: TrendingUp },
                          { value: 'get_contact', label: 'Obter Contato', desc: 'Conseguir email ou telefone', icon: Phone },
                          { value: 'start_conversation', label: 'Iniciar Conversa', desc: 'Criar relacionamento inicial', icon: MessageSquare },
                          { value: 'direct_sale', label: 'Venda Direta', desc: 'Fechar negócio pelo chat', icon: Target }
                        ].map(({ value, label, desc, icon: Icon }) => {
                          const isSelected = formData.config.objective === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => updateConfig('objective', value)}
                              className={`p-2.5 border-2 rounded-lg text-left transition-all ${
                                isSelected
                                  ? 'border-purple-600 bg-purple-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                  isSelected ? 'text-purple-600' : 'text-gray-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-xs font-medium truncate ${
                                    isSelected ? 'text-purple-900' : 'text-gray-900'
                                  }`}>
                                    {label}
                                  </h4>
                                  <p className="text-[10px] text-gray-500 truncate">{desc}</p>
                                </div>
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {errors.objective && (
                        <p className="mt-1 text-xs text-red-600">{errors.objective}</p>
                      )}
                    </div>

                    {/* Behavioral Profile */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">
                        Perfil Comportamental <span className="text-red-500">*</span>
                      </label>
                      {profiles ? (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(profiles).map(([key, profile]) => {
                            const Icon = iconMap[key] || Bot;
                            const isSelected = formData.config.behavioral_profile === key;

                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => updateConfig('behavioral_profile', key)}
                                className={`p-2.5 border-2 rounded-lg text-left transition-all ${
                                  isSelected
                                    ? 'border-purple-600 bg-purple-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <Icon className={`w-4 h-4 flex-shrink-0 ${
                                    isSelected ? 'text-purple-600' : 'text-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-xs font-semibold ${
                                      isSelected ? 'text-purple-900' : 'text-gray-900'
                                    }`}>
                                      {profile.name}
                                    </h4>
                                    <p className="text-[10px] text-gray-600 line-clamp-2">{profile.description}</p>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-purple-600" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg">
                          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                          <span className="text-gray-500">Carregando perfis...</span>
                        </div>
                      )}
                      {errors.behavioral_profile && (
                        <p className="mt-2 text-sm text-red-600">{errors.behavioral_profile}</p>
                      )}
                    </div>

                    {/* Initial Approach */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Abordagem Inicial
                      </label>
                      <textarea
                        value={formData.config.initial_approach || ''}
                        onChange={(e) => updateConfig('initial_approach', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                        placeholder="Olá {{primeiro_nome}}, tudo bem?&#10;&#10;Vi que você trabalha na {{empresa}} como {{cargo}}..."
                      />
                      <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <p className="text-xs font-medium text-purple-800 mb-2">Variáveis disponíveis:</p>
                        <div className="flex flex-wrap gap-2">
                          {['{{primeiro_nome}}', '{{nome}}', '{{empresa}}', '{{cargo}}', '{{setor}}', '{{localizacao}}'].map((v) => (
                            <span key={v} className="px-2 py-1 text-xs bg-white border border-purple-200 rounded font-mono text-purple-700">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Response Length */}
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
                              <p className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
                                {label}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">{desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* WhatsApp/Email AI config */}
                {(formData.agent_type === 'whatsapp' || formData.agent_type === 'email') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tom de Comunicação
                      </label>
                      <select
                        value={formData.config.tone || 'professional'}
                        onChange={(e) => updateConfig('tone', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="professional">Profissional</option>
                        <option value="friendly">Amigável</option>
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="Descreva a personalidade do agente..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensagem Inicial
                      </label>
                      <textarea
                        value={formData.config.initial_message || ''}
                        onChange={(e) => updateConfig('initial_message', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                        placeholder="Primeira mensagem enviada ao contato..."
                      />
                    </div>

                    {/* Response Length */}
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
                              <p className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
                                {label}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">{desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* EMAIL SETTINGS SECTION */}
            {activeSection === 'email_settings' && formData.agent_type === 'email' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Configurações de Email
                    </h3>
                    <p className="text-sm text-gray-500">
                      Personalize como seus emails serão enviados
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assinatura de Email
                  </label>
                  <select
                    value={formData.config.email_config?.signature_id || ''}
                    onChange={(e) => updateConfig('email_config', {
                      ...formData.config.email_config,
                      signature_id: e.target.value || null,
                      include_signature: !!e.target.value
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Sem assinatura</option>
                    {emailSignatures.map((sig) => (
                      <option key={sig.id} value={sig.id}>{sig.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Base (opcional)
                  </label>
                  <select
                    value={formData.config.email_config?.template_id || ''}
                    onChange={(e) => updateConfig('email_config', {
                      ...formData.config.email_config,
                      template_id: e.target.value || null
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Nenhum template</option>
                    {emailTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estilo de Saudação
                  </label>
                  <select
                    value={formData.config.email_config?.greeting_style || 'name'}
                    onChange={(e) => updateConfig('email_config', {
                      ...formData.config.email_config,
                      greeting_style: e.target.value
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="name">Pelo Nome (Olá João)</option>
                    <option value="title">Pelo Cargo (Prezado Diretor)</option>
                    <option value="generic">Genérico (Olá!)</option>
                    <option value="formal">Formal (Prezado(a) Senhor(a))</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estilo de Encerramento
                  </label>
                  <select
                    value={formData.config.email_config?.closing_style || 'best_regards'}
                    onChange={(e) => updateConfig('email_config', {
                      ...formData.config.email_config,
                      closing_style: e.target.value
                    })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="best_regards">Atenciosamente</option>
                    <option value="thanks">Obrigado(a)</option>
                    <option value="sincerely">Cordialmente</option>
                    <option value="warm_regards">Abraços</option>
                    <option value="cheers">Até mais</option>
                  </select>
                </div>
              </div>
            )}

            {/* TRANSFER SECTION (All agent types) */}
            {activeSection === 'transfer' && (
              <div className="max-w-3xl">
                <HandoffConfigSection
                  agentType={formData.agent_type}
                  config={handoffConfig}
                  onChange={updateHandoffConfig}
                  errors={errors}
                  disabled={loading}
                />
              </div>
            )}

            {/* KNOWLEDGE BASE SECTION */}
            {activeSection === 'knowledge' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Base de Conhecimento
                    </h3>
                    <p className="text-sm text-gray-500">
                      Adicione informações para o agente usar nas conversas
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">
                    A base de conhecimento pode ser configurada após criar o agente
                  </p>
                  <p className="text-sm text-gray-500">
                    Você poderá adicionar documentos, FAQs e informações que o agente usará para responder
                  </p>
                </div>
              </div>
            )}

            {/* GOOGLE MAPS - Location Section */}
            {activeSection === 'location' && formData.agent_type === 'google_maps' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Localização
                    </h3>
                    <p className="text-sm text-gray-500">
                      Escolha onde buscar estabelecimentos
                    </p>
                  </div>
                </div>

                <LocationMapPicker
                  initialLocation={formData.config.location}
                  onLocationSelect={(location) => updateConfig('location', location)}
                />
                {errors.location && (
                  <p className="text-sm text-red-600">{errors.location}</p>
                )}
              </div>
            )}

            {/* GOOGLE MAPS - Business Section */}
            {activeSection === 'business' && formData.agent_type === 'google_maps' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Nicho de Negócio
                    </h3>
                    <p className="text-sm text-gray-500">
                      Defina o tipo de estabelecimento que quer encontrar
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Categoria (opcional)
                  </label>
                  <select
                    value={formData.config.business_category || ''}
                    onChange={(e) => updateConfig('business_category', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Restaurantes italianos, Academias de crossfit..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Pelo menos um campo (Categoria ou Especificação) é obrigatório
                  </p>
                </div>
                {errors.business && (
                  <p className="text-sm text-red-600">{errors.business}</p>
                )}
              </div>
            )}

            {/* GOOGLE MAPS - Filters Section */}
            {activeSection === 'filters' && formData.agent_type === 'google_maps' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Tag className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Filtros de Qualidade
                    </h3>
                    <p className="text-sm text-gray-500">
                      Refine sua busca com critérios específicos (opcional)
                    </p>
                  </div>
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

            {/* GOOGLE MAPS - Actions Section */}
            {activeSection === 'actions' && formData.agent_type === 'google_maps' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Zap className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Ações do Agente
                    </h3>
                    <p className="text-sm text-gray-500">
                      O que o agente deve fazer com os contatos encontrados
                    </p>
                  </div>
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
                            <p className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-900'}`}>
                              {label}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{desc}</p>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-purple-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TEST SECTION */}
            {activeSection === 'test' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Play className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Modo Teste
                    </h3>
                    <p className="text-sm text-gray-500">
                      Teste seu agente antes de ativá-lo
                    </p>
                  </div>
                </div>

                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <Play className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">
                    O modo de teste estará disponível após criar o agente
                  </p>
                  <p className="text-sm text-gray-500">
                    Você poderá simular conversas e verificar as respostas do agente
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {/* Error Display */}
          {error && (
            <div className="flex-1 mx-3">
              <div className="p-1.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs text-center">
                {error}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !formData.agent_type}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {agent ? 'Salvar Alterações' : 'Criar Agente'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedAgentWizard;
