import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, List, Bot, Settings, Eye, Mail, MessageCircle, Linkedin, AlertCircle } from 'lucide-react';
import api from '../services/api';

const ActivationCampaignWizard = ({ isOpen, onClose, onSubmit, campaign = null }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lists, setLists] = useState([]);
  const [agents, setAgents] = useState([]);
  const [userAccounts, setUserAccounts] = useState({
    email: false,
    whatsapp: false,
    linkedin: false
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contact_list_id: null,
    // Agentes por canal
    email_agent_id: null,
    whatsapp_agent_id: null,
    linkedin_agent_id: null,
    // Canais ativos
    activate_email: false,
    activate_whatsapp: false,
    activate_linkedin: false,
    daily_limit: 50,
    start_date: new Date().toISOString().split('T')[0],
    is_active: false
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadLists();
      loadAgents();
      loadUserAccounts();
      if (campaign) {
        setFormData({
          name: campaign.name || '',
          description: campaign.description || '',
          contact_list_id: campaign.contact_list_id || null,
          email_agent_id: campaign.email_agent_id || null,
          whatsapp_agent_id: campaign.whatsapp_agent_id || null,
          linkedin_agent_id: campaign.linkedin_agent_id || null,
          activate_email: campaign.activate_email || false,
          activate_whatsapp: campaign.activate_whatsapp || false,
          activate_linkedin: campaign.activate_linkedin || false,
          daily_limit: campaign.daily_limit || 50,
          start_date: campaign.start_date ? new Date(campaign.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          is_active: false
        });
      }
    }
  }, [isOpen, campaign]);

  const loadLists = async () => {
    try {
      const response = await api.getContactLists();
      if (response.success) {
        setLists(response.data.lists || []);
      }
    } catch (error) {
      console.error('Error loading lists:', error);
    }
  };

  const loadAgents = async () => {
    try {
      // Busca agentes da API unificada
      const response = await api.getAgents();
      if (response.success) {
        // Filtra apenas agentes de ativação (email, whatsapp, linkedin)
        // Exclui google_maps pois não é usado em campanhas de ativação de listas
        const activationAgents = (response.data.agents || []).filter(agent =>
          ['email', 'whatsapp', 'linkedin'].includes(agent.agent_type)
        );
        setAgents(activationAgents);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  };

  const loadUserAccounts = async () => {
    try {
      // TODO: Implement actual account validation API
      // For now, mock data - in real implementation, check if user has connected accounts
      const response = await api.getConnectedAccounts();
      if (response.success) {
        setUserAccounts({
          email: response.data.accounts.some(acc => acc.type === 'email'),
          whatsapp: response.data.accounts.some(acc => acc.type === 'whatsapp'),
          linkedin: response.data.accounts.some(acc => acc.type === 'linkedin')
        });
      }
    } catch (error) {
      // If endpoint doesn't exist yet, assume all accounts are available
      console.warn('Could not load accounts, assuming all available:', error);
      setUserAccounts({
        email: true,
        whatsapp: true,
        linkedin: true
      });
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };


  const validateStep = (step) => {
    const newErrors = {};

    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          newErrors.name = 'Nome é obrigatório';
        }
        break;

      case 2:
        if (!formData.contact_list_id) {
          newErrors.contact_list_id = 'Selecione uma lista de contatos';
        }
        break;

      case 3:
        // Validar que pelo menos um canal está ativado
        if (!formData.activate_email && !formData.activate_whatsapp && !formData.activate_linkedin) {
          newErrors.agents = 'Ative pelo menos um canal de comunicação';
        }

        // Validar que canais ativos têm agentes selecionados
        if (formData.activate_email && !formData.email_agent_id) {
          newErrors.email_agent = 'Selecione um agente de Email';
        }
        if (formData.activate_whatsapp && !formData.whatsapp_agent_id) {
          newErrors.whatsapp_agent = 'Selecione um agente de WhatsApp';
        }
        if (formData.activate_linkedin && !formData.linkedin_agent_id) {
          newErrors.linkedin_agent = 'Selecione um agente de LinkedIn';
        }
        break;

      case 4:
        if (!formData.daily_limit || formData.daily_limit < 1) {
          newErrors.daily_limit = 'Limite diário deve ser pelo menos 1';
        }
        if (!formData.start_date) {
          newErrors.start_date = 'Data de início é obrigatória';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    try {
      setLoading(true);
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      console.error('Error submitting campaign:', error);
      setErrors({ submit: error.message || 'Erro ao criar campanha' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      name: '',
      description: '',
      contact_list_id: null,
      email_agent_id: null,
      whatsapp_agent_id: null,
      linkedin_agent_id: null,
      activate_email: false,
      activate_whatsapp: false,
      activate_linkedin: false,
      daily_limit: 50,
      start_date: new Date().toISOString().split('T')[0],
      is_active: false
    });
    setErrors({});
    onClose();
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'email': return Mail;
      case 'whatsapp': return MessageCircle;
      case 'linkedin': return Linkedin;
      default: return Mail;
    }
  };

  const getChannelColor = (channel) => {
    switch (channel) {
      case 'email': return 'blue';
      case 'whatsapp': return 'green';
      case 'linkedin': return 'purple';
      default: return 'gray';
    }
  };

  const getChannelLabel = (channel) => {
    switch (channel) {
      case 'email': return 'Email';
      case 'whatsapp': return 'WhatsApp';
      case 'linkedin': return 'LinkedIn';
      default: return channel;
    }
  };

  const selectedList = lists.find(l => l.id === formData.contact_list_id);
  const selectedEmailAgent = agents.find(a => a.id === formData.email_agent_id);
  const selectedWhatsappAgent = agents.find(a => a.id === formData.whatsapp_agent_id);
  const selectedLinkedinAgent = agents.find(a => a.id === formData.linkedin_agent_id);

  const steps = [
    { number: 1, title: 'Informações', icon: Settings },
    { number: 2, title: 'Lista', icon: List },
    { number: 3, title: 'Agentes', icon: Bot },
    { number: 4, title: 'Configurações', icon: Settings },
    { number: 5, title: 'Revisão', icon: Eye }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {campaign ? 'Editar Campanha' : 'Nova Campanha de Ativação'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Configure sua campanha de ativação automatizada
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;

              return (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-purple-600 text-white'
                          : isCompleted
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium ${
                        isActive ? 'text-purple-600 dark:text-purple-400' : isCompleted ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 rounded transition-colors ${
                        currentStep > step.number ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Informações da Campanha
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Comece definindo um nome e descrição para sua campanha
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                    errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Ex: Campanha de Outreach Q1 2024"
                />
                {errors.name && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Descreva o objetivo e estratégia desta campanha..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Select List */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Selecione a Lista de Contatos
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Escolha a lista que será usada para esta campanha
                </p>
              </div>

              {errors.contact_list_id && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errors.contact_list_id}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {lists.length === 0 ? (
                  <div className="text-center py-8">
                    <List className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 dark:text-gray-400">Nenhuma lista disponível</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Crie uma lista primeiro para continuar
                    </p>
                  </div>
                ) : (
                  lists.map((list) => {
                    const isSelected = formData.contact_list_id === list.id;
                    const itemCount = parseInt(list.item_count) || 0;

                    return (
                      <button
                        key={list.id}
                        onClick={() => handleChange('contact_list_id', list.id)}
                        className={`p-4 border-2 rounded-lg text-left transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{list.name}</h4>
                            {list.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{list.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
                              <span>{itemCount} contatos</span>
                              {list.activated_count > 0 && (
                                <span className="text-green-600 dark:text-green-400">
                                  {list.activated_count} ativados
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="ml-4">
                              <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 3: Select Agents by Channel */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Canais e Agentes de Ativação
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Escolha os canais e selecione um agente para cada um. Você pode ativar múltiplos canais simultaneamente.
                </p>
              </div>

              {errors.agents && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errors.agents}
                </div>
              )}

              <div className="space-y-4">
                {/* Email Activation - Coming Soon */}
                <div className="space-y-3 opacity-60">
                  <div className="flex items-center space-x-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-not-allowed bg-gray-50 dark:bg-gray-800/50">
                    <input
                      type="checkbox"
                      checked={false}
                      disabled
                      className="w-5 h-5 text-gray-400 rounded cursor-not-allowed"
                    />
                    <Mail className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-500 dark:text-gray-400">Ativar por Email</span>
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Em breve
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Enviar mensagens por email</p>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Activation */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.activate_whatsapp}
                      onChange={(e) => handleChange('activate_whatsapp', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">Ativar por WhatsApp</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enviar mensagens pelo WhatsApp</p>
                    </div>
                  </label>

                  {formData.activate_whatsapp && (
                    <div className="ml-11 pl-4 border-l-2 border-purple-200 dark:border-purple-700">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Agente de WhatsApp *
                      </label>
                      {agents.filter(a => a.agent_type === 'whatsapp').length === 0 ? (
                        <div className="text-sm text-amber-600 dark:text-amber-400">
                          Nenhum agente de WhatsApp ativo. Crie um agente na página de Agentes.
                        </div>
                      ) : (
                        <select
                          value={formData.whatsapp_agent_id || ''}
                          onChange={(e) => handleChange('whatsapp_agent_id', e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                            errors.whatsapp_agent ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <option value="">Selecione um agente de WhatsApp</option>
                          {agents.filter(a => a.agent_type === 'whatsapp').map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.whatsapp_agent && (
                        <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.whatsapp_agent}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* LinkedIn Activation */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.activate_linkedin}
                      onChange={(e) => handleChange('activate_linkedin', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <Linkedin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">Ativar por LinkedIn</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enviar mensagens pelo LinkedIn</p>
                    </div>
                  </label>

                  {formData.activate_linkedin && (
                    <div className="ml-11 pl-4 border-l-2 border-purple-200 dark:border-purple-700">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Agente de LinkedIn *
                      </label>
                      {agents.filter(a => a.agent_type === 'linkedin').length === 0 ? (
                        <div className="text-sm text-amber-600 dark:text-amber-400">
                          Nenhum agente de LinkedIn ativo. Crie um agente na página de Agentes.
                        </div>
                      ) : (
                        <select
                          value={formData.linkedin_agent_id || ''}
                          onChange={(e) => handleChange('linkedin_agent_id', e.target.value)}
                          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                            errors.linkedin_agent ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          <option value="">Selecione um agente de LinkedIn</option>
                          {agents.filter(a => a.agent_type === 'linkedin').map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.linkedin_agent && (
                        <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.linkedin_agent}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Settings */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Configurações da Campanha
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Configure os limites e programação da sua campanha
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Limite Diário de Ativações *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.daily_limit}
                  onChange={(e) => handleChange('daily_limit', parseInt(e.target.value) || 0)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                    errors.daily_limit ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.daily_limit && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.daily_limit}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Número máximo de contatos que serão ativados por dia
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data de Início *
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                    errors.start_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.start_date && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.start_date}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  A campanha começará nesta data (você pode ativá-la depois)
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                      Campanha em modo de rascunho
                    </h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      A campanha será criada no modo pausado. Você precisará ativá-la manualmente
                      na página de campanhas quando estiver pronto para começar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Revisão da Campanha
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Confira todos os detalhes antes de criar sua campanha
                </p>
              </div>

              <div className="space-y-4">
                {/* Basic Info */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Informações Básicas</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Nome:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formData.name}</span>
                    </div>
                    {formData.description && (
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Descrição:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100 text-right max-w-xs">
                          {formData.description}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Lista de Contatos</h4>
                  {selectedList && (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Lista:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{selectedList.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Total de contatos:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{selectedList.item_count || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agents by Channel */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Agentes e Canais de Ativação</h4>
                  <div className="space-y-3">
                    {/* Email */}
                    {formData.activate_email && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Email</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {selectedEmailAgent ? selectedEmailAgent.name : 'Agente não encontrado'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* WhatsApp */}
                    {formData.activate_whatsapp && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">WhatsApp</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {selectedWhatsappAgent ? selectedWhatsappAgent.name : 'Agente não encontrado'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* LinkedIn */}
                    {formData.activate_linkedin && (
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <Linkedin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">LinkedIn</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {selectedLinkedinAgent ? selectedLinkedinAgent.name : 'Agente não encontrado'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Configurações</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Limite diário:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formData.daily_limit} ativações/dia</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Data de início:</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {new Date(formData.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status inicial:</span>
                      <span className="font-medium text-yellow-600 dark:text-yellow-400">Pausada</span>
                    </div>
                  </div>
                </div>
              </div>

              {errors.submit && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errors.submit}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}

            {currentStep < 5 ? (
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
                    Criar Campanha
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

export default ActivationCampaignWizard;
