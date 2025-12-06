import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Wand2, BookTemplate, Settings2, ArrowLeft, ArrowRight,
  Loader2, Check, Sparkles, Edit2, RefreshCw, Bot, Linkedin,
  Mail, MessageCircle, ChevronRight, AlertCircle, Star, Variable
} from 'lucide-react';

// Available variables for message templates (in English for standardization)
const AVAILABLE_VARIABLES = [
  { key: '{{first_name}}', label: 'First Name', description: 'Lead\'s first name only' },
  { key: '{{name}}', label: 'Full Name', description: 'Lead\'s full name' },
  { key: '{{company}}', label: 'Company', description: 'Current company' },
  { key: '{{title}}', label: 'Title', description: 'Job title' },
  { key: '{{location}}', label: 'Location', description: 'Location' },
  { key: '{{industry}}', label: 'Industry', description: 'Industry/sector' },
  { key: '{{connections}}', label: 'Connections', description: 'Number of connections' },
  { key: '{{summary}}', label: 'Summary', description: 'Profile summary' }
];

// Agent objectives
const AGENT_OBJECTIVES = [
  { id: 'generate_interest', label: 'Gerar Interesse', description: 'Despertar curiosidade sobre o produto/serviço' },
  { id: 'qualify_lead', label: 'Qualificar Lead', description: 'Identificar se o lead tem fit com a solução' },
  { id: 'schedule_meeting', label: 'Agendar Reunião', description: 'Marcar uma call ou demonstração' },
  { id: 'start_conversation', label: 'Iniciar Conversa', description: 'Quebrar o gelo e começar relacionamento' },
  { id: 'nurture', label: 'Nutrir Lead', description: 'Manter contato e educar o lead' }
];
import api from '../services/api';
import UnifiedAgentWizard from './UnifiedAgentWizard';

const CREATION_MODES = {
  SELECTION: 'selection',
  SIMPLE: 'simple',
  TEMPLATES: 'templates',
  ADVANCED: 'advanced',
  TEMPLATE_EDIT: 'template_edit' // For editing template-based agents
};

