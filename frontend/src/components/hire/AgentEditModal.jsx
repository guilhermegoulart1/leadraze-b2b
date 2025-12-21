import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Package, Target, MessageSquare, BookOpen, Check, Save,
  Laptop, Briefcase, Wrench, Package as PackageIcon, GraduationCap,
  HeartPulse, Landmark, Megaphone, Cpu, Factory, ShoppingBag, Home,
  User, Users, UserCog, UserCheck, Building,
  UserPlus, MessageSquarePlus, Hand, Calendar, Filter, ShoppingCart,
  Shield, Linkedin, RefreshCw, Upload, Globe
} from 'lucide-react';
import api from '../../services/api';

// Lista de idiomas disponíveis para o agente
const AVAILABLE_LANGUAGES = [
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'pt-PT', name: 'Português (Portugal)' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'de', name: 'Deutsch' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'hi', name: 'हिन्दी' }
];
import {
  CONNECTION_STRATEGIES,
  CONVERSATION_STYLES,
  OBJECTIVES,
  SALES_METHODOLOGIES,
  TRANSFER_TRIGGERS,
  CONVERSATION_STEP_TEMPLATES,
  TRANSFER_MESSAGE_TEMPLATES
} from './salesRepTemplates';
import { ArrowRightLeft, ListOrdered, Settings, ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown, Copy, Eye } from 'lucide-react';

const SECTIONS = {
  PROFILE: 'profile',
  LANGUAGE: 'language',
  PRODUCT: 'product',
  TARGET: 'target',
  STYLE: 'style',
  METHODOLOGY: 'methodology',
  OBJECTIVE: 'objective',
  STEPS: 'steps',
  TRANSFER: 'transfer',
  LINKEDIN: 'linkedin',
  ADVANCED: 'advanced'
};

// Unsplash professional portrait photo IDs for random selection
const UNSPLASH_PHOTO_IDS = [
  '1507003211169-0a1dd7228f2d', '1472099645785-5658abf4ff4e', '1519085360753-af0119f7cbe7',
  '1500648767791-00dcc994a43e', '1506794778202-cad84cf45f1d', '1560250097-0b93528c311a',
  '1573496359142-b8d87734a5a2', '1580489944761-15a19d654956', '1494790108377-be9c29b29330',
  '1438761681033-6461ffad8d80', '1534528741775-53994a69daeb', '1573497019940-1c28c88b4f3e'
];

const getRandomUnsplashUrl = (currentUrl = null) => {
  let availableIds = UNSPLASH_PHOTO_IDS;
  if (currentUrl && currentUrl.includes('unsplash.com')) {
    availableIds = UNSPLASH_PHOTO_IDS.filter(id => !currentUrl.includes(id));
  }
  if (availableIds.length === 0) availableIds = UNSPLASH_PHOTO_IDS;
  const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
  return `https://images.unsplash.com/photo-${randomId}?w=200&h=200&fit=crop&crop=face`;
};

