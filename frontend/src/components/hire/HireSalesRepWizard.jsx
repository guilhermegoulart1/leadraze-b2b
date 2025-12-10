import React, { useState } from 'react';
import { X, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Step Components
import CandidateGallery from './CandidateGallery';
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

const HireSalesRepWizard = ({ isOpen, onClose, onAgentCreated }) => {
  const { t } = useTranslation('hire');
  const [currentStep, setCurrentStep] = useState(STEPS.CANDIDATE);
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
    conversionLink: '',
    agentName: ''
  });

  // Get step order based on selected channel
  const stepOrder = getStepOrder(formData.channel);
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const totalSteps = stepOrder.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;

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

  // Create agent
  const handleCreateAgent = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Build agent data from form
      const agentData = {
        name: formData.agentName || formData.candidate?.name || 'Vendedor Digital',
        products_services: formData.productService,
        behavioral_profile: formData.conversationStyle,
        methodology_template_id: formData.methodology,
        target_audience: formData.targetAudience,
        channel: formData.channel,
        connection_strategy: formData.connectionStrategy,
        invite_message: formData.inviteMessage,
        objective: formData.objective,
        max_messages_before_transfer: formData.maxMessages,
        scheduling_link: formData.schedulingLink,
        conversion_link: formData.conversionLink,
        candidate_template_id: formData.candidate?.id,

        // Apply defaults from candidate
        ...formData.candidate?.defaultConfig,

        // Escalation rules based on objective
        escalation_rules: {
          escalate_on_price_question: formData.objective === 'qualify_transfer',
          escalate_on_specific_feature: true,
          escalate_keywords: ['preço', 'quanto custa', 'demo', 'reunião', 'proposta'],
          max_messages_before_escalation: formData.maxMessages || 3
        }
      };

      const result = await api.createAIAgent(agentData);
      setCreatedAgentId(result.id || result.agent_id);

      // Show post-hire dialog instead of closing immediately
      setShowPostHireDialog(true);
    } catch (err) {
      console.error('Error creating agent:', err);
      setError(err.message || 'Erro ao criar vendedor');
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
    if (currentStep === STEPS.CANDIDATE) return t('candidates.title');
    if (formData.candidate) {
      return t('wizard.getting_to_know', { name: formData.candidate.name });
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: formData.candidate.color }}
              >
                {formData.candidate.name[0]}
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
            className="h-full bg-blue-500 transition-all duration-300"
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
              }}
              onCreateFromScratch={handleCreateFromScratch}
            />
          )}

          {currentStep === STEPS.CHANNEL && (
            <ChannelSelector
              selectedCandidate={formData.candidate}
              selectedChannel={formData.channel}
              onSelect={(channel) => updateFormData('channel', channel)}
            />
          )}

          {currentStep === STEPS.PRODUCT && (
            <ProductStep
              candidate={formData.candidate}
              data={formData.productService}
              onChange={(data) => updateFormData('productService', data)}
            />
          )}

          {currentStep === STEPS.TARGET && (
            <TargetAudienceStep
              candidate={formData.candidate}
              productValue={formData.productService?.description || ''}
              data={formData.targetAudience}
              onChange={(data) => updateFormData('targetAudience', data)}
            />
          )}

          {currentStep === STEPS.CONNECTION && (
            <ConnectionStrategyStep
              candidate={formData.candidate}
              selectedStrategy={formData.connectionStrategy}
              onSelectStrategy={(strategy) => updateFormData('connectionStrategy', strategy)}
              inviteMessage={formData.inviteMessage}
              onChangeInviteMessage={(msg) => updateFormData('inviteMessage', msg)}
            />
          )}

          {currentStep === STEPS.STYLE && (
            <ConversationStyleStep
              candidate={formData.candidate}
              selectedStyle={formData.conversationStyle}
              onSelect={(style) => updateFormData('conversationStyle', style)}
            />
          )}

          {currentStep === STEPS.METHODOLOGY && (
            <SalesMethodologyStep
              candidate={formData.candidate}
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
              candidate={formData.candidate}
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
              candidate={formData.candidate}
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
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        agentAvatar={formData.candidate?.avatar}
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
