import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Target, Headphones, ArrowLeft, Plus, Search, Filter, Star,
  Sparkles, MessageSquare, Bot, ChevronRight, Loader, PlayCircle
} from 'lucide-react';
import api from '../services/api';
import AgentTypeSelector from '../components/aiemployees/AgentTypeSelector';
import ChannelSelector from '../components/aiemployees/ChannelSelector';
import TemplateGallery from '../components/aiemployees/TemplateGallery';
import AgentProfileStep from '../components/aiemployees/AgentProfileStep';
import WorkflowBuilder from '../components/aiemployees/WorkflowBuilder';

// Wizard steps for creating AI Employee
const STEPS = {
  SELECT_TYPE: 'select_type',
  SELECT_CHANNEL: 'select_channel',
  SELECT_TEMPLATE: 'select_template',
  AGENT_PROFILE: 'agent_profile',
  WORKFLOW_BUILDER: 'workflow_builder',
  REVIEW: 'review'
};

const AIEmployeesPage = () => {
  const { t } = useTranslation(['agents', 'common']);

  // State
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_TYPE);
  const [agentType, setAgentType] = useState(null); // 'prospeccao' | 'atendimento'
  const [channel, setChannel] = useState(null); // 'linkedin' | 'whatsapp' | 'email' | 'webchat'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [interviewAnswers, setInterviewAnswers] = useState({});
  const [workflowDefinition, setWorkflowDefinition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [showCreator, setShowCreator] = useState(false);

  // Load existing AI employees
  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.getAgents();
      if (response.success) {
        setEmployees(response.data.agents || []);
      }
    } catch (error) {
      console.error('Error loading AI employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle type selection
  const handleTypeSelect = (type) => {
    setAgentType(type);
    setCurrentStep(STEPS.SELECT_CHANNEL);
  };

  // Handle channel selection
  const handleChannelSelect = (selectedChannel) => {
    setChannel(selectedChannel);
    setCurrentStep(STEPS.SELECT_TEMPLATE);
  };

  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setCurrentStep(STEPS.AGENT_PROFILE);
  };

  // Handle profile completion
  const handleProfileComplete = (profile) => {
    setAgentProfile(profile);
    setCurrentStep(STEPS.WORKFLOW_BUILDER);
  };

  // Go back
  const handleBack = () => {
    switch (currentStep) {
      case STEPS.SELECT_CHANNEL:
        setCurrentStep(STEPS.SELECT_TYPE);
        setAgentType(null);
        break;
      case STEPS.SELECT_TEMPLATE:
        setCurrentStep(STEPS.SELECT_CHANNEL);
        setChannel(null);
        break;
      case STEPS.AGENT_PROFILE:
        setCurrentStep(STEPS.SELECT_TEMPLATE);
        setSelectedTemplate(null);
        break;
      case STEPS.WORKFLOW_BUILDER:
        setCurrentStep(STEPS.AGENT_PROFILE);
        break;
      case STEPS.REVIEW:
        setCurrentStep(STEPS.WORKFLOW_BUILDER);
        break;
      default:
        setShowCreator(false);
        setCurrentStep(STEPS.SELECT_TYPE);
        setAgentType(null);
        setChannel(null);
        setSelectedTemplate(null);
        setAgentProfile(null);
        setInterviewAnswers({});
    }
  };

  // Reset wizard
  const handleReset = () => {
    setShowCreator(false);
    setCurrentStep(STEPS.SELECT_TYPE);
    setAgentType(null);
    setChannel(null);
    setSelectedTemplate(null);
    setAgentProfile(null);
    setInterviewAnswers({});
    setWorkflowDefinition(null);
  };

  // Create AI Employee
  const handleCreateAgent = async () => {
    try {
      setLoading(true);

      // Channel display names
      const channelNames = {
        linkedin: 'LinkedIn',
        whatsapp: 'WhatsApp',
        email: 'Email',
        webchat: 'WebChat'
      };

      // Generate agent config from interview + workflow
      const agentConfig = {
        name: agentProfile?.name || `AI ${agentType === 'prospeccao' ? 'SDR' : 'Atendente'} - ${channelNames[channel] || channel}`,
        agent_type: channel, // Use the selected channel
        category: agentType, // 'prospeccao' or 'atendimento'
        template_id: selectedTemplate?.id !== 'scratch' ? selectedTemplate?.id : null,
        agent_profile: agentProfile, // Identidade + Base de Conhecimento
        interview_answers: interviewAnswers,
        workflow_definition: workflowDefinition,
        is_active: true
      };

      // Call API to generate and create agent
      const response = await api.generateAIEmployee(agentConfig);

      if (response.success) {
        // Reload employees list
        await loadEmployees();
        // Reset wizard and go back to list
        handleReset();
        // Show success (you could add a toast notification here)
        console.log('AI Employee created successfully:', response.data);
      }
    } catch (error) {
      console.error('Error creating AI Employee:', error);
      // Handle error (you could add a toast notification here)
    } finally {
      setLoading(false);
    }
  };

  // Step indicator
  const getStepNumber = () => {
    const steps = Object.values(STEPS);
    return steps.indexOf(currentStep) + 1;
  };

  const getTotalSteps = () => {
    return Object.values(STEPS).length;
  };

  // If not in creator mode, show list of employees
  if (!showCreator) {
    return (
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                BETA
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Employees
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Crie e gerencie seus funcionarios IA com fluxos visuais personalizados
            </p>
          </div>
          <button
            onClick={() => setShowCreator(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25"
          >
            <Sparkles className="w-5 h-5" />
            Criar AI Employee
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employees.length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total de Agentes
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employees.filter(e => e.agent_type === 'linkedin').length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Prospeccao
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Headphones className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employees.filter(e => e.agent_type === 'whatsapp').length}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Atendimento
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <MessageSquare className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {employees.reduce((acc, e) => acc + (e.total_interactions || 0), 0)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Interacoes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Employees Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
        ) : employees.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Nenhum AI Employee criado ainda
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Crie seu primeiro funcionario IA para automatizar suas vendas e atendimento com fluxos visuais personalizados.
            </p>
            <button
              onClick={() => setShowCreator(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Criar Primeiro AI Employee
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  {employee.avatar_url ? (
                    <img
                      src={employee.avatar_url}
                      alt={employee.name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {employee.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {employee.agent_type === 'linkedin' ? 'Prospeccao' : 'Atendimento'}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        employee.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {employee.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {employee.total_interactions || 0} interacoes
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Creator wizard
  return (
    <div className={`bg-gray-50 dark:bg-gray-900 ${currentStep === STEPS.WORKFLOW_BUILDER ? 'h-[calc(100vh-56px)] flex flex-col overflow-hidden' : 'min-h-screen'}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                Criar AI Employee
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Passo {getStepNumber()} de {getTotalSteps()}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="hidden md:flex items-center gap-1.5">
            {Object.values(STEPS).map((step, index) => (
              <div
                key={step}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  index < getStepNumber()
                    ? 'bg-purple-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {currentStep === STEPS.WORKFLOW_BUILDER && (
              <button
                onClick={() => setCurrentStep(STEPS.REVIEW)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Continuar para Revisao
              </button>
            )}
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${currentStep === STEPS.WORKFLOW_BUILDER ? 'w-full px-2 flex-1 min-h-0 overflow-hidden' : 'mx-auto max-w-5xl p-4'}`}>
        {currentStep === STEPS.SELECT_TYPE && (
          <AgentTypeSelector onSelect={handleTypeSelect} />
        )}

        {currentStep === STEPS.SELECT_CHANNEL && (
          <ChannelSelector
            agentType={agentType}
            selectedChannel={channel}
            onSelect={handleChannelSelect}
          />
        )}

        {currentStep === STEPS.SELECT_TEMPLATE && (
          <TemplateGallery
            agentType={agentType}
            channel={channel}
            onSelect={handleTemplateSelect}
            onCreateFromScratch={() => {
              setSelectedTemplate({ id: 'scratch', name: 'Do zero' });
              setCurrentStep(STEPS.AGENT_PROFILE);
            }}
          />
        )}

        {currentStep === STEPS.AGENT_PROFILE && (
          <AgentProfileStep
            agentType={agentType}
            channel={channel}
            initialData={agentProfile}
            onComplete={handleProfileComplete}
            onBack={handleBack}
          />
        )}

        {currentStep === STEPS.WORKFLOW_BUILDER && (
          <WorkflowBuilder
            agentType={agentType}
            channel={channel}
            template={selectedTemplate}
            agentProfile={agentProfile}
            onSave={(workflow) => {
              // Auto-save: apenas salva os dados, nao navega
              setWorkflowDefinition(workflow);
            }}
            onPreview={(nodes, edges) => {
              console.log('Preview workflow:', { nodes, edges });
            }}
          />
        )}

        {currentStep === STEPS.REVIEW && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Revisao do AI Employee
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</p>
                <p className="text-gray-900 dark:text-white">
                  {agentType === 'prospeccao' ? 'Prospeccao (Outbound)' : 'Atendimento (Inbound)'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Canal</p>
                <p className="text-gray-900 dark:text-white">
                  {channel === 'linkedin' && 'LinkedIn'}
                  {channel === 'whatsapp' && 'WhatsApp'}
                  {channel === 'email' && 'Email'}
                  {channel === 'webchat' && 'Chat do Site'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Template</p>
                <p className="text-gray-900 dark:text-white">
                  {selectedTemplate?.name || 'Do zero'}
                </p>
              </div>

              {workflowDefinition && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Workflow</p>
                  <p className="text-gray-900 dark:text-white">
                    {workflowDefinition.nodes?.length || 0} etapas configuradas
                  </p>
                </div>
              )}

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
                <p className="text-green-600 dark:text-green-400 font-medium">
                  Pronto para criar
                </p>
              </div>
            </div>

            {agentProfile && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-8 border border-purple-200 dark:border-purple-800">
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-3">Perfil do Agente</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {agentProfile.name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Nome:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">{agentProfile.name}</span>
                    </div>
                  )}
                  {agentProfile.tone && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Tom:</span>
                      <span className="ml-2 text-gray-900 dark:text-white capitalize">{agentProfile.tone}</span>
                    </div>
                  )}
                  {agentProfile.objective && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Objetivo:</span>
                      <span className="ml-2 text-gray-900 dark:text-white capitalize">{agentProfile.objective}</span>
                    </div>
                  )}
                  {agentProfile.company?.name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Empresa:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agentProfile.company.name}</span>
                    </div>
                  )}
                  {agentProfile.product?.name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Produto:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agentProfile.product.name}</span>
                    </div>
                  )}
                  {agentProfile.rules?.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Regras:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agentProfile.rules.length} configuradas</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {Object.entries(interviewAnswers).length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-8">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Configuracoes Coletadas</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(interviewAnswers).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                      <span className="text-gray-900 dark:text-white truncate ml-2">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={handleBack}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Criar AI Employee
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIEmployeesPage;
