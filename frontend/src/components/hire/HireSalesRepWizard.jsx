import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
import ContractSummary from './ContractSummary';
import PostHireDialog from './PostHireDialog';
import RulesEditor from './RulesEditor';

import api from '../../services/api';

const STEPS = {
  CANDIDATE: 'candidate',
  CUSTOMIZE: 'customize',
  CHANNEL: 'channel',
  PRODUCT: 'product',
  TARGET: 'target',
  CONNECTION: 'connection',
  STYLE: 'style',
  METHODOLOGY: 'methodology',
  OBJECTIVE: 'objective',
  SUMMARY: 'summary'
};

// Step order varies by channel
const getStepOrder = (channel) => {
  const baseSteps = [
    STEPS.CANDIDATE,
    STEPS.CUSTOMIZE,
    STEPS.CHANNEL,
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
      STEPS.SUMMARY
    ];
  }

  // WhatsApp and Email skip connection strategy
  return [
    ...baseSteps,
    STEPS.STYLE,
    STEPS.METHODOLOGY,
    STEPS.OBJECTIVE,
    STEPS.SUMMARY
  ];
};

const HireSalesRepWizard = ({ isOpen, onClose, onAgentCreated, agent = null }) => {
  const { t } = useTranslation('hire');
  const isEditMode = !!agent;
  const [currentStep, setCurrentStep] = useState(isEditMode ? STEPS.PRODUCT : STEPS.CANDIDATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Post-hire state
  const [showPostHireDialog, setShowPostHireDialog] = useState(false);
  const [showRulesEditor, setShowRulesEditor] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState(null);
  const [isSavingRules, setIsSavingRules] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    candidate: null,
    channel: null,
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
    conversationStyle: 'consultivo',
    methodology: null,
    objective: 'qualify_transfer',
    maxMessages: 3,
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
          defaultConfig: {}
        },
        channel: agentConfig.channel || agent.agent_type || 'linkedin',
        productService,
        targetAudience,
        connectionStrategy: agent.connection_strategy || 'with-intro',
        inviteMessage: agent.invite_message || agent.initial_approach || '',
        conversationStyle: agent.behavioral_profile || 'consultivo',
        methodology: agentConfig.methodology_template_id || null,
        objective: agentConfig.objective || 'qualify_transfer',
        maxMessages: agentConfig.max_messages_before_escalation || 3,
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

  const goNext = () => {
    if (!canGoNext()) {
      setError('Preencha os campos obrigatórios');
      return;
    }

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
        products_services: formData.productService,
        behavioral_profile: formData.conversationStyle,
        target_audience: formData.targetAudience,
        connection_strategy: formData.connectionStrategy,
        invite_message: formData.inviteMessage,
        initial_approach: formData.inviteMessage || null,
        scheduling_link: formData.schedulingLink,
        priority_rules: formData.priorityRules || [],
        wait_time_after_accept: formData.waitTimeAfterAccept || 5,
        require_lead_reply: formData.requireLeadReply || false,
        avatar_url: formData.customAvatar || formData.candidate?.avatar || null,

        // 3. Config JSON with wizard settings (merge with any candidate config)
        config: {
          ...(candidateDefaults.config || {}),
          methodology_template_id: formData.methodology,
          objective: formData.objective,
          channel: formData.channel,
          max_messages_before_escalation: formData.maxMessages || 3,
          escalate_on_price_question: formData.objective === 'qualify_transfer',
          escalate_on_specific_feature: true,
          escalate_keywords: ['preço', 'quanto custa', 'demo', 'reunião', 'proposta'],
          candidate_template_id: formData.candidate?.id
        }
      };

      console.log('Final agentData being sent:', {
        behavioral_profile: agentData.behavioral_profile,
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
      customAvatar: null,
      productService: { categories: [], description: '' },
      targetAudience: { roles: [], companySizes: [], industry: '' },
      connectionStrategy: 'with-intro',
      inviteMessage: '',
      conversationStyle: 'consultivo',
      methodology: null,
      objective: 'qualify_transfer',
      maxMessages: 3,
      schedulingLink: '',
      conversionLink: '',
      agentName: ''
    });
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

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            {formData.candidate && (
              <div
                className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: formData.candidate.color }}
              >
                {/* If custom avatar is base64 (uploaded), show robot icon */}
                {isBase64Image(formData.customAvatar) ? (
                  <Bot className="w-5 h-5 text-white" />
                ) : (formData.customAvatar || formData.candidate.avatar) ? (
                  <img
                    src={formData.customAvatar || formData.candidate.avatar}
                    alt={formData.agentName || formData.candidate.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span style={{ display: (formData.customAvatar || formData.candidate.avatar) && !isBase64Image(formData.customAvatar) ? 'none' : isBase64Image(formData.customAvatar) ? 'none' : 'flex' }}>
                  {(formData.agentName || formData.candidate.name)[0]}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {getStepTitle()}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('wizard.step', { current: currentStepIndex + 1, total: totalSteps })}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800 flex-shrink-0">
          <div
            className="h-full bg-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

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
              maxMessages={formData.maxMessages}
              onChangeMaxMessages={(num) => updateFormData('maxMessages', num)}
              schedulingLink={formData.schedulingLink}
              onChangeSchedulingLink={(link) => updateFormData('schedulingLink', link)}
              conversionLink={formData.conversionLink}
              onChangeConversionLink={(link) => updateFormData('conversionLink', link)}
            />
          )}

          {currentStep === STEPS.SUMMARY && (
            <ContractSummary
              candidate={displayCandidate}
              formData={formData}
              onEdit={() => goToStep(STEPS.CANDIDATE)}
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

export default HireSalesRepWizard;
