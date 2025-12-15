// frontend/src/components/AIAgentModal.jsx
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Target, Zap, BookOpen, Smile, CheckCircle, Building, Brain, Book, UserX, Globe } from 'lucide-react';
import api from '../services/api';

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

const AIAgentModal = ({ isOpen, onClose, onAgentCreated, agent = null }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [profiles, setProfiles] = useState(null);

  // Obter idioma do usuário do localStorage (i18next)
  const getUserLanguage = () => {
    const lng = localStorage.getItem('i18nextLng') || 'pt-BR';
    // Normalizar para códigos suportados
    if (lng.startsWith('pt')) return lng === 'pt-PT' ? 'pt-PT' : 'pt-BR';
    if (lng.startsWith('en')) return 'en';
    if (lng.startsWith('es')) return 'es';
    return 'pt-BR';
  };

  const [formData, setFormData] = useState({
    // Step 1: Produtos/Serviços
    products_services: '',

    // Step 2: Informações do Negócio
    company_description: '',
    value_proposition: '',
    key_differentiators: '',

    // Step 3: Perfil Comportamental
    behavioral_profile: '',

    // Step 4: Regras de Escalação
    escalation_rules: {
      escalate_on_price_question: false,
      escalate_on_specific_feature: false,
      escalate_keywords: [],
      max_messages_before_escalation: 10
    },

    // Step 5: Configuração Final
    name: '',
    language: getUserLanguage(), // Idioma de resposta do agente
    initial_approach: '',
    auto_schedule: false,
    scheduling_link: ''
  });

  const [error, setError] = useState('');
  const isEditMode = !!agent;

  // Carregar perfis comportamentais ao abrir modal
  useEffect(() => {
    if (isOpen && !profiles) {
      loadProfiles();
    }
  }, [isOpen]);

  // Preencher form com dados do agente em modo de edição
  useEffect(() => {
    if (isOpen && agent) {
      setFormData({
        products_services: agent.products_services || '',
        company_description: agent.company_description || '',
        value_proposition: agent.value_proposition || '',
        key_differentiators: Array.isArray(agent.key_differentiators)
          ? agent.key_differentiators.join(', ')
          : '',
        behavioral_profile: agent.behavioral_profile || '',
        escalation_rules: agent.escalation_rules || {
          escalate_on_price_question: false,
          escalate_on_specific_feature: false,
          escalate_keywords: [],
          max_messages_before_escalation: 10
        },
        name: agent.name || '',
        language: agent.language || getUserLanguage(), // Idioma do agente ou preferência do usuário
        initial_approach: agent.initial_approach || '',
        auto_schedule: agent.auto_schedule || false,
        scheduling_link: agent.scheduling_link || ''
      });
    }
  }, [isOpen, agent]);

  const loadProfiles = async () => {
    try {
      const response = await api.getBehavioralProfiles();
      setProfiles(response.data?.profiles || null);
    } catch (err) {
      console.error('Erro ao carregar perfis:', err);
      setError('Erro ao carregar perfis comportamentais');
    }
  };

  const iconMap = {
    consultivo: Target,
    direto: Zap,
    educativo: BookOpen,
    amigavel: Smile
  };

  const behavioralProfiles = profiles || {};

  const handleNext = () => {
    setError('');

    // Step 1: Produtos/Serviços
    if (currentStep === 1) {
      if (!formData.products_services || formData.products_services.trim().length < 10) {
        setError('Descreva seus produtos/serviços (mínimo 10 caracteres)');
        return;
      }
    }

    // Step 2: Informações do Negócio (opcional)
    if (currentStep === 2) {
      // Campos opcionais, sem validação obrigatória
    }

    // Step 3: Perfil Comportamental
    if (currentStep === 3) {
      if (!formData.behavioral_profile) {
        setError('Selecione um perfil comportamental');
        return;
      }

      // Preencher abordagem sugerida se não existir
      const selectedProfile = profiles[formData.behavioral_profile];
      if (selectedProfile && !formData.initial_approach) {
        setFormData(prev => ({
          ...prev,
          initial_approach: selectedProfile.suggestedApproach
        }));
      }
    }

    // Step 4: Regras de Escalação (opcional)
    if (currentStep === 4) {
      // Campos opcionais
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    setError('');

    // Validação Step 5
    if (!formData.name || formData.name.trim().length < 3) {
      setError('Nome do agente obrigatório (mínimo 3 caracteres)');
      return;
    }

    if (!formData.initial_approach) {
      setError('Abordagem inicial obrigatória');
      return;
    }

    if (formData.auto_schedule && !formData.scheduling_link) {
      setError('Link de agendamento obrigatório quando auto-agendamento está ativo');
      return;
    }

    setIsLoading(true);

    try {
      // Preparar dados para envio
      const dataToSubmit = {
        ...formData,
        key_differentiators: formData.key_differentiators
          ? formData.key_differentiators.split(',').map(d => d.trim()).filter(Boolean)
          : []
      };

      if (isEditMode) {
        await api.updateAIAgent(agent.id, dataToSubmit);
      } else {
        await api.createAIAgent(dataToSubmit);
      }
      onAgentCreated();
      handleClose();
    } catch (err) {
      console.error(`Erro ao ${isEditMode ? 'atualizar' : 'criar'} agente:`, err);
      setError(err.message || `Erro ao ${isEditMode ? 'atualizar' : 'criar'} agente`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      products_services: '',
      company_description: '',
      value_proposition: '',
      key_differentiators: '',
      behavioral_profile: '',
      escalation_rules: {
        escalate_on_price_question: false,
        escalate_on_specific_feature: false,
        escalate_keywords: [],
        max_messages_before_escalation: 10
      },
      name: '',
      language: getUserLanguage(), // Reset para idioma do usuário
      initial_approach: '',
      auto_schedule: false,
      scheduling_link: ''
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;
  if (!profiles) return null;

  const steps = [
    { number: 1, name: 'Produtos/Serviços', icon: Book },
    { number: 2, name: 'Informações do Negócio', icon: Building },
    { number: 3, name: 'Perfil Comportamental', icon: Brain },
    { number: 4, name: 'Regras de Escalação', icon: UserX },
    { number: 5, name: 'Configuração Final', icon: Sparkles }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">
              {isEditMode ? 'Editar Agente de IA' : 'Criar Agente de IA'}
            </h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b flex-shrink-0 overflow-x-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center flex-shrink-0">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  currentStep === step.number
                    ? 'bg-blue-600 text-white'
                    : currentStep > step.number
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step.number ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs mt-1 text-gray-600 text-center hidden sm:block">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-16 h-1 mx-1 transition-colors ${
                  currentStep > step.number ? 'bg-green-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Produtos/Serviços */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Book className="w-5 h-5 text-blue-600" />
                  Descreva seus produtos/serviços
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Conte o que sua empresa oferece. Isso ajudará o agente a entender o contexto das conversas.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Produtos/Serviços *
                </label>
                <textarea
                  value={formData.products_services}
                  onChange={(e) => setFormData({ ...formData, products_services: e.target.value })}
                  placeholder="Ex: Consultoria em Marketing Digital para e-commerce B2B, ajudando empresas a aumentar suas vendas através de estratégias de inbound marketing, SEO e automação de vendas."
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.products_services.length} caracteres (mínimo 10)
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Informações do Negócio */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Informações do Negócio
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Detalhe mais sobre sua empresa para que o agente possa contextualizar melhor as conversas.
                  <span className="text-gray-500 italic"> (Todos os campos são opcionais)</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição da Empresa
                </label>
                <textarea
                  value={formData.company_description}
                  onChange={(e) => setFormData({ ...formData, company_description: e.target.value })}
                  placeholder="Ex: Somos uma consultoria fundada em 2020, especializada em ajudar empresas B2B a escalarem suas vendas através de marketing digital."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposta de Valor
                </label>
                <textarea
                  value={formData.value_proposition}
                  onChange={(e) => setFormData({ ...formData, value_proposition: e.target.value })}
                  placeholder="Ex: Aumentamos o ROI de marketing em 3x através de estratégias data-driven e automação inteligente."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Principais Diferenciais
                </label>
                <input
                  type="text"
                  value={formData.key_differentiators}
                  onChange={(e) => setFormData({ ...formData, key_differentiators: e.target.value })}
                  placeholder="Ex: Metodologia própria, Time experiente, Suporte 24/7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separe os diferenciais por vírgula
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Dica:</strong> Após criar o agente, você poderá adicionar uma base de conhecimento completa com FAQs, casos de sucesso, e mais detalhes sobre produtos.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Perfil Comportamental */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-600" />
                  Escolha o perfil do agente
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Selecione o estilo de comunicação que melhor se encaixa com sua abordagem comercial.
                </p>
              </div>

              <div className="space-y-3">
                {Object.entries(behavioralProfiles).map(([key, profile]) => {
                  const Icon = iconMap[key];
                  const isSelected = formData.behavioral_profile === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setFormData({ ...formData, behavioral_profile: key })}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          isSelected ? 'bg-blue-100' : 'bg-gray-100'
                        }`}>
                          <Icon className={`w-5 h-5 ${
                            isSelected ? 'text-blue-600' : 'text-gray-600'
                          }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{profile.icon}</span>
                            <span className="font-medium">{profile.name}</span>
                          </div>
                          <p className="text-sm text-gray-600">{profile.description}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Regras de Escalação */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <UserX className="w-5 h-5 text-blue-600" />
                  Regras de Escalação
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Configure quando o agente deve transferir a conversa para um humano.
                  <span className="text-gray-500 italic"> (Opcional)</span>
                </p>
              </div>

              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.escalation_rules.escalate_on_price_question}
                    onChange={(e) => setFormData({
                      ...formData,
                      escalation_rules: {
                        ...formData.escalation_rules,
                        escalate_on_price_question: e.target.checked
                      }
                    })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Escalar em perguntas sobre preço</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Quando o lead perguntar sobre valores, custos ou planos
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.escalation_rules.escalate_on_specific_feature}
                    onChange={(e) => setFormData({
                      ...formData,
                      escalation_rules: {
                        ...formData.escalation_rules,
                        escalate_on_specific_feature: e.target.checked
                      }
                    })}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Escalar em perguntas técnicas específicas</span>
                    <p className="text-xs text-gray-500 mt-1">
                      Quando o lead pedir detalhes técnicos muito específicos
                    </p>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máximo de mensagens antes de sugerir contato humano
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={formData.escalation_rules.max_messages_before_escalation}
                    onChange={(e) => setFormData({
                      ...formData,
                      escalation_rules: {
                        ...formData.escalation_rules,
                        max_messages_before_escalation: parseInt(e.target.value) || 10
                      }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Após esse número de mensagens, o agente sugerirá falar com um especialista
                  </p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Nota:</strong> As regras de escalação são inteligentes. O agente sempre tentará responder primeiro usando a base de conhecimento antes de escalar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Configurações Finais */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Configurações finais
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Defina o nome do agente e personalize a abordagem inicial.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Agente *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Agente de Vendas B2B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  Idioma de Resposta *
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {AVAILABLE_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  O agente sempre responderá neste idioma, mesmo que o lead escreva em outro
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Abordagem Inicial *
                </label>
                <textarea
                  value={formData.initial_approach}
                  onChange={(e) => setFormData({ ...formData, initial_approach: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Variáveis disponíveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{cargo}}'}, {'{{localizacao}}'}, {'{{industria}}'}, {'{{conexoes}}'}, {'{{resumo}}'}
                </p>
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_schedule}
                    onChange={(e) => setFormData({ ...formData, auto_schedule: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Agendar automaticamente</span>
                </label>
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  Quando o agente detectar alto interesse, oferecerá agendamento automaticamente
                </p>
              </div>

              {formData.auto_schedule && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link de Agendamento *
                  </label>
                  <input
                    type="url"
                    value={formData.scheduling_link}
                    onChange={(e) => setFormData({ ...formData, scheduling_link: e.target.value })}
                    placeholder="https://calendly.com/seu-link"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              <div className="border-t pt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium">Detectar intenção/interesse</span>
                </label>
                <p className="text-xs text-gray-500 ml-6 mt-1">
                  O agente analisará as respostas para identificar o nível de interesse do lead
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t bg-gray-50 flex-shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                Avançar
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isEditMode ? 'Salvando...' : 'Criando...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {isEditMode ? 'Salvar Alterações' : 'Criar Agente'}
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

export default AIAgentModal;