const SimpleAgentWizard = ({ isOpen, onClose, onSubmit, agent = null }) => {
  const { t } = useTranslation(['agents', 'common']);

  // Mode state
  const [mode, setMode] = useState(CREATION_MODES.SELECTION);

  // Simple mode state
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState('linkedin');
  const [language, setLanguage] = useState('pt');
  const [productService, setProductService] = useState('');
  const [objective, setObjective] = useState('generate_interest');
  const [generating, setGenerating] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [generationError, setGenerationError] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);

  // Template mode state
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateConfigStep, setTemplateConfigStep] = useState(false); // New step for template configuration

  // Review mode state (shared between simple and template)
  const [reviewMode, setReviewMode] = useState(false);
  const [editableConfig, setEditableConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  // Ref for initial message textarea
  const initialMessageRef = useRef(null);

  // Function to insert variable at cursor position in initial message
  const insertVariable = (variableKey) => {
    const textarea = initialMessageRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = editableConfig?.initial_message || '';
    const newValue = currentValue.substring(0, start) + variableKey + currentValue.substring(end);

    setEditableConfig({ ...editableConfig, initial_message: newValue });

    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variableKey.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // If editing an agent
      if (agent) {
        // Check if it's a simple/template agent (created via SimpleAgentWizard)
        const isTemplateAgent = agent.template_id || agent.template_name ||
          agent.config?.template_id || agent.config?.template_name;
        const isSimpleAgent = agent.config?.creation_mode === 'simple';

        // Use simplified edit mode for both template and simple mode agents
        if (isTemplateAgent || isSimpleAgent) {
          // Use simpler edit mode
          setMode(CREATION_MODES.TEMPLATE_EDIT);
          setAgentType(agent.agent_type || 'linkedin');
          setReviewMode(false); // Ensure reviewMode is false for simplified edit
          // Populate editable config from agent data (reading from config object where info is stored)
          setEditableConfig({
            name: agent.name || '',
            description: agent.description || '',
            system_prompt: agent.system_prompt || agent.config?.system_prompt || '',
            initial_message: agent.initial_message || agent.config?.initial_message || '',
            behavioral_profile: agent.behavioral_profile || agent.config?.behavioral_profile || {
              formality: 60,
              friendliness: 70,
              assertiveness: 50,
              professionalism: 75
            },
            response_length: agent.response_length || 'medium',
            conversation_steps: agent.conversation_steps || agent.config?.conversation_steps || [],
            products_services: agent.products_services || agent.config?.products_services || '',
            objective: agent.objective || agent.config?.objective || 'generate_interest',
            template_id: agent.template_id || agent.config?.template_id,
            template_name: agent.template_name || agent.config?.template_name,
            creation_mode: agent.config?.creation_mode || (isTemplateAgent ? 'template' : 'simple')
          });
        } else {
          // Use full advanced mode for agents created in advanced mode
          setMode(CREATION_MODES.ADVANCED);
        }
      } else {
        resetState();
      }
    }
  }, [isOpen, agent]);

  const resetState = () => {
    setMode(CREATION_MODES.SELECTION);
    setDescription('');
    setAgentType('linkedin');
    setLanguage('pt');
    setProductService('');
    setObjective('generate_interest');
    setGenerating(false);
    setGeneratedConfig(null);
    setGenerationError('');
    setRefining(false);
    setRefineFeedback('');
    setShowRefineInput(false);
    setTemplates([]);
    setSelectedTemplate(null);
    setTemplateConfig(null);
    setApplyingTemplate(false);
    setTemplateConfigStep(false);
    setReviewMode(false);
    setEditableConfig(null);
    setSaving(false);
  };

  // Load templates when entering template mode
  useEffect(() => {
    if (mode === CREATION_MODES.TEMPLATES && templates.length === 0) {
      loadTemplates();
    }
  }, [mode]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await api.getAgentTemplates();
      if (response.success) {
        setTemplates(response.data.templates || []);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Generate agent config using AI
  const handleGenerate = async () => {
    if (!productService.trim()) {
      setGenerationError('Por favor, informe o que você vende.');
      return;
    }

    try {
      setGenerating(true);
      setGenerationError('');

      // Build enhanced description with product and objective
      const enhancedDescription = `
Produto/Serviço: ${productService}
Objetivo: ${AGENT_OBJECTIVES.find(o => o.id === objective)?.label || objective}
${description ? `Detalhes adicionais: ${description}` : ''}
      `.trim();

      const response = await api.generateAgentConfig(enhancedDescription, agentType, language, {
        productService,
        objective
      });

      if (response.success) {
        setGeneratedConfig(response.data.config);
        setEditableConfig(response.data.config);
        setReviewMode(true);
      } else {
        setGenerationError(response.error || 'Falha ao gerar configuração');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationError(error.message || 'Erro ao gerar configuração do agente');
    } finally {
      setGenerating(false);
    }
  };

  // Refine config based on feedback
  const handleRefine = async () => {
    if (!refineFeedback.trim()) return;

    try {
      setRefining(true);

      const response = await api.refineAgentConfig(editableConfig, refineFeedback, language);

      if (response.success) {
        setEditableConfig(response.data.config);
        setRefineFeedback('');
        setShowRefineInput(false);
      }
    } catch (error) {
      console.error('Refine error:', error);
    } finally {
      setRefining(false);
    }
  };

  // Select template and go to configuration step
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setTemplateConfigStep(true);
  };

  // Apply selected template with product/service info
  const handleApplyTemplate = async () => {
    if (!productService.trim()) {
      setGenerationError('Por favor, informe o que você vende.');
      return;
    }

    try {
      setApplyingTemplate(true);
      setGenerationError('');

      const response = await api.applyAgentTemplate(selectedTemplate.id, {
        productService,
        objective
      });

      if (response.success) {
        const config = response.data.config || response.data;
        // Inject product/service into the config
        config.products_services = productService;
        config.objective = objective;
        setTemplateConfig(config);
        setEditableConfig(config);
        setTemplateConfigStep(false);
        setReviewMode(true);
      }
    } catch (error) {
      console.error('Apply template error:', error);
      setGenerationError('Erro ao aplicar template');
    } finally {
      setApplyingTemplate(false);
    }
  };

  // Save the agent
  const handleSave = async () => {
    if (!editableConfig) return;

    try {
      setSaving(true);

      // Build the agent data
      const agentData = {
        name: editableConfig.name,
        description: editableConfig.description || '',
        agent_type: agentType,
        response_length: editableConfig.response_length || 'medium',
        config: {
          system_prompt: editableConfig.system_prompt,
          initial_message: editableConfig.initial_message,
          behavioral_profile: editableConfig.behavioral_profile,
          conversation_steps: editableConfig.conversation_steps,
          intent_detection: editableConfig.intent_detection,
          objection_handlers: editableConfig.objection_handlers,
          // Template info (saved inside config to persist in DB)
          template_id: editableConfig.template_id,
          template_name: editableConfig.template_name,
          products_services: editableConfig.products_services,
          objective: editableConfig.objective,
          // Track creation mode for simplified editing later
          creation_mode: editableConfig.creation_mode || (editableConfig.template_id ? 'template' : 'simple')
        },
        is_active: true
      };

      // If editing an existing agent, include the ID
      if (agent?.id) {
        agentData.id = agent.id;
      }

      await onSubmit(agentData);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    if (reviewMode) {
      setReviewMode(false);
      setEditableConfig(null);
      if (mode === CREATION_MODES.TEMPLATES) {
        // Go back to template config step
        setTemplateConfigStep(true);
        setTemplateConfig(null);
      }
    } else if (templateConfigStep) {
      // Go back to template selection
      setTemplateConfigStep(false);
      setSelectedTemplate(null);
      setProductService('');
      setObjective('generate_interest');
    } else {
      setMode(CREATION_MODES.SELECTION);
    }
  };

  // If in advanced mode, render the full wizard
  if (mode === CREATION_MODES.ADVANCED) {
    return (
      <UnifiedAgentWizard
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={onSubmit}
        agent={agent}
      />
    );
  }

  if (!isOpen) return null;

  const getAgentTypeIcon = (type) => {
    switch (type) {
      case 'linkedin': return Linkedin;
      case 'email': return Mail;
      case 'whatsapp': return MessageCircle;
      default: return Bot;
    }
  };

  const getAgentTypeLabel = (type) => {
    switch (type) {
      case 'linkedin': return 'LinkedIn';
      case 'email': return 'Email';
      case 'whatsapp': return 'WhatsApp';
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {mode !== CREATION_MODES.SELECTION && mode !== CREATION_MODES.TEMPLATE_EDIT && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {mode === CREATION_MODES.SELECTION && 'Criar Novo Agente'}
                {mode === CREATION_MODES.SIMPLE && (reviewMode ? 'Revisar Configuração' : 'Modo Simples')}
                {mode === CREATION_MODES.TEMPLATES && (
                  reviewMode ? 'Revisar Template' :
                  templateConfigStep ? 'Configurar Template' : 'Templates de Vendas'
                )}
                {mode === CREATION_MODES.TEMPLATE_EDIT && 'Editar Agente'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {mode === CREATION_MODES.SELECTION && 'Escolha como você quer criar seu agente'}
                {mode === CREATION_MODES.SIMPLE && (reviewMode ? 'Revise e ajuste a configuração gerada' : 'Informe seu produto e objetivo')}
                {mode === CREATION_MODES.TEMPLATES && (
                  reviewMode ? 'Personalize o template selecionado' :
                  templateConfigStep ? 'Informe seu produto para personalizar o template' : 'Escolha uma metodologia de vendas comprovada'
                )}
                {mode === CREATION_MODES.TEMPLATE_EDIT && 'Ajuste as configurações do seu agente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Mode Selection */}
          {mode === CREATION_MODES.SELECTION && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Simple Mode */}
              <button
                onClick={() => setMode(CREATION_MODES.SIMPLE)}
                className="group relative p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl border-2 border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg transition-all text-left"
              >
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded-full">
                    Recomendado
                  </span>
                </div>
                <div className="w-14 h-14 bg-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Wand2 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Modo Simples</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Descreva seu agente em linguagem natural e deixe a IA criar a configuração completa para você.
                </p>
                <div className="flex items-center text-purple-600 dark:text-purple-400 font-medium">
                  Começar <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </button>

              {/* Template Mode */}
              <button
                onClick={() => setMode(CREATION_MODES.TEMPLATES)}
                className="group p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-lg transition-all text-left"
              >
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BookTemplate className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Templates</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Escolha entre 8 metodologias de vendas consagradas como SPIN, Challenger, Sandler e mais.
                </p>
                <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium">
                  Ver Templates <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </button>

              {/* Advanced Mode */}
              <button
                onClick={() => setMode(CREATION_MODES.ADVANCED)}
                className="group p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-600/50 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-lg transition-all text-left"
              >
                <div className="w-14 h-14 bg-gray-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Settings2 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Modo Avançado</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Controle total sobre todas as configurações do agente. Para usuários experientes.
                </p>
                <div className="flex items-center text-gray-600 dark:text-gray-400 font-medium">
                  Configurar <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </button>
            </div>
          )}

          {/* Simple Mode - Description Input */}
          {mode === CREATION_MODES.SIMPLE && !reviewMode && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Agent Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo de Agente
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['linkedin', 'email', 'whatsapp'].map((type) => {
                    const Icon = getAgentTypeIcon(type);
                    return (
                      <button
                        key={type}
                        onClick={() => setAgentType(type)}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          agentType === type
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{getAgentTypeLabel(type)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product/Service Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  O que você vende? <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productService}
                  onChange={(e) => setProductService(e.target.value)}
                  placeholder="Ex: Software de gestão financeira, Consultoria de marketing, Plataforma de e-commerce..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Descreva brevemente seu produto ou serviço
                </p>
              </div>

              {/* Objective Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Qual o objetivo do agente? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AGENT_OBJECTIVES.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setObjective(obj.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        objective === obj.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <span className={`font-medium text-sm ${objective === obj.id ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>
                        {obj.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{obj.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Detalhes adicionais <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Meu público-alvo são pequenas empresas. O agente deve ser empático, fazer perguntas para entender as dores do cliente e apresentar a solução de forma personalizada."
                  className="w-full h-28 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Adicione instruções específicas sobre tom, público-alvo, etc.
                  </span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              {/* Error Message */}
              {generationError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{generationError}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || !productService.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando configuração...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Gerar Configuração com IA
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500">
                A IA irá criar o prompt do sistema, mensagem inicial, passos da conversa e muito mais.
              </p>
            </div>
          )}

          {/* Template Mode - Gallery (selecting template) */}
          {mode === CREATION_MODES.TEMPLATES && !reviewMode && !templateConfigStep && (
            <div>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="group relative p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all text-left overflow-hidden"
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon with gradient background */}
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${template.color}30 0%, ${template.color}60 100%)`,
                            border: `2px solid ${template.color}40`
                          }}
                        >
                          {template.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-gray-900">{template.name}</h3>
                            {template.badge && (
                              <span
                                className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
                                style={{ backgroundColor: template.color }}
                              >
                                {template.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-1">por {template.author}</p>
                          <p className="text-sm text-gray-600 line-clamp-2">{template.shortDescription}</p>

                          {/* Ideal For */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {template.ideal_for?.industry?.slice(0, 3).map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors flex-shrink-0 mt-2" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Template Mode - Configuration Step (after selecting template) */}
          {mode === CREATION_MODES.TEMPLATES && templateConfigStep && !reviewMode && selectedTemplate && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Selected Template Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-md flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${selectedTemplate.color}30 0%, ${selectedTemplate.color}60 100%)`,
                      border: `2px solid ${selectedTemplate.color}40`
                    }}
                  >
                    {selectedTemplate.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedTemplate.name}</h3>
                    <p className="text-sm text-gray-600">{selectedTemplate.shortDescription}</p>
                  </div>
                </div>
              </div>

              {/* Product/Service Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  O que você vende? <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productService}
                  onChange={(e) => setProductService(e.target.value)}
                  placeholder="Ex: Software de gestão financeira, Consultoria de marketing, Plataforma de e-commerce..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Descreva brevemente seu produto ou serviço
                </p>
              </div>

              {/* Objective Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qual o objetivo do agente? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AGENT_OBJECTIVES.map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      onClick={() => setObjective(obj.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        objective === obj.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`font-medium text-sm ${objective === obj.id ? 'text-purple-700' : 'text-gray-700'}`}>
                        {obj.label}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{obj.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Message */}
              {generationError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{generationError}</p>
                </div>
              )}

              {/* Apply Template Button */}
              <button
                onClick={handleApplyTemplate}
                disabled={applyingTemplate || !productService.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {applyingTemplate ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Aplicando template...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Aplicar Template
                  </>
                )}
              </button>
            </div>
          )}

          {/* Template Edit Mode (for editing existing template-based agents) - NOT when reviewMode is active */}
          {mode === CREATION_MODES.TEMPLATE_EDIT && editableConfig && !reviewMode && (
            <div className="space-y-6">
              {/* Agent Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editableConfig.name || ''}
                      onChange={(e) => setEditableConfig({ ...editableConfig, name: e.target.value })}
                      className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-transparent hover:border-blue-300 dark:hover:border-blue-600 focus:border-blue-500 focus:outline-none w-full"
                      placeholder="Nome do Agente"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                        {getAgentTypeLabel(agentType)}
                      </span>
                      {editableConfig.template_name ? (
                        <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full flex items-center gap-1">
                          <BookTemplate className="w-3 h-3" />
                          {editableConfig.template_name}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Gerado por IA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editableConfig.description || ''}
                  onChange={(e) => setEditableConfig({ ...editableConfig, description: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Uma breve descrição do agente..."
                />
              </div>

              {/* Initial Message */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mensagem Inicial
                </label>
                <textarea
                  ref={initialMessageRef}
                  value={editableConfig.initial_message || ''}
                  onChange={(e) => setEditableConfig({ ...editableConfig, initial_message: e.target.value })}
                  className="w-full h-28 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
                {/* Variable Badges */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Variable className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Variáveis - clique para inserir:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_VARIABLES.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={() => insertVariable(variable.key)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-mono rounded-md border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                        title={variable.description}
                      >
                        {variable.key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* System Prompt (collapsible) */}
              <details className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <summary className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Prompt do Sistema</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Clique para expandir</span>
                </summary>
                <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700">
                  <textarea
                    value={editableConfig.system_prompt || ''}
                    onChange={(e) => setEditableConfig({ ...editableConfig, system_prompt: e.target.value })}
                    className="w-full h-48 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </details>

              {/* Behavioral Profile */}
              {editableConfig.behavioral_profile && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Perfil Comportamental
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { key: 'formality', label: 'Formalidade' },
                      { key: 'friendliness', label: 'Simpatia' },
                      { key: 'assertiveness', label: 'Assertividade' },
                      { key: 'professionalism', label: 'Profissionalismo' }
                    ].map((trait) => (
                      <div key={trait.key} className="text-center">
                        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{trait.label}</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editableConfig.behavioral_profile[trait.key] || 50}
                          onChange={(e) => setEditableConfig({
                            ...editableConfig,
                            behavioral_profile: {
                              ...editableConfig.behavioral_profile,
                              [trait.key]: parseInt(e.target.value)
                            }
                          })}
                          className="w-full accent-blue-600"
                        />
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {editableConfig.behavioral_profile[trait.key] || 50}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation Steps Preview */}
              {editableConfig.conversation_steps?.length > 0 && (
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Passos da Conversa ({editableConfig.conversation_steps.length})
                  </label>
                  <div className="space-y-2">
                    {editableConfig.conversation_steps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{step.name || step.step_name}</span>
                        {step.description && (
                          <span className="text-gray-500 dark:text-gray-400 text-xs">- {step.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Review Mode (shared between simple and template creation - NOT for TEMPLATE_EDIT mode) */}
          {reviewMode && editableConfig && mode !== CREATION_MODES.TEMPLATE_EDIT && (
            <div className="space-y-6">
              {/* Config Summary Card */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl p-6 border border-purple-200 dark:border-purple-700">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-purple-600 rounded-xl flex items-center justify-center">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editableConfig.name || ''}
                      onChange={(e) => setEditableConfig({ ...editableConfig, name: e.target.value })}
                      className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600 focus:border-purple-500 focus:outline-none w-full"
                      placeholder="Nome do Agente"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                        {getAgentTypeLabel(agentType)}
                      </span>
                      {mode === CREATION_MODES.TEMPLATES && selectedTemplate && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                          {selectedTemplate.name}
                        </span>
                      )}
                      {mode === CREATION_MODES.SIMPLE && (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium rounded-full flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Gerado por IA
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable Sections */}
              <div className="grid gap-4">
                {/* System Prompt */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt do Sistema
                  </label>
                  <textarea
                    value={editableConfig.system_prompt || ''}
                    onChange={(e) => setEditableConfig({ ...editableConfig, system_prompt: e.target.value })}
                    className="w-full h-32 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Initial Message */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Mensagem Inicial
                  </label>
                  <textarea
                    ref={initialMessageRef}
                    value={editableConfig.initial_message || ''}
                    onChange={(e) => setEditableConfig({ ...editableConfig, initial_message: e.target.value })}
                    className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  {/* Variable Badges */}
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Variable className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Variables - click to insert:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_VARIABLES.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          onClick={() => insertVariable(variable.key)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-mono rounded-md border border-purple-200 dark:border-purple-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                          title={variable.description}
                        >
                          {variable.key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Behavioral Profile Summary */}
                {editableConfig.behavioral_profile && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Perfil Comportamental
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {['formality', 'friendliness', 'assertiveness', 'professionalism'].map((trait) => (
                        <div key={trait} className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="text-xs text-gray-500 dark:text-gray-400 capitalize mb-1">{trait}</div>
                          <div className="font-medium text-purple-600 dark:text-purple-400">
                            {editableConfig.behavioral_profile[trait] || 0}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Steps Preview */}
                {editableConfig.conversation_steps?.length > 0 && (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Passos da Conversa ({editableConfig.conversation_steps.length} passos)
                    </label>
                    <div className="space-y-2">
                      {editableConfig.conversation_steps.slice(0, 3).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <span className="w-6 h-6 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{step.name || step.step_name}</span>
                        </div>
                      ))}
                      {editableConfig.conversation_steps.length > 3 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">
                          + {editableConfig.conversation_steps.length - 3} mais passos
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Refine with AI (only for simple mode) */}
              {mode === CREATION_MODES.SIMPLE && (
                <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
                  {!showRefineInput ? (
                    <button
                      onClick={() => setShowRefineInput(true)}
                      className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-medium hover:text-purple-800 dark:hover:text-purple-200"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refinar com IA
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={refineFeedback}
                        onChange={(e) => setRefineFeedback(e.target.value)}
                        placeholder="Descreva o que você quer mudar..."
                        className="w-full p-3 border border-purple-300 dark:border-purple-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRefine}
                          disabled={refining || !refineFeedback.trim()}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                        >
                          {refining ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          Aplicar
                        </button>
                        <button
                          onClick={() => {
                            setShowRefineInput(false);
                            setRefineFeedback('');
                          }}
                          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer for Template Edit Mode - exclusive, not when reviewMode is active */}
        {mode === CREATION_MODES.TEMPLATE_EDIT && !reviewMode && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode(CREATION_MODES.ADVANCED)}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <Settings2 className="w-4 h-4" />
                Modo avançado
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editableConfig?.name}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer for Review Mode - exclusive, not for TEMPLATE_EDIT mode */}
        {reviewMode && mode !== CREATION_MODES.TEMPLATE_EDIT && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode(CREATION_MODES.ADVANCED)}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <Settings2 className="w-4 h-4" />
                Editar no modo avançado
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !editableConfig?.name}
                  className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Criar Agente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleAgentWizard;
