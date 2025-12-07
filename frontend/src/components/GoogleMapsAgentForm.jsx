// frontend/src/components/GoogleMapsAgentForm.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Bot, MapPin, Search, Star, Phone, Mail, Loader2,
  Database, Send, MessageCircle, DollarSign, ChevronLeft,
  ChevronRight, RefreshCw, Check, Users, Building2
} from 'lucide-react';
import LocationMapPicker from './LocationMapPicker';
import RodizioUserSelector from './RodizioUserSelector';
import { BUSINESS_CATEGORIES, detectUserLanguage, getTranslatedCategories } from '../data/businessCategories';
import apiService from '../services/api';

const GoogleMapsAgentForm = ({ onClose, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Agents state
  const [emailAgents, setEmailAgents] = useState([]);
  const [whatsappAgents, setWhatsappAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Sectors state
  const [sectors, setSectors] = useState([]);
  const [loadingSectors, setLoadingSectors] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Name only
    name: '',

    // Step 2: Location
    location: null, // { lat, lng, radius, location, city, country }

    // Step 3: Niche
    businessCategory: '', // Optional
    businessSpecification: '', // Optional (but at least one required)

    // Step 4: Filters
    minRating: null,
    minReviews: null,
    requirePhone: false,
    requireEmail: false,

    // Step 5: Actions
    actionType: 'crm_only',
    activateEmail: false,
    emailAgentId: null,
    activateWhatsapp: false,
    whatsappAgentId: null,

    // Step 6: Sector and rotation
    sectorId: null,
    assignees: [] // Array of {id, name, email} in rotation order
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detect user language for categories
  const userLang = detectUserLanguage();
  const translatedCategories = getTranslatedCategories(userLang).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  // Load agents and sectors when component mounts
  useEffect(() => {
    loadAgents();
    loadSectors();
  }, []);

  const loadAgents = async () => {
    try {
      setLoadingAgents(true);
      const response = await apiService.getAgents();

      if (response.success) {
        const allAgents = response.data.agents || [];
        setEmailAgents(allAgents.filter(a => a.agent_type === 'email' && a.is_active));
        setWhatsappAgents(allAgents.filter(a => a.agent_type === 'whatsapp' && a.is_active));
      }
    } catch (error) {
      console.error('Erro ao carregar agentes:', error);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadSectors = async () => {
    try {
      setLoadingSectors(true);
      const response = await apiService.getSectors();

      if (response.success) {
        setSectors(response.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    } finally {
      setLoadingSectors(false);
    }
  };

  // Update field
  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  // Validation for each step
  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setError('Nome da campanha é obrigatório');
          return false;
        }
        return true;

      case 2:
        if (!formData.location || !formData.location.lat || !formData.location.lng) {
          setError('Selecione uma localização no mapa');
          return false;
        }
        return true;

      case 3:
        if (!formData.businessCategory && !formData.businessSpecification) {
          setError('Preencha a categoria OU a especificação (pelo menos uma)');
          return false;
        }
        return true;

      case 4:
        return true; // No validation needed

      case 5:
        // Validate activation agents
        if (formData.activateEmail && !formData.emailAgentId) {
          setError('Selecione um agente de Email para ativação ou desmarque esta opção');
          return false;
        }
        if (formData.activateWhatsapp && !formData.whatsappAgentId) {
          setError('Selecione um agente de WhatsApp para ativação ou desmarque esta opção');
          return false;
        }
        return true;

      case 6:
        // Sector and rotation validation
        if (!formData.sectorId) {
          setError('Selecione um setor para os leads');
          return false;
        }
        if (formData.assignees.length === 0) {
          setError('Selecione pelo menos um usuário para o rodízio');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  // Navigate steps
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
      setError(null);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    // Final validation
    if (!validateStep(currentStep)) {
      return;
    }

    try {
      setLoading(true);

      // Build search query from category + specification
      let searchQuery = '';
      if (formData.businessSpecification && formData.businessCategory) {
        searchQuery = `${formData.businessSpecification} ${formData.businessCategory}`;
      } else {
        searchQuery = formData.businessSpecification || formData.businessCategory;
      }

      // Prepare payload for API
      const payload = {
        name: formData.name,

        // Location
        searchLocation: formData.location?.location || formData.location?.city || `Lat: ${formData.location?.lat}, Lng: ${formData.location?.lng}`,
        searchCountry: formData.location?.country || '',
        latitude: formData.location?.lat,
        longitude: formData.location?.lng,
        radius: formData.location?.radius || 10,

        // Search query
        searchQuery: searchQuery,
        businessCategory: formData.businessCategory,
        businessSpecification: formData.businessSpecification,

        // Filters
        minRating: formData.minRating,
        minReviews: formData.minReviews,
        requirePhone: formData.requirePhone,
        requireEmail: formData.requireEmail,

        // Action (always CRM)
        actionType: 'crm_only',

        // Activation agents
        activateEmail: formData.activateEmail,
        emailAgentId: formData.activateEmail ? formData.emailAgentId : null,
        activateWhatsapp: formData.activateWhatsapp,
        whatsappAgentId: formData.activateWhatsapp ? formData.whatsappAgentId : null,

        // Sector
        sectorId: formData.sectorId,

        // Assignees for rotation (will be set after agent creation)
        assignees: formData.assignees.map(u => u.id),

        // Fixed params
        dailyLimit: 20
      };

      await onSubmit(payload);
    } catch (error) {
      setError(error.message || 'Erro ao criar campanha');
      setLoading(false);
    }
  };

  // Step progress indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-6">
      {[1, 2, 3, 4, 5, 6].map(step => (
        <div
          key={step}
          className={`h-2 w-10 rounded-full transition-all ${
            step === currentStep
              ? 'bg-purple-600'
              : step < currentStep
              ? 'bg-purple-300 dark:bg-purple-500'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Criar Campanha Google Maps
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Passo {currentStep} de {totalSteps}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pt-6">
          <StepIndicator />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Step 1: Name */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Dê um nome à sua coleta de leads
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Escolha um nome descritivo para identificar esta configuração
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome da Configuração <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Ex: Academias em São Paulo"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Onde você quer buscar leads?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Pesquise uma cidade, cole um link do Google Maps, ou clique no mapa
                </p>
              </div>

              <LocationMapPicker
                value={formData.location}
                onChange={(locationData) => updateField('location', locationData)}
              />
            </div>
          )}

          {/* Step 3: Niche */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Qual nicho você quer prospectar?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Preencha pelo menos uma das opções abaixo
                </p>
              </div>

              {/* Category (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Categoria principal
                </label>
                <select
                  value={formData.businessCategory}
                  onChange={(e) => updateField('businessCategory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Nenhuma categoria</option>
                  {translatedCategories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Specification (optional but one required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Especificação
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.businessSpecification}
                    onChange={(e) => updateField('businessSpecification', e.target.value)}
                    placeholder="Ex: Nutricionista, Pizzaria, Academia CrossFit..."
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 Exemplos: "Dentist" + "Dentist", "Health" + "Nutritionist", ou apenas "Pizzeria"
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Filters */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Filtros de qualificação
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Defina critérios para filtrar os melhores leads
                </p>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Avaliação mínima
                </label>
                <select
                  value={formData.minRating || ''}
                  onChange={(e) => updateField('minRating', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Qualquer avaliação</option>
                  <option value="4.5">⭐ 4.5+</option>
                  <option value="4.0">⭐ 4.0+</option>
                  <option value="3.5">⭐ 3.5+</option>
                  <option value="3.0">⭐ 3.0+</option>
                </select>
              </div>

              {/* Reviews */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mínimo de avaliações
                </label>
                <select
                  value={formData.minReviews || ''}
                  onChange={(e) => updateField('minReviews', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Qualquer quantidade</option>
                  <option value="100">100+ avaliações</option>
                  <option value="50">50+ avaliações</option>
                  <option value="20">20+ avaliações</option>
                  <option value="10">10+ avaliações</option>
                </select>
              </div>

              {/* Contact requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Informações de contato obrigatórias
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.requirePhone}
                      onChange={(e) => updateField('requirePhone', e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:focus:ring-purple-400 dark:ring-offset-gray-800"
                    />
                    <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Exigir telefone</span>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.requireEmail}
                      onChange={(e) => updateField('requireEmail', e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:focus:ring-purple-400 dark:ring-offset-gray-800"
                    />
                    <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Exigir email</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Actions + Summary */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Ativação de Leads
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure como os leads encontrados serão ativados
                </p>
              </div>

              {/* Base action - Always CRM */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Inserir no CRM</span>
                  <Check className="w-4 h-4 text-green-600 dark:text-green-400 ml-auto" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Todos os leads serão automaticamente adicionados ao seu CRM
                </p>
              </div>

              {/* Activation channels */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Canais de Ativação (opcional)
                </h4>

                {/* Email Activation */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.activateEmail}
                      onChange={(e) => updateField('activateEmail', e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:focus:ring-purple-400 dark:ring-offset-gray-800"
                    />
                    <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">Ativar por Email</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enviar mensagem de apresentação por email</p>
                    </div>
                  </label>

                  {formData.activateEmail && (
                    <div className="ml-11 pl-4 border-l-2 border-purple-200 dark:border-purple-700">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Agente de Email *
                      </label>
                      {loadingAgents ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Carregando agentes...</div>
                      ) : emailAgents.length === 0 ? (
                        <div className="text-sm text-amber-600 dark:text-amber-400">
                          Nenhum agente de Email ativo. Crie um agente na página de Agentes.
                        </div>
                      ) : (
                        <select
                          value={formData.emailAgentId || ''}
                          onChange={(e) => updateField('emailAgentId', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Selecione um agente de Email</option>
                          {emailAgents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                {/* WhatsApp Activation */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.activateWhatsapp}
                      onChange={(e) => updateField('activateWhatsapp', e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:focus:ring-purple-400 dark:ring-offset-gray-800"
                    />
                    <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100">Ativar por WhatsApp</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enviar mensagem de apresentação pelo WhatsApp</p>
                    </div>
                  </label>

                  {formData.activateWhatsapp && (
                    <div className="ml-11 pl-4 border-l-2 border-purple-200 dark:border-purple-700">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Agente de WhatsApp *
                      </label>
                      {loadingAgents ? (
                        <div className="text-sm text-gray-500 dark:text-gray-400">Carregando agentes...</div>
                      ) : whatsappAgents.length === 0 ? (
                        <div className="text-sm text-amber-600 dark:text-amber-400">
                          Nenhum agente de WhatsApp ativo. Crie um agente na página de Agentes.
                        </div>
                      ) : (
                        <select
                          value={formData.whatsappAgentId || ''}
                          onChange={(e) => updateField('whatsappAgentId', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Selecione um agente de WhatsApp</option>
                          {whatsappAgents.map(agent => (
                            <option key={agent.id} value={agent.id}>
                              {agent.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Sector and Rotation */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Setor e Rodízio de Atendentes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Defina para qual setor os leads serão direcionados e quem irá atendê-los
                </p>
              </div>

              {/* Sector Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Setor <span className="text-red-500">*</span>
                </label>
                {loadingSectors ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando setores...
                  </div>
                ) : sectors.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Nenhum setor encontrado. Crie setores na página de Configurações.
                    </p>
                  </div>
                ) : (
                  <select
                    value={formData.sectorId || ''}
                    onChange={(e) => {
                      updateField('sectorId', e.target.value || null);
                      // Clear assignees when sector changes
                      updateField('assignees', []);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Selecione um setor</option>
                    {sectors.map(sector => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Rotation Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Rodízio de Atendentes <span className="text-red-500">*</span>
                </label>
                <RodizioUserSelector
                  sectorId={formData.sectorId}
                  selectedUsers={formData.assignees}
                  onChange={(assignees) => updateField('assignees', assignees)}
                />
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Como funciona o rodízio:</strong> Os leads encontrados serão distribuídos automaticamente
                  entre os atendentes selecionados, seguindo a ordem definida. Após o último atendente, volta ao primeiro.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1 || loading}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Voltar</span>
          </button>

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center space-x-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <span>Próximo</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 dark:disabled:bg-purple-900/50 text-white rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Criando e Coletando...</span>
                </>
              ) : (
                <>
                  <Bot className="w-5 h-5" />
                  <span>Criar e Coletar Leads</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleMapsAgentForm;
