import React, { useState, useRef, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Bot, Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import confetti from 'canvas-confetti';
import ChatMessage from './ChatMessage';

// Confetti celebration effect
const triggerConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const colors = ['#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#7C3AED'];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());

  // Big burst in the center
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: colors
    });
  }, 250);
};

// Helper to detect if avatar is a base64 data URL (uploaded image)
const isBase64Image = (url) => url && url.startsWith('data:image/');

// Step Components
import CandidateGallery from './CandidateGallery';
import CustomizeAgentStep from './CustomizeAgentStep';
import ChannelSelector from './ChannelSelector';
import { ProductStep, TargetAudienceStep } from './ConversationalStep';
import ConnectionStrategyStep from './ConnectionStrategyStep';
import ConversationStyleStep from './ConversationStyleStep';
import SalesMethodologyStep from './SalesMethodologyStep';
import ObjectiveStep from './ObjectiveStep';
import TransferTriggersStep from './TransferTriggersStep';
import ContractSummary from './ContractSummary';
import PostHireDialog from './PostHireDialog';
import RulesEditor from './RulesEditor';

import api from '../../services/api';

const STEPS = {
  CANDIDATE: 'candidate',
  CUSTOMIZE: 'customize',
  CHANNEL: 'channel',
  LANGUAGE: 'language',
  PRODUCT: 'product',
  TARGET: 'target',
  CONNECTION: 'connection',
  STYLE: 'style',
  METHODOLOGY: 'methodology',
  OBJECTIVE: 'objective',
  TRANSFER: 'transfer',
  SUMMARY: 'summary'
};

// Step order varies by channel
const getStepOrder = (channel) => {
  const baseSteps = [
    STEPS.CANDIDATE,
    STEPS.CUSTOMIZE,
    STEPS.CHANNEL,
    STEPS.LANGUAGE,
    STEPS.PRODUCT,
    STEPS.TARGET
  ];

  if (channel === 'linkedin') {
    return [
      ...baseSteps,
      STEPS.CONNECTION,
      STEPS.STYLE,
      STEPS.METHODOLOGY,
      STEPS.OBJECTIVE,
      STEPS.TRANSFER,
      STEPS.SUMMARY
    ];
  }

  // WhatsApp and Email skip connection strategy
  return [
    ...baseSteps,
    STEPS.STYLE,
    STEPS.METHODOLOGY,
    STEPS.OBJECTIVE,
    STEPS.TRANSFER,
    STEPS.SUMMARY
  ];
};