const AgentEditModal = ({ isOpen, onClose, agent, onSaved }) => {
  const { t } = useTranslation(['hire', 'agents']);
  const [activeSection, setActiveSection] = useState(SECTIONS.PRODUCT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    avatarUrl: null,
    language: localStorage.getItem('i18nextLng') || 'pt-BR',
    productService: { categories: [], description: '' },
    targetAudience: { roles: [], companySizes: [], industry: '' },
    conversationStyle: 'consultivo',
    methodology: null,
    objective: 'qualify_transfer',
    maxMessages: 3,
    schedulingLink: '',
    connectionStrategy: 'with-intro',
    inviteMessage: '',
    postAcceptMessage: '',
    priorityRules: [],
    waitTimeAfterAccept: 5,
    requireLeadReply: false,
    transferTriggers: ['qualified', 'price', 'demo'],
    conversationSteps: [],
    objectiveInstructions: '',
    transferMode: 'notify',
    transferMessage: ''
  });

  // Populate form when agent changes
  useEffect(() => {
    if (isOpen && agent) {
      console.log('Loading agent data:', agent);
      console.log('🔍 post_accept_message from agent:', agent.post_accept_message);
      // Parse products_services
      let productService = { categories: [], description: '' };
      if (agent.products_services) {
        if (typeof agent.products_services === 'string') {
          try {
            productService = JSON.parse(agent.products_services);
          } catch {
            productService = { categories: [], description: agent.products_services };
          }
        } else {
          productService = agent.products_services;
        }
      }

      // Parse target_audience
      let targetAudience = { roles: [], companySizes: [], industry: '' };
      if (agent.target_audience) {
        if (typeof agent.target_audience === 'string') {
          try {
            targetAudience = JSON.parse(agent.target_audience);
          } catch {
            targetAudience = { roles: [], companySizes: [], industry: agent.target_audience };
          }
        } else {
          targetAudience = agent.target_audience;
        }
      }

      // Parse priority_rules
      let priorityRules = [];
      if (agent.priority_rules) {
        if (typeof agent.priority_rules === 'string') {
          try {
            priorityRules = JSON.parse(agent.priority_rules);
          } catch {
            priorityRules = [];
          }
        } else {
          priorityRules = agent.priority_rules;
        }
      }

      // Extract methodology and objective from config if stored there
      // Config can be a string (from JSON column) or already parsed object
      let agentConfig = {};
      if (agent.config) {
        if (typeof agent.config === 'string') {
          try {
            agentConfig = JSON.parse(agent.config);
          } catch {
            agentConfig = {};
          }
        } else {
          agentConfig = agent.config;
        }
      }
      console.log('Parsed agentConfig:', agentConfig);

      // Parse conversation_steps
      let conversationSteps = [];
      console.log('📥 Loading agent conversation_steps raw:', agent.conversation_steps);
      if (agent.conversation_steps) {
        if (typeof agent.conversation_steps === 'string') {
          try {
            conversationSteps = JSON.parse(agent.conversation_steps);
          } catch {
            conversationSteps = [];
          }
        } else {
          conversationSteps = agent.conversation_steps;
        }
      }
      console.log('📥 Parsed conversation_steps:', conversationSteps);

      setFormData({
        name: agent.name || '',
        avatarUrl: agent.avatar_url || null,
        language: agent.language || localStorage.getItem('i18nextLng') || 'pt-BR',
        productService,
        targetAudience,
        conversationStyle: agent.behavioral_profile || 'consultivo',
        methodology: agentConfig.methodology_template_id || null,
        objective: agentConfig.objective || 'qualify_transfer',
        maxMessages: agentConfig.max_messages_before_escalation || 3,
        schedulingLink: agent.scheduling_link || '',
        connectionStrategy: agent.connection_strategy || 'with-intro',
        inviteMessage: agent.invite_message || agent.initial_approach || '',
        postAcceptMessage: agent.post_accept_message || '',
        priorityRules,
        waitTimeAfterAccept: agent.wait_time_after_accept || 5,
        requireLeadReply: agent.require_lead_reply || false,
        transferTriggers: agent.transfer_triggers || agentConfig.transfer_triggers || ['qualified', 'price', 'demo'],
        conversationSteps,
        objectiveInstructions: agent.objective_instructions || '',
        transferMode: agent.transfer_mode || 'notify',
        transferMessage: agent.transfer_message || ''
      });
      setHasChanges(false);
      setActiveSection(SECTIONS.PROFILE);
    }
  }, [isOpen, agent]);

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Build agent data with only fields that exist in the database
      const agentData = {
        name: formData.name,
        avatar_url: formData.avatarUrl,
        language: formData.language,
        products_services: formData.productService,
        behavioral_profile: formData.conversationStyle,
        target_audience: formData.targetAudience,
        connection_strategy: formData.connectionStrategy,
        invite_message: formData.inviteMessage,
        post_accept_message: formData.postAcceptMessage || null,
        initial_approach: formData.inviteMessage || null,
        scheduling_link: formData.schedulingLink,
        priority_rules: formData.priorityRules,
        wait_time_after_accept: formData.waitTimeAfterAccept || 5,
        require_lead_reply: formData.requireLeadReply || false,
        transfer_triggers: formData.transferTriggers || [],
        conversation_steps: formData.conversationSteps || [],
        objective_instructions: formData.objectiveInstructions || null,
        transfer_mode: formData.transferMode || 'notify',
        transfer_message: formData.transferMessage || null,
        // Store methodology, objective and other wizard settings in config JSON
        config: {
          methodology_template_id: formData.methodology,
          objective: formData.objective,
          max_messages_before_escalation: formData.maxMessages || 3,
          transfer_triggers: formData.transferTriggers || [],
          escalate_on_price_question: formData.objective === 'qualify_transfer',
          escalate_on_specific_feature: true,
          escalate_keywords: ['preço', 'quanto custa', 'demo', 'reunião', 'proposta']
        }
      };

      console.log('🔄 Saving agent with conversation_steps:', agentData.conversation_steps);
      const result = await api.updateAIAgent(agent.id, agentData);
      console.log('✅ Agent saved, response:', result.data?.conversation_steps);
      setHasChanges(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Error saving agent:', err);
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setIsLoading(false);
    }
  };

  // Get agent channel type
  const agentChannel = agent?.agent_type || 'linkedin';
  const isLinkedIn = agentChannel === 'linkedin';

  // Sidebar sections config - filter based on channel
  const sections = [
    { id: SECTIONS.PROFILE, icon: User, label: 'Perfil' },
    { id: SECTIONS.LANGUAGE, icon: Globe, label: 'Idioma' },
    { id: SECTIONS.PRODUCT, icon: Package, label: 'Produto' },
    { id: SECTIONS.TARGET, icon: Target, label: 'Público-alvo' },
    { id: SECTIONS.STYLE, icon: MessageSquare, label: 'Estilo' },
    { id: SECTIONS.METHODOLOGY, icon: BookOpen, label: 'Metodologia' },
    { id: SECTIONS.OBJECTIVE, icon: Check, label: 'Objetivo' },
    { id: SECTIONS.STEPS, icon: ListOrdered, label: 'Etapas' },
    { id: SECTIONS.TRANSFER, icon: ArrowRightLeft, label: 'Transferência' },
    // Only show LinkedIn section for LinkedIn agents
    ...(isLinkedIn ? [{ id: SECTIONS.LINKEDIN, icon: Linkedin, label: 'LinkedIn' }] : []),
    { id: SECTIONS.ADVANCED, icon: Settings, label: 'Avançado' }
  ];

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {formData.avatarUrl ? (
                <img
                  src={formData.avatarUrl}
                  alt={formData.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                formData.name?.[0] || 'A'
              )}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {formData.name || 'Vendedor'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Editando configurações
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-gray-200 dark:border-gray-700 p-1.5 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeSection === SECTIONS.PROFILE && (
              <ProfileSection
                name={formData.name}
                avatarUrl={formData.avatarUrl}
                onChangeName={(value) => updateFormData('name', value)}
                onChangeAvatar={(value) => updateFormData('avatarUrl', value)}
              />
            )}

            {activeSection === SECTIONS.LANGUAGE && (
              <LanguageSection
                selected={formData.language}
                onChange={(value) => updateFormData('language', value)}
              />
            )}

            {activeSection === SECTIONS.PRODUCT && (
              <ProductSection
                data={formData.productService}
                onChange={(value) => updateFormData('productService', value)}
              />
            )}

            {activeSection === SECTIONS.TARGET && (
              <TargetSection
                data={formData.targetAudience}
                onChange={(value) => updateFormData('targetAudience', value)}
              />
            )}

            {activeSection === SECTIONS.STYLE && (
              <StyleSection
                selected={formData.conversationStyle}
                onChange={(value) => updateFormData('conversationStyle', value)}
              />
            )}

            {activeSection === SECTIONS.METHODOLOGY && (
              <MethodologySection
                selected={formData.methodology}
                onChange={(value) => updateFormData('methodology', value)}
              />
            )}

            {activeSection === SECTIONS.OBJECTIVE && (
              <ObjectiveSection
                selected={formData.objective}
                maxMessages={formData.maxMessages}
                schedulingLink={formData.schedulingLink}
                onChange={(key, value) => updateFormData(key, value)}
              />
            )}

            {activeSection === SECTIONS.STEPS && (
              <ConversationStepsSection
                steps={formData.conversationSteps}
                objective={formData.objective}
                onChange={(value) => updateFormData('conversationSteps', value)}
              />
            )}

            {activeSection === SECTIONS.TRANSFER && (
              <TransferSection
                transferTriggers={formData.transferTriggers}
                transferMode={formData.transferMode}
                transferMessage={formData.transferMessage}
                onChange={(key, value) => updateFormData(key, value)}
              />
            )}

            {isLinkedIn && activeSection === SECTIONS.LINKEDIN && (
              <LinkedInSection
                connectionStrategy={formData.connectionStrategy}
                inviteMessage={formData.inviteMessage}
                postAcceptMessage={formData.postAcceptMessage}
                onChange={(key, value) => updateFormData(key, value)}
              />
            )}

            {activeSection === SECTIONS.ADVANCED && (
              <AdvancedSection
                objectiveInstructions={formData.objectiveInstructions}
                agentId={agent?.id}
                onChange={(value) => updateFormData('objectiveInstructions', value)}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {hasChanges && !error && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Alterações não salvas
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ SECTION COMPONENTS ============

const ProfileSection = ({ name, avatarUrl, onChangeName, onChangeAvatar }) => {
  const fileInputRef = useRef(null);

  const handleRefreshAvatar = () => {
    const newUrl = getRandomUnsplashUrl(avatarUrl);
    onChangeAvatar(newUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onChangeAvatar(event.target.result);
    };
    reader.onerror = () => {
      alert('Erro ao ler a imagem');
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Perfil do Vendedor
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Personalize o nome e a aparência do seu vendedor.
        </p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        {/* Avatar Preview */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-purple-100 dark:ring-purple-900/30 bg-gradient-to-br from-purple-500 to-blue-600">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name || 'Avatar'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="w-full h-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ display: avatarUrl ? 'none' : 'flex' }}
            >
              {name?.[0]?.toUpperCase() || 'V'}
            </div>
          </div>
        </div>

        {/* Avatar Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAvatar}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Outra foto
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Enviar imagem
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Info Note */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-sm">
          Esta imagem será usada apenas para sua identificação interna. Os contatos receberão a foto do perfil normal de cada canal (LinkedIn, WhatsApp, etc).
        </p>
      </div>

      {/* Name Input */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Nome do vendedor
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Ex: Alex, Sophia, Sales Rep..."
        />
      </div>
    </div>
  );
};

const LanguageSection = ({ selected, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Idioma de Resposta
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Em qual idioma o vendedor deve responder aos leads?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {AVAILABLE_LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChange(lang.code)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className={`w-4 h-4 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {lang.name}
                  </span>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Importante:</strong> O vendedor sempre responderá neste idioma, mesmo que o lead escreva em outro idioma.
        </p>
      </div>
    </div>
  );
};

const ProductSection = ({ data, onChange }) => {
  const { t } = useTranslation('hire');
  const productData = data || { categories: [], description: '' };

  const categories = [
    { icon: Laptop, key: 'software', group: 'type' },
    { icon: Briefcase, key: 'consulting', group: 'type' },
    { icon: Wrench, key: 'services', group: 'type' },
    { icon: PackageIcon, key: 'products', group: 'type' },
    { icon: GraduationCap, key: 'education', group: 'type' },
    { icon: HeartPulse, key: 'health', group: 'segment' },
    { icon: Landmark, key: 'finance', group: 'segment' },
    { icon: Megaphone, key: 'marketing', group: 'segment' },
    { icon: Cpu, key: 'technology', group: 'segment' },
    { icon: Factory, key: 'industrial', group: 'segment' },
    { icon: ShoppingBag, key: 'retail', group: 'segment' },
    { icon: Home, key: 'realestate', group: 'segment' }
  ];

  const toggleCategory = (key) => {
    const newCategories = productData.categories.includes(key)
      ? productData.categories.filter(c => c !== key)
      : [...productData.categories, key];
    onChange({ ...productData, categories: newCategories });
  };

  const typeCategories = categories.filter(c => c.group === 'type');
  const segmentCategories = categories.filter(c => c.group === 'segment');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Produto/Serviço
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          O que você vende? Selecione as categorias e descreva.
        </p>
      </div>

      {/* Type categories */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Tipo de oferta
        </label>
        <div className="flex flex-wrap gap-1.5">
          {typeCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = productData.categories.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`product.categories.${cat.key}`, { defaultValue: cat.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segment categories */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Segmento
        </label>
        <div className="flex flex-wrap gap-1.5">
          {segmentCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = productData.categories.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`product.categories.${cat.key}`, { defaultValue: cat.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Descrição
        </label>
        <textarea
          value={productData.description}
          onChange={(e) => onChange({ ...productData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Descreva brevemente o que você vende..."
        />
      </div>
    </div>
  );
};

const TargetSection = ({ data, onChange }) => {
  const { t } = useTranslation('hire');
  const targetData = data || { roles: [], companySizes: [], industry: '' };

  const roles = [
    { icon: User, key: 'ceo' },
    { icon: UserCog, key: 'director' },
    { icon: UserCheck, key: 'manager' },
    { icon: Users, key: 'coordinator' },
    { icon: Building, key: 'owner' }
  ];

  const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

  const toggleRole = (key) => {
    const newRoles = targetData.roles.includes(key)
      ? targetData.roles.filter(r => r !== key)
      : [...targetData.roles, key];
    onChange({ ...targetData, roles: newRoles });
  };

  const toggleCompanySize = (size) => {
    const newSizes = targetData.companySizes.includes(size)
      ? targetData.companySizes.filter(s => s !== size)
      : [...targetData.companySizes, size];
    onChange({ ...targetData, companySizes: newSizes });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Público-alvo
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Para quem você quer vender?
        </p>
      </div>

      {/* Roles */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Cargos
        </label>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = targetData.roles.includes(role.key);
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => toggleRole(role.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`target.roles.${role.key}`, { defaultValue: role.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company sizes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Tamanho da empresa
        </label>
        <div className="flex flex-wrap gap-1.5">
          {companySizes.map((size) => {
            const isSelected = targetData.companySizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleCompanySize(size)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Industry */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Setor/Indústria
        </label>
        <input
          type="text"
          value={targetData.industry}
          onChange={(e) => onChange({ ...targetData, industry: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Ex: Tecnologia, Saúde, Varejo..."
        />
      </div>
    </div>
  );
};

const StyleSection = ({ selected, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Estilo de Conversa
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Como seu vendedor deve se comunicar?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CONVERSATION_STYLES.map((style) => {
          const isSelected = selected === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  {style.name}
                </h4>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {style.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MethodologySection = ({ selected, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Metodologia de Vendas
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Qual framework seu vendedor deve seguir? (Opcional)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SALES_METHODOLOGIES.map((method) => {
          const isSelected = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onChange(isSelected ? null : method.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  {method.name}
                </h4>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {method.shortDescription}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Remover metodologia
        </button>
      )}
    </div>
  );
};

const ObjectiveSection = ({ selected, maxMessages, schedulingLink, onChange }) => {
  const iconMap = {
    UserPlus: UserPlus,
    Filter: Filter,
    Calendar: Calendar,
    ShoppingCart: ShoppingCart
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Objetivo
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          O que seu vendedor deve buscar alcançar?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OBJECTIVES.map((obj) => {
          const Icon = iconMap[obj.icon] || Check;
          const isSelected = selected === obj.id;
          return (
            <button
              key={obj.id}
              type="button"
              onClick={() => onChange('objective', obj.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {obj.name}
                  </h4>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {obj.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Conditional fields */}
      {selected === 'qualify_transfer' && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Máximo de mensagens antes de transferir
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={maxMessages}
            onChange={(e) => onChange('maxMessages', parseInt(e.target.value) || 3)}
            className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      )}

      {selected === 'schedule_meeting' && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Link de agendamento (Calendly, Cal.com, etc)
          </label>
          <input
            type="url"
            value={schedulingLink}
            onChange={(e) => onChange('schedulingLink', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="https://calendly.com/seu-link"
          />
        </div>
      )}

    </div>
  );
};

const LinkedInSection = ({ connectionStrategy, inviteMessage, postAcceptMessage, onChange }) => {
  const iconMap = {
    UserPlus: UserPlus,
    MessageSquarePlus: MessageSquarePlus,
    HandWaving: Hand
  };

  // Default messages for each strategy (same as in ConnectionStrategyStep)
  const defaultMessages = {
    'with-intro': `Oi {{first_name}}, tudo bem?

Vi que você trabalha com {{title}} na {{company}}.
Tenho ajudado empresas como a sua a [benefício].

Aceita conectar?`,
    'icebreaker': 'Oi {{first_name}}, tudo bem?',
    'silent': ''
  };

  const handleStrategyChange = (strategyId) => {
    onChange('connectionStrategy', strategyId);
    // Update invite message to default when strategy changes
    if (strategyId !== connectionStrategy) {
      onChange('inviteMessage', defaultMessages[strategyId] || '');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Configurações do LinkedIn
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Como fazer o primeiro contato no LinkedIn?
        </p>
      </div>

      {/* Connection Strategy */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Estratégia de conexão
        </label>
        <div className="space-y-2">
          {CONNECTION_STRATEGIES.map((strategy) => {
            const Icon = iconMap[strategy.icon] || UserPlus;
            const isSelected = connectionStrategy === strategy.id;
            return (
              <button
                key={strategy.id}
                type="button"
                onClick={() => handleStrategyChange(strategy.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                      {strategy.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {strategy.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invite Message for with-intro and icebreaker */}
      {(connectionStrategy === 'with-intro' || connectionStrategy === 'icebreaker') && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mensagem do convite
          </label>
          <textarea
            value={inviteMessage}
            onChange={(e) => onChange('inviteMessage', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs"
            placeholder="Oi {{first_name}}, tudo bem?..."
          />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs text-gray-500">Variáveis:</span>
            {['{{first_name}}', '{{company}}', '{{title}}'].map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => onChange('inviteMessage', (inviteMessage || '') + ` ${variable}`)}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {variable}
              </button>
            ))}
            <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">
              Limite: 300 caracteres
            </span>
          </div>

          {/* Post-accept message for with-intro and icebreaker */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mensagem após aceite do convite (opcional)
            </label>
            <textarea
              value={postAcceptMessage || ''}
              onChange={(e) => onChange('postAcceptMessage', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
              placeholder="Mensagem que o agente enviará após o lead aceitar o convite..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Se deixar vazio, o agente usará a IA para gerar uma mensagem de início de conversa.
            </p>
          </div>
        </div>
      )}

      {/* Post-accept message for silent strategy */}
      {connectionStrategy === 'silent' && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              O convite será enviado sem mensagem. Após o aceite, se o lead não enviar mensagem, o agente pode iniciar a conversa.
            </p>
          </div>

          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mensagem para iniciar conversa após aceite (opcional)
          </label>
          <textarea
            value={postAcceptMessage || ''}
            onChange={(e) => onChange('postAcceptMessage', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
            placeholder="Oi {{first_name}}, obrigado por conectar! Vi que você trabalha na {{company}}..."
          />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs text-gray-500">Variáveis:</span>
            {['{{first_name}}', '{{company}}', '{{title}}'].map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => onChange('postAcceptMessage', (postAcceptMessage || '') + ` ${variable}`)}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {variable}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Se deixar vazio, o agente aguardará o lead iniciar ou usará a IA para gerar uma mensagem.
          </p>
        </div>
      )}
    </div>
  );
};

const ConversationStepsSection = ({ steps = [], objective, onChange }) => {
  const [localSteps, setLocalSteps] = useState(steps);

  useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  const loadTemplate = (objectiveId) => {
    const template = CONVERSATION_STEP_TEMPLATES[objectiveId] || [];
    const newSteps = template.map((step, idx) => ({
      order: idx + 1,
      text: step.text,
      is_escalation: step.is_escalation
    }));
    setLocalSteps(newSteps);
    onChange(newSteps);
  };

  const addStep = () => {
    const newStep = {
      order: localSteps.length + 1,
      text: '',
      is_escalation: false
    };
    const updated = [...localSteps, newStep];
    setLocalSteps(updated);
    onChange(updated);
  };

  const updateStep = (index, field, value) => {
    const updated = localSteps.map((step, i) =>
      i === index ? { ...step, [field]: value } : step
    );
    setLocalSteps(updated);
    onChange(updated);
  };

  const removeStep = (index) => {
    const updated = localSteps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, order: i + 1 }));
    setLocalSteps(updated);
    onChange(updated);
  };

  const moveStep = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= localSteps.length) return;

    const updated = [...localSteps];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((step, i) => ({ ...step, order: i + 1 }));
    setLocalSteps(reordered);
    onChange(reordered);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Etapas da Conversa
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Configure a sequência de passos que o agente segue durante a conversa.
        </p>
      </div>

      {/* Load template dropdown */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Carregar template
        </label>
        <select
          value=""
          onChange={(e) => e.target.value && loadTemplate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">Selecione um template...</option>
          <option value="qualify_transfer">Qualificar e Transferir</option>
          <option value="schedule_meeting">Agendar Reunião</option>
          <option value="sell_direct">Vender Direto</option>
        </select>
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {localSteps.map((step, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 p-2 rounded-lg border ${
              step.is_escalation
                ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }`}
          >
            <span className="w-6 h-6 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-bold flex-shrink-0">
              {index + 1}
            </span>

            <input
              type="text"
              value={step.text}
              onChange={(e) => updateStep(index, 'text', e.target.value)}
              className="flex-1 px-2 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0 focus:outline-none"
              placeholder="Descreva esta etapa..."
            />

            <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={step.is_escalation}
                onChange={(e) => updateStep(index, 'is_escalation', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <ArrowRightLeft className="w-3 h-3" />
            </label>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => moveStep(index, -1)}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveStep(index, 1)}
                disabled={index === localSteps.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeStep(index)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add step button */}
      <button
        type="button"
        onClick={addStep}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-purple-600 dark:text-purple-400 border border-dashed border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Adicionar etapa
      </button>

      {/* Legend */}
      <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" />
          Etapas marcadas indicam ponto de transferência para humano
        </p>
      </div>
    </div>
  );
};

const TransferSection = ({ transferTriggers = [], transferMode = 'notify', transferMessage = '', onChange }) => {
  const toggleTrigger = (triggerId) => {
    const current = transferTriggers || [];
    if (current.includes(triggerId)) {
      onChange('transferTriggers', current.filter(t => t !== triggerId));
    } else {
      onChange('transferTriggers', [...current, triggerId]);
    }
  };

  const handleModeChange = (mode) => {
    onChange('transferMode', mode);
    if (mode === 'silent') {
      onChange('transferMessage', '');
    }
  };

  const handleTemplateSelect = (templateId) => {
    const template = TRANSFER_MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      onChange('transferMessage', template.template);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Configurações de Transferência
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Configure quando e como o agente deve transferir a conversa.
        </p>
      </div>

      {/* Transfer triggers */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Gatilhos de Transferência
        </label>
        <div className="space-y-2">
          {TRANSFER_TRIGGERS.map((trigger) => {
            const isSelected = transferTriggers?.includes(trigger.id) || false;

            return (
              <button
                key={trigger.id}
                type="button"
                onClick={() => toggleTrigger(trigger.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                    ${isSelected
                      ? 'bg-purple-500 border-purple-500'
                      : 'border-gray-300 dark:border-gray-600'
                    }
                  `}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                      {trigger.label}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {trigger.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transfer mode */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Como comunicar a transferência?
        </label>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleModeChange('silent')}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              transferMode === 'silent'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-4 h-4 rounded-full border-2 flex items-center justify-center
                ${transferMode === 'silent' ? 'border-purple-500' : 'border-gray-300 dark:border-gray-600'}
              `}>
                {transferMode === 'silent' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  Transferir silenciosamente
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Não avisa o lead, apenas transfere a conversa
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('notify')}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              transferMode === 'notify'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`
                w-4 h-4 rounded-full border-2 flex items-center justify-center
                ${transferMode === 'notify' ? 'border-purple-500' : 'border-gray-300 dark:border-gray-600'}
              `}>
                {transferMode === 'notify' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
              </div>
              <div>
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  Avisar antes de transferir
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Envia uma mensagem ao lead antes de transferir
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Transfer message (only when notify mode) */}
      {transferMode === 'notify' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Mensagem de transferência
          </label>

          {/* Template buttons */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {TRANSFER_MESSAGE_TEMPLATES.filter(t => t.id !== 'custom').map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleTemplateSelect(template.id)}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {template.label}
              </button>
            ))}
          </div>

          <textarea
            value={transferMessage}
            onChange={(e) => onChange('transferMessage', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: Que ótimo seu interesse! Vou te conectar com nosso especialista..."
          />
        </div>
      )}

      {/* Selected count indicator */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4" />
          {transferTriggers.length === 0
            ? 'Nenhum gatilho selecionado - o agente não transferirá automaticamente'
            : `${transferTriggers.length} gatilho(s) de transferência selecionado(s)`
          }
        </p>
      </div>
    </div>
  );
};

const RulesSection = ({ rules, onChange }) => {
  const [newRule, setNewRule] = useState({ prefix: 'SEMPRE', instruction: '' });

  const prefixes = ['SEMPRE', 'NUNCA', 'QUANDO', 'SE'];

  const addRule = () => {
    if (newRule.instruction.trim()) {
      onChange([...rules, newRule]);
      setNewRule({ prefix: 'SEMPRE', instruction: '' });
    }
  };

  const removeRule = (index) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Regras Prioritárias
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Instruções que o vendedor deve seguir rigorosamente.
        </p>
      </div>

      {/* Existing rules */}
      {rules.length > 0 && (
        <div className="space-y-1.5">
          {rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
            >
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                rule.prefix === 'NUNCA' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                rule.prefix === 'SEMPRE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {rule.prefix}
              </span>
              <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                {rule.instruction}
              </span>
              <button
                onClick={() => removeRule(index)}
                className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new rule */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Adicionar nova regra
        </label>
        <div className="flex gap-1.5">
          <select
            value={newRule.prefix}
            onChange={(e) => setNewRule({ ...newRule, prefix: e.target.value })}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
          >
            {prefixes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            value={newRule.instruction}
            onChange={(e) => setNewRule({ ...newRule, instruction: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: mencionar que a primeira reunião é gratuita"
          />
          <button
            onClick={addRule}
            disabled={!newRule.instruction.trim()}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
};

const AdvancedSection = ({ objectiveInstructions, agentId, onChange }) => {
  const [showPreview, setShowPreview] = useState(false);
  const [promptPreview, setPromptPreview] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const loadPromptPreview = async () => {
    if (!agentId) return;
    setIsLoadingPreview(true);
    try {
      const response = await api.getAgentPromptPreview(agentId);
      setPromptPreview(response.data?.prompt || 'Não foi possível carregar o preview.');
    } catch (err) {
      console.error('Error loading prompt preview:', err);
      setPromptPreview('Erro ao carregar preview. Salve as alterações e tente novamente.');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleTogglePreview = () => {
    if (!showPreview && !promptPreview) {
      loadPromptPreview();
    }
    setShowPreview(!showPreview);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(promptPreview);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Configurações Avançadas
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Instruções customizadas e preview do prompt.
        </p>
      </div>

      {/* Custom instructions */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Instruções Customizadas
        </label>
        <textarea
          value={objectiveInstructions || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
          placeholder="Adicione instruções específicas que serão incluídas no prompt do agente...

Ex:
- Sempre mencione que a primeira consulta é gratuita
- Foque em empresas de tecnologia com mais de 50 funcionários
- Nunca mencione concorrentes pelo nome"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Estas instruções são adicionadas ao prompt do agente e têm alta prioridade.
        </p>
      </div>

      {/* Prompt Preview */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={handleTogglePreview}
          className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Preview do Prompt
            </span>
          </div>
          {showPreview ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showPreview && (
          <div className="mt-2 space-y-2">
            {isLoadingPreview ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Carregando preview...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-gray-900 dark:bg-gray-950 rounded-lg max-h-60 overflow-y-auto">
                  <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                    {promptPreview || 'Clique em "Atualizar" para ver o prompt.'}
                  </pre>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadPromptPreview}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Atualizar
                  </button>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    disabled={!promptPreview}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Salve as alterações para ver o prompt atualizado.
        </p>
      </div>
    </div>
  );
};

export default AgentEditModal;