const HireSalesRepWizard = ({ isOpen, onClose, onAgentCreated, agent = null }) => {
  const { t } = useTranslation('hire');
  const isEditMode = !!agent;
  const [currentStep, setCurrentStep] = useState(isEditMode ? STEPS.PRODUCT : STEPS.CANDIDATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Chat scroll ref
  const chatContainerRef = useRef(null);

  // Track answered steps for chat history
  const [answeredSteps, setAnsweredSteps] = useState({});

  // Post-hire state
  const [showPostHireDialog, setShowPostHireDialog] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState(null);
  const [isSavingRules, setIsSavingRules] = useState(false);

  // Auto-scroll to top when step changes (so user sees the new question)
  useEffect(() => {
    if (chatContainerRef.current) {
      setTimeout(() => {
        chatContainerRef.current.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [currentStep]);

  // Form Data
  const [formData, setFormData] = useState({
    candidate: null,
    channel: null,
    language: localStorage.getItem('i18nextLng') || 'pt-BR',
    customAvatar: null, // Custom avatar URL (Unsplash or uploaded)
    productService: {
      categories: [],
      description: ''
    },
    targetAudience: {
      roles: [],
      companySizes: [],
      industry: ''
    },
    connectionStrategy: 'with-intro',
    inviteMessage: '',
    postAcceptMessage: '',
    conversationStyle: 'consultivo',
    methodology: null,
    objective: 'qualify_transfer',
    transferTriggers: ['qualified', 'price', 'demo'], // Default triggers
    schedulingLink: '',
    agentName: '',
    priorityRules: [],
    waitTimeAfterAccept: 5,
    requireLeadReply: false
  });

  // Preencher dados do agente em modo de edição
  React.useEffect(() => {
    if (isOpen && agent) {
      console.log('Loading agent in edit mode:', {
        behavioral_profile: agent.behavioral_profile,
        config: agent.config
      });
      // Parse products_services (pode ser string JSON ou objeto)
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

      // Parse config JSON for methodology, objective, etc.
      const agentConfig = typeof agent.config === 'string'
        ? JSON.parse(agent.config || '{}')
        : (agent.config || {});

      setFormData({
        candidate: {
          id: 'existing',
          name: agent.name,
          color: '#3B82F6',
          avatar: agent.avatar_url || null,
          defaultConfig: {}
        },
        channel: agentConfig.channel || agent.agent_type || 'linkedin',
        language: agent.language || localStorage.getItem('i18nextLng') || 'pt-BR',
        customAvatar: agent.avatar_url || null,
        productService,
        targetAudience,
        connectionStrategy: agent.connection_strategy || 'with-intro',
        inviteMessage: agent.invite_message || agent.initial_approach || '',
        postAcceptMessage: agent.post_accept_message || '',
        conversationStyle: agent.behavioral_profile || 'consultivo',
        methodology: agentConfig.methodology_template_id || null,
        objective: agentConfig.objective || 'qualify_transfer',
        transferTriggers: agent.transfer_triggers || agentConfig.transfer_triggers || ['qualified', 'price', 'demo'],
        schedulingLink: agent.scheduling_link || '',
        agentName: agent.name || ''
      });

      // Em modo edição, começar do passo de produto (pular seleção de candidato e canal)
      setCurrentStep(STEPS.PRODUCT);
    }
  }, [isOpen, agent]);

  // Get step order based on selected channel
  const stepOrder = getStepOrder(formData.channel);
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const totalSteps = stepOrder.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

  // Create a display candidate object with customized values
  const displayCandidate = formData.candidate ? {
    ...formData.candidate,
    name: formData.agentName || formData.candidate.name,
    avatar: formData.customAvatar || formData.candidate.avatar
  } : null;

  // Update form data
  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case STEPS.CANDIDATE:
        return !!formData.candidate;
      case STEPS.CUSTOMIZE:
        // Name is required (use candidate name as fallback)
        return !!(formData.agentName || formData.candidate?.name);
      case STEPS.CHANNEL:
        return !!formData.channel;
      case STEPS.LANGUAGE:
        return !!formData.language;
      case STEPS.PRODUCT:
        // At least one category selected OR description with some text
        return formData.productService?.categories?.length > 0 || formData.productService?.description?.length >= 10;
      case STEPS.TARGET:
        return formData.targetAudience?.roles?.length > 0;
      case STEPS.CONNECTION:
        return !!formData.connectionStrategy;
      case STEPS.STYLE:
        return !!formData.conversationStyle;
      case STEPS.METHODOLOGY:
        return true; // Optional
      case STEPS.OBJECTIVE:
        if (formData.objective === 'schedule_meeting' && !formData.schedulingLink) return false;
        if (formData.objective === 'sell_direct' && !formData.conversionLink) return false;
        return !!formData.objective;
      default:
        return true;
    }
  };

  // Get display text for answered step
  const getAnswerText = (step) => {
    switch (step) {
      case STEPS.CANDIDATE:
        return formData.candidate?.name || 'Candidato selecionado';
      case STEPS.CUSTOMIZE:
        return formData.agentName || formData.candidate?.name || 'Nome definido';
      case STEPS.CHANNEL:
        const channels = { linkedin: 'LinkedIn', whatsapp: 'WhatsApp', email: 'Email' };
        return channels[formData.channel] || formData.channel;
      case STEPS.LANGUAGE:
        const lang = AVAILABLE_LANGUAGES.find(l => l.code === formData.language);
        return lang?.name || formData.language;
      case STEPS.PRODUCT:
        const cats = formData.productService?.categories || [];
        if (cats.length > 0) {
          return cats.map(c => t(`product.categories.${c}`, { defaultValue: c })).join(', ');
        }
        return formData.productService?.description?.slice(0, 50) + '...' || 'Produto definido';
      case STEPS.TARGET:
        const roles = formData.targetAudience?.roles || [];
        return roles.map(r => t(`target.roles.${r}`, { defaultValue: r })).join(', ') || 'Público definido';
      case STEPS.CONNECTION:
        const strategies = { silent: 'Conexão silenciosa', 'with-intro': 'Com apresentação', icebreaker: 'Quebra-gelo' };
        return strategies[formData.connectionStrategy] || formData.connectionStrategy;
      case STEPS.STYLE:
        const styles = { direct: 'Direto', consultivo: 'Consultivo', educational: 'Educativo', friendly: 'Amigável' };
        return styles[formData.conversationStyle] || formData.conversationStyle;
      case STEPS.METHODOLOGY:
        if (!formData.methodology) return 'Livre (sem metodologia)';
        return formData.methodology.toUpperCase();
      case STEPS.OBJECTIVE:
        const objectives = {
          connect_only: 'Só conectar',
          qualify_transfer: 'Qualificar e transferir',
          schedule_meeting: 'Agendar reunião',
          sell_direct: 'Vender direto'
        };
        return objectives[formData.objective] || formData.objective;
      default:
        return 'Respondido';
    }
  };

  const goNext = () => {
    if (!canGoNext()) {
      setError('Preencha os campos obrigatórios');
      return;
    }

    // Save answer for chat history
    setAnsweredSteps(prev => ({
      ...prev,
      [currentStep]: getAnswerText(currentStep)
    }));

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepOrder.length) {
      setCurrentStep(stepOrder[nextIndex]);
      setError('');
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(stepOrder[prevIndex]);
      setError('');
    }
  };

  const goToStep = (step) => {
    setCurrentStep(step);
    setError('');
  };

  // Create or update agent
  const handleCreateAgent = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Build agent data from form - only fields that exist in the database
      console.log('Creating agent with formData:', {
        conversationStyle: formData.conversationStyle,
        methodology: formData.methodology,
        objective: formData.objective
      });

      // Apply defaults from candidate FIRST, then override with form values
      const candidateDefaults = isEditMode ? {} : (formData.candidate?.defaultConfig || {});

      const agentData = {
        // 1. Candidate defaults (lowest priority)
        ...candidateDefaults,

        // 2. Form values (override defaults)
        name: formData.agentName || formData.candidate?.name || 'Vendedor Digital',
        agent_type: formData.channel || 'linkedin',
        language: formData.language,
        products_services: formData.productService,
        behavioral_profile: formData.conversationStyle,
        target_audience: formData.targetAudience,
        connection_strategy: formData.connectionStrategy,
        invite_message: formData.inviteMessage,
        post_accept_message: formData.postAcceptMessage || null,
        initial_approach: formData.inviteMessage || null,
        scheduling_link: formData.schedulingLink,
        priority_rules: formData.priorityRules || [],
        wait_time_after_accept: formData.waitTimeAfterAccept || 5,
        require_lead_reply: formData.requireLeadReply || false,
        avatar_url: formData.customAvatar || formData.candidate?.avatar || null,
        transfer_triggers: formData.transferTriggers || [],

        // 3. Config JSON with wizard settings (merge with any candidate config)
        config: {
          ...(candidateDefaults.config || {}),
          methodology_template_id: formData.methodology,
          objective: formData.objective,
          channel: formData.channel,
          transfer_triggers: formData.transferTriggers || [],
          candidate_template_id: formData.candidate?.id
        }
      };

      console.log('Final agentData being sent:', {
        behavioral_profile: agentData.behavioral_profile,
        post_accept_message: agentData.post_accept_message,
        connection_strategy: agentData.connection_strategy,
        language: agentData.language,
        config: agentData.config
      });

      let result;
      if (isEditMode) {
        // Modo edição - atualizar agente existente
        result = await api.updateAIAgent(agent.id, agentData);
        // Fechar diretamente sem mostrar dialog de regras
        onAgentCreated();
        handleClose();
      } else {
        // Modo criação - criar novo agente
        result = await api.createAIAgent(agentData);
        setCreatedAgentId(result.id || result.agent_id);

        // 🎉 Trigger confetti celebration!
        triggerConfetti();

        // Show post-hire dialog instead of closing immediately
        setShowPostHireDialog(true);
      }
    } catch (err) {
      console.error('Error saving agent:', err);
      setError(err.message || (isEditMode ? 'Erro ao atualizar vendedor' : 'Erro ao criar vendedor'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding rules after hire
  const handleAddRules = () => {
    setShowPostHireDialog(false);
    setShowRulesEditor(true);
  };

  // Handle skipping rules
  const handleSkipRules = () => {
    setShowPostHireDialog(false);
    onAgentCreated();
    handleClose();
  };

  // Handle saving rules
  const handleSaveRules = async (rules) => {
    if (!createdAgentId) {
      handleSkipRules();
      return;
    }

    setIsSavingRules(true);
    try {
      // Save rules to the created agent
      await api.updateAIAgent(createdAgentId, {
        priority_rules: rules
      });
      setShowRulesEditor(false);
      onAgentCreated();
      handleClose();
    } catch (err) {
      console.error('Error saving rules:', err);
      // Even if saving rules fails, still close and notify
      setShowRulesEditor(false);
      onAgentCreated();
      handleClose();
    } finally {
      setIsSavingRules(false);
    }
  };

  // Handle closing rules editor without saving
  const handleCloseRulesEditor = () => {
    setShowRulesEditor(false);
    onAgentCreated();
    handleClose();
  };

  // Close and reset
  const handleClose = () => {
    setCurrentStep(STEPS.CANDIDATE);
    setFormData({
      candidate: null,
      channel: null,
      language: localStorage.getItem('i18nextLng') || 'pt-BR',
      customAvatar: null,
      productService: { categories: [], description: '' },
      targetAudience: { roles: [], companySizes: [], industry: '' },
      connectionStrategy: 'with-intro',
      inviteMessage: '',
      postAcceptMessage: '',
      conversationStyle: 'consultivo',
      methodology: null,
      objective: 'qualify_transfer',
      transferTriggers: ['qualified', 'price', 'demo'],
      schedulingLink: '',
      conversionLink: '',
      agentName: '',
      priorityRules: [],
      waitTimeAfterAccept: 5,
      requireLeadReply: false
    });
    setAnsweredSteps({});
    setError('');
    setShowPostHireDialog(false);
    setShowRulesEditor(false);
    setCreatedAgentId(null);
    onClose();
  };

  // Handle creating from scratch
  const handleCreateFromScratch = () => {
    updateFormData('candidate', {
      id: 'custom',
      name: 'Vendedor',
      title: 'Personalizado',
      color: '#6366F1',
      defaultConfig: {}
    });
    goNext();
  };

  if (!isOpen) return null;

  // Get step title
  const getStepTitle = () => {
    if (isEditMode) {
      return `Editando ${formData.agentName || agent?.name || 'Vendedor'}`;
    }
    if (currentStep === STEPS.CANDIDATE) return t('candidates.title');
    if (formData.candidate) {
      // Use custom name if set, otherwise use candidate name
      const displayName = formData.agentName || formData.candidate.name;
      return t('wizard.getting_to_know', { name: displayName });
    }
    return t('wizard.title');
  };

  // Helper to render compact history summary (chips)
  const renderChatHistory = () => {
    const historySteps = stepOrder.slice(0, currentStepIndex);
    const answeredHistory = historySteps.filter(step => answeredSteps[step]);

    if (answeredHistory.length === 0) return null;

    // Skip showing CANDIDATE and CUSTOMIZE in history (already shown in header)
    const visibleHistory = answeredHistory.filter(
      step => step !== STEPS.CANDIDATE && step !== STEPS.CUSTOMIZE
    );

    if (visibleHistory.length === 0) return null;

    return (
      <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          {visibleHistory.map((step) => (
            <span
              key={step}
              className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full"
            >
              {answeredSteps[step]}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Compacto */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            {displayCandidate && (
              <div
                className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
                style={{ backgroundColor: displayCandidate.color, '--tw-ring-color': displayCandidate.color }}
              >
                {isBase64Image(displayCandidate.avatar) ? (
                  <Bot className="w-5 h-5 text-white" />
                ) : displayCandidate.avatar ? (
                  <img
                    src={displayCandidate.avatar}
                    alt={displayCandidate.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  displayCandidate.name?.[0] || 'V'
                )}
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {isEditMode ? `Editando ${displayCandidate?.name || 'Vendedor'}` : (displayCandidate?.name || t('wizard.title'))}
              </h2>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {currentStepIndex + 1}/{totalSteps}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Content */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Chat History - Respostas anteriores */}
          {renderChatHistory()}

          {/* Step Content */}
          {currentStep === STEPS.CANDIDATE && (
            <CandidateGallery
              selectedCandidate={formData.candidate}
              onSelect={(candidate) => {
                updateFormData('candidate', candidate);
                // Pre-fill conversation style from candidate
                if (candidate.conversationStyle) {
                  updateFormData('conversationStyle', candidate.conversationStyle);
                }
                if (candidate.methodology) {
                  updateFormData('methodology', candidate.methodology);
                }
                // Pre-fill name from candidate
                if (candidate.name && !formData.agentName) {
                  updateFormData('agentName', candidate.name);
                }
              }}
              onCreateFromScratch={handleCreateFromScratch}
            />
          )}

          {currentStep === STEPS.CUSTOMIZE && (
            <CustomizeAgentStep
              candidate={formData.candidate}
              agentName={formData.agentName || formData.candidate?.name || ''}
              onChangeName={(name) => updateFormData('agentName', name)}
              avatarUrl={formData.customAvatar}
              onChangeAvatar={(url) => updateFormData('customAvatar', url)}
            />
          )}

          {currentStep === STEPS.CHANNEL && (
            <ChannelSelector
              selectedCandidate={displayCandidate}
              selectedChannel={formData.channel}
              onSelect={(channel) => updateFormData('channel', channel)}
            />
          )}

          {currentStep === STEPS.LANGUAGE && (
            <LanguageStep
              candidate={displayCandidate}
              selectedLanguage={formData.language}
              onSelect={(language) => updateFormData('language', language)}
            />
          )}

          {currentStep === STEPS.PRODUCT && (
            <ProductStep
              candidate={displayCandidate}
              data={formData.productService}
              onChange={(data) => updateFormData('productService', data)}
            />
          )}

          {currentStep === STEPS.TARGET && (
            <TargetAudienceStep
              candidate={displayCandidate}
              productValue={formData.productService?.description || ''}
              data={formData.targetAudience}
              onChange={(data) => updateFormData('targetAudience', data)}
            />
          )}

          {currentStep === STEPS.CONNECTION && (
            <ConnectionStrategyStep
              candidate={displayCandidate}
              selectedStrategy={formData.connectionStrategy}
              onSelectStrategy={(strategy) => updateFormData('connectionStrategy', strategy)}
              inviteMessage={formData.inviteMessage}
              onChangeInviteMessage={(msg) => updateFormData('inviteMessage', msg)}
              postAcceptMessage={formData.postAcceptMessage}
              onChangePostAcceptMessage={(msg) => updateFormData('postAcceptMessage', msg)}
            />
          )}

          {currentStep === STEPS.STYLE && (
            <ConversationStyleStep
              candidate={displayCandidate}
              selectedStyle={formData.conversationStyle}
              onSelect={(style) => updateFormData('conversationStyle', style)}
            />
          )}

          {currentStep === STEPS.METHODOLOGY && (
            <SalesMethodologyStep
              candidate={displayCandidate}
              selectedMethodology={formData.methodology}
              onSelect={(method) => updateFormData('methodology', method)}
              onSkip={() => {
                updateFormData('methodology', null);
                goNext();
              }}
            />
          )}

          {currentStep === STEPS.OBJECTIVE && (
            <ObjectiveStep
              candidate={displayCandidate}
              channel={formData.channel}
              selectedObjective={formData.objective}
              onSelect={(obj) => updateFormData('objective', obj)}
              schedulingLink={formData.schedulingLink}
              onChangeSchedulingLink={(link) => updateFormData('schedulingLink', link)}
              conversionLink={formData.conversionLink}
              onChangeConversionLink={(link) => updateFormData('conversionLink', link)}
            />
          )}

          {currentStep === STEPS.TRANSFER && (
            <TransferTriggersStep
              candidate={displayCandidate}
              transferTriggers={formData.transferTriggers}
              onChangeTransferTriggers={(triggers) => updateFormData('transferTriggers', triggers)}
            />
          )}

          {currentStep === STEPS.SUMMARY && (
            <ContractSummary
              candidate={displayCandidate}
              formData={formData}
              onEdit={() => goToStep(STEPS.CANDIDATE)}
              onEditProfile={() => goToStep(STEPS.CUSTOMIZE)}
              onEditProduct={() => goToStep(STEPS.PRODUCT)}
              onEditTarget={() => goToStep(STEPS.TARGET)}
              onEditStyle={() => goToStep(STEPS.STYLE)}
              onEditMethodology={() => goToStep(STEPS.METHODOLOGY)}
              onEditObjective={() => goToStep(STEPS.OBJECTIVE)}
              onEditConnection={() => goToStep(STEPS.CONNECTION)}
              onConfirm={handleCreateAgent}
              isLoading={isLoading}
              isEditMode={isEditMode}
            />
          )}
        </div>

        {/* Footer */}
        {currentStep !== STEPS.SUMMARY && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div>
              {currentStepIndex > 0 && (
                <button
                  onClick={goBack}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('wizard.back')}
                </button>
              )}
            </div>

            <button
              onClick={goNext}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('wizard.next')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Post-Hire Dialog */}
      <PostHireDialog
        isOpen={showPostHireDialog}
        onClose={handleSkipRules}
        onAddRules={handleAddRules}
        onSkip={handleSkipRules}
        agentName={formData.agentName || formData.candidate?.name || 'Vendedor'}
        agentColor={formData.candidate?.color || '#3B82F6'}
        agentAvatar={formData.customAvatar || formData.candidate?.avatar}
      />

      {/* Rules Editor */}
      <RulesEditor
        isOpen={showRulesEditor}
        onClose={handleCloseRulesEditor}
        rules={[]}
        onSave={handleSaveRules}
        agentName={formData.agentName || formData.candidate?.name || 'Vendedor'}
        isLoading={isSavingRules}
      />
    </div>
  );
};

// Language Step Component
const LanguageStep = ({ candidate, selectedLanguage, onSelect }) => {
  return (
    <div className="space-y-4">
      {/* Question from candidate */}
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: candidate?.color || '#3B82F6' }}
        >
          {candidate?.avatar ? (
            <img
              src={candidate.avatar}
              alt={candidate.name}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            candidate?.name?.[0] || 'V'
          )}
        </div>
        <div className="flex-1">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none p-4">
            <p className="text-gray-900 dark:text-white">
              Em qual <strong>idioma</strong> devo responder aos leads? 🌍
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Vou sempre responder neste idioma, mesmo que o lead escreva em outro.
            </p>
          </div>
        </div>
      </div>

      {/* Language options */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {AVAILABLE_LANGUAGES.map((lang) => {
          const isSelected = selectedLanguage === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => onSelect(lang.code)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <Globe className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                {lang.name}
              </span>
              {isSelected && (
                <Check className="w-4 h-4 text-purple-600 ml-auto flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Important note */}
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Importante:</strong> Mesmo que o lead escreva em outro idioma, o vendedor sempre responderá no idioma selecionado.
        </p>
      </div>
    </div>
  );
};

export default HireSalesRepWizard;
