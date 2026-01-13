// frontend/src/components/GoogleMapsAgentForm.jsx
import React, { useState, useEffect } from 'react';
import {
  X, Bot, MapPin, Search, Star, Phone, Mail, Loader2,
  Database, Send, MessageCircle, DollarSign, ChevronLeft,
  ChevronRight, RefreshCw, Check, Users, Building2, FileDown, Infinity
} from 'lucide-react';
import LocationMapPicker from './LocationMapPicker';
import RodizioUserSelector from './RodizioUserSelector';
import MultipleLocationsManager from './MultipleLocationsManager';
import { BUSINESS_CATEGORIES, detectUserLanguage, getTranslatedCategories } from '../data/businessCategories';
import apiService from '../services/api';

const GoogleMapsAgentForm = ({ onClose, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  // totalSteps is dynamic: 6 steps when inserting in CRM, 5 steps when just generating list
  const [totalSteps, setTotalSteps] = useState(6);

  // Agents state
  const [emailAgents, setEmailAgents] = useState([]);
  const [whatsappAgents, setWhatsappAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Pipeline/CRM state
  const [crmProjects, setCrmProjects] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [pipelineUsers, setPipelineUsers] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Name only
    name: '',

    // Step 2: Location
    useMultipleLocations: false, // Toggle between single/multiple locations
    location: null, // { lat, lng, radius, location, city, country }
    locations: [], // Multiple locations: [{ id, lat, lng, radius, location, city, country, searchType }]
    locationDistribution: 'proportional', // 'proportional' or 'sequential'

    // Step 3: Niche
    businessCategory: '', // Optional
    businessSpecification: '', // Optional (but at least one required)

    // Step 4: Filters
    minRating: null,
    minReviews: null,
    dailyLimit: 20, // Leads per day (null = unlimited)

    // Step 5: Actions
    insertInCrm: true, // true = insert in CRM, false = just generate list
    activateEmail: false,
    emailAgentId: null,
    activateWhatsapp: false,
    whatsappAgentId: null,

    // Step 6: Pipeline and rotation (only when insertInCrm is true)
    projectId: null, // Optional - for filtering pipelines
    pipelineId: null, // Required - which pipeline to insert leads
    stageId: null, // Required - which stage to insert leads
    assignees: [] // Array of {id, name, email} in rotation order
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detect user language for categories
  const userLang = detectUserLanguage();
  const translatedCategories = getTranslatedCategories(userLang).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  // Load agents and pipelines when component mounts
  useEffect(() => {
    loadAgents();
    loadCrmProjects();
    loadPipelines();
  }, []);

  // Update totalSteps when insertInCrm changes
  useEffect(() => {
    setTotalSteps(formData.insertInCrm ? 6 : 5);
  }, [formData.insertInCrm]);

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

  // Load CRM projects (optional, for filtering pipelines)
  const loadCrmProjects = async () => {
    try {
      const response = await apiService.getCrmProjects();
      if (response.success) {
        // API returns data inside response.data
        setCrmProjects(response.data?.projects || response.projects || []);
      }
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
    }
  };

  // Load pipelines (optionally filter by project)
  const loadPipelines = async (projectId = null) => {
    try {
      setLoadingPipelines(true);
      const params = projectId ? { project_id: projectId } : {};
      const response = await apiService.getPipelines(params);
      if (response.success) {
        // API returns data inside response.data
        setPipelines(response.data?.pipelines || response.pipelines || []);
      }
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    } finally {
      setLoadingPipelines(false);
    }
  };

  // Load stages and users for a specific pipeline
  const loadPipelineData = async (pipelineId) => {
    if (!pipelineId) {
      setPipelineStages([]);
      setPipelineUsers([]);
      return;
    }
    try {
      setLoadingStages(true);
      const response = await apiService.getPipeline(pipelineId);
      if (response.success) {
        // API returns data inside response.data
        const pipeline = response.data?.pipeline || response.pipeline;
        setPipelineStages(pipeline?.stages || []);
        setPipelineUsers(pipeline?.users || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do pipeline:', error);
    } finally {
      setLoadingStages(false);
    }
  };

  // Reload pipelines when project changes
  useEffect(() => {
    loadPipelines(formData.projectId);
    // Clear selections when project changes
    if (formData.pipelineId) {
      updateField('pipelineId', null);
      updateField('stageId', null);
      updateField('assignees', []);
    }
  }, [formData.projectId]);

  // Load pipeline data when pipeline changes
  useEffect(() => {
    loadPipelineData(formData.pipelineId);
    // Clear stage and assignees when pipeline changes
    updateField('stageId', null);
    updateField('assignees', []);
  }, [formData.pipelineId]);

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
        if (formData.useMultipleLocations) {
          // Multiple locations mode
          if (formData.locations.length === 0) {
            setError('Adicione pelo menos uma localização');
            return false;
          }
        } else {
          // Single location mode
          if (!formData.location || !formData.location.lat || !formData.location.lng) {
            setError('Selecione uma localização no mapa');
            return false;
          }
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
        // Validate activation agents only when inserting in CRM
        if (formData.insertInCrm) {
          if (formData.activateEmail && !formData.emailAgentId) {
            setError('Selecione um agente de Email para ativação ou desmarque esta opção');
            return false;
          }
          if (formData.activateWhatsapp && !formData.whatsappAgentId) {
            setError('Selecione um agente de WhatsApp para ativação ou desmarque esta opção');
            return false;
          }
        }
        return true;

      case 6:
        // Pipeline and rotation validation (only when insertInCrm is true)
        // This step is skipped when insertInCrm is false (totalSteps = 5)
        if (!formData.insertInCrm) {
          return true; // Skip validation if not inserting in CRM
        }
        if (!formData.pipelineId) {
          setError('Selecione um pipeline para os leads');
          return false;
        }
        if (!formData.stageId) {
          setError('Selecione uma etapa inicial para os leads');
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

        // Multiple locations support
        searchLocations: formData.useMultipleLocations && formData.locations.length > 0
          ? formData.locations
          : [],
        locationDistribution: formData.locationDistribution,

        // Location (single location - required even in multiple mode for backward compatibility)
        searchLocation: formData.useMultipleLocations && formData.locations.length > 0
          ? (formData.locations[0].location || formData.locations[0].city || `Lat: ${formData.locations[0].lat}, Lng: ${formData.locations[0].lng}`)
          : (formData.location?.location || formData.location?.city || `Lat: ${formData.location?.lat}, Lng: ${formData.location?.lng}`),
        searchCountry: formData.useMultipleLocations && formData.locations.length > 0
          ? (formData.locations[0].country || '')
          : (formData.location?.country || ''),
        latitude: formData.useMultipleLocations && formData.locations.length > 0
          ? formData.locations[0].lat
          : formData.location?.lat,
        longitude: formData.useMultipleLocations && formData.locations.length > 0
          ? formData.locations[0].lng
          : formData.location?.lng,
        radius: formData.useMultipleLocations && formData.locations.length > 0
          ? (formData.locations[0].radius || 10)
          : (formData.location?.radius || 10),
        searchType: formData.useMultipleLocations && formData.locations.length > 0
          ? (formData.locations[0].searchType || 'radius')
          : (formData.location?.searchType || 'radius'),

        // Search query
        searchQuery: searchQuery,
        businessCategory: formData.businessCategory,
        businessSpecification: formData.businessSpecification,

        // Filters
        minRating: formData.minRating,
        minReviews: formData.minReviews,

        // CRM insertion mode
        insertInCrm: formData.insertInCrm,

        // Activation agents (only relevant when insertInCrm is true)
        activateEmail: formData.insertInCrm ? formData.activateEmail : false,
        emailAgentId: formData.insertInCrm && formData.activateEmail ? formData.emailAgentId : null,
        activateWhatsapp: formData.insertInCrm ? formData.activateWhatsapp : false,
        whatsappAgentId: formData.insertInCrm && formData.activateWhatsapp ? formData.whatsappAgentId : null,

        // Pipeline, stage and assignees (only when insertInCrm is true)
        pipelineId: formData.insertInCrm ? formData.pipelineId : null,
        stageId: formData.insertInCrm ? formData.stageId : null,
        assignees: formData.insertInCrm ? formData.assignees.map(u => u.id) : [],

        // Daily limit (null = unlimited)
        dailyLimit: formData.dailyLimit
      };

      await onSubmit(payload);
    } catch (error) {
      setError(error.message || 'Erro ao criar campanha');
      setLoading(false);
    }
  };

  // Step progress indicator (dynamic based on totalSteps)
  const StepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
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
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col ${currentStep === 2 ? 'max-w-6xl' : 'max-w-3xl'}`}>
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
        <div className={`flex-1 overflow-y-auto ${currentStep === 2 ? 'p-4' : 'p-6'}`}>
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
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Onde você quer prospectar?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Escolha uma localização única ou múltiplas localizações
                </p>
              </div>

              {/* Toggle between single/multiple */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => updateField('useMultipleLocations', false)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    !formData.useMultipleLocations
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Localização Única
                </button>
                <button
                  type="button"
                  onClick={() => updateField('useMultipleLocations', true)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    formData.useMultipleLocations
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Múltiplas Localizações
                </button>
              </div>

              {/* Single Location */}
              {!formData.useMultipleLocations && (
                <LocationMapPicker
                  value={formData.location}
                  onChange={(locationData) => updateField('location', locationData)}
                />
              )}

              {/* Multiple Locations */}
              {formData.useMultipleLocations && (
                <MultipleLocationsManager
                  locations={formData.locations}
                  onChange={(locations) => updateField('locations', locations)}
                  locationDistribution={formData.locationDistribution}
                  onDistributionChange={(distribution) => updateField('locationDistribution', distribution)}
                />
              )}
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

              {/* Daily Limit Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Leads por dia
                </label>
                <div className="space-y-4">
                  {/* Slider - Show when not unlimited */}
                  {formData.dailyLimit !== null && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center">
                        <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {formData.dailyLimit}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-8">20</span>
                        <input
                          type="range"
                          min="20"
                          max="1000"
                          step="20"
                          value={formData.dailyLimit || 20}
                          onChange={(e) => updateField('dailyLimit', parseInt(e.target.value))}
                          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-purple"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-10">1000</span>
                      </div>

                      {/* Quick Select Buttons */}
                      <div className="grid grid-cols-5 gap-2">
                        {[20, 50, 100, 200, 500].map((limit) => (
                          <button
                            key={limit}
                            type="button"
                            onClick={() => updateField('dailyLimit', limit)}
                            className={`px-2 py-1.5 text-xs font-medium rounded-md border transition-all ${
                              formData.dailyLimit === limit
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                            }`}
                          >
                            {limit}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credits Warning for Unlimited */}
                  {formData.dailyLimit === null && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Atenção:</strong> A campanha consumirá 1 crédito por lead. A execução será pausada automaticamente se os créditos acabarem.
                      </p>
                    </div>
                  )}

                  {/* Unlimited Checkbox - Secondary option */}
                  <div className="flex items-center gap-2 px-2 py-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <input
                      type="checkbox"
                      id="unlimited-leads"
                      checked={formData.dailyLimit === null}
                      onChange={(e) => updateField('dailyLimit', e.target.checked ? null : 20)}
                      className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800"
                    />
                    <label
                      htmlFor="unlimited-leads"
                      className="cursor-pointer text-sm text-gray-600 dark:text-gray-400"
                    >
                      Modo ilimitado
                    </label>
                  </div>
                </div>
              </div>

              {/* Info about automatic enrichment */}
              <div className="flex items-start space-x-2 px-2 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  💡 Emails, telefones e redes sociais serão buscados automaticamente nos sites das empresas encontradas.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Actions + Summary */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  O que fazer com os leads?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Escolha se deseja inserir os leads no CRM ou apenas gerar uma lista para exportação
                </p>
              </div>

              {/* CRM Insertion Mode Selection */}
              <div className="space-y-3">
                {/* Insert in CRM option */}
                <label
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.insertInCrm
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="insertMode"
                    checked={formData.insertInCrm}
                    onChange={() => updateField('insertInCrm', true)}
                    className="w-5 h-5 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                  <Database className="w-5 h-5 text-purple-600 dark:text-purple-400 ml-3" />
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Inserir no CRM</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Criar contatos e oportunidades automaticamente no seu pipeline
                    </p>
                  </div>
                  {formData.insertInCrm && (
                    <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  )}
                </label>

                {/* Just generate list option */}
                <label
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    !formData.insertInCrm
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="insertMode"
                    checked={!formData.insertInCrm}
                    onChange={() => updateField('insertInCrm', false)}
                    className="w-5 h-5 text-purple-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                  <FileDown className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-3" />
                  <div className="ml-3 flex-1">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Apenas gerar lista</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Exportar leads enriquecidos sem criar no CRM
                    </p>
                  </div>
                  {!formData.insertInCrm && (
                    <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  )}
                </label>
              </div>

              {/* Info about enrichment */}
              <div className="flex items-start space-x-2 px-2 py-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  💡 <strong>Dica:</strong> Em ambos os modos, emails, telefones e redes sociais serão buscados nos sites das empresas.
                </p>
              </div>

              {/* Activation channels - Only show when inserting in CRM */}
              {formData.insertInCrm && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Canais de Ativação (opcional)
                  </h4>

                  {/* Email Activation - Coming Soon */}
                  <div className="space-y-3 opacity-60">
                    <div className="flex items-center space-x-3 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-not-allowed bg-gray-50 dark:bg-gray-800/50">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled
                        className="w-5 h-5 text-gray-400 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded cursor-not-allowed"
                      />
                      <Send className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-500 dark:text-gray-400">Ativar por Email</span>
                          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">
                            Em breve
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500">Enviar mensagem de apresentação por email</p>
                      </div>
                    </div>
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
              )}
            </div>
          )}

          {/* Step 6: Pipeline and Rotation */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Pipeline e Rodízio de Atendentes
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Defina em qual pipeline e etapa os leads serão inseridos, e quem irá atendê-los
                </p>
              </div>

              {/* Project Selection (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  Projeto <span className="text-gray-400">(opcional)</span>
                </label>
                <select
                  value={formData.projectId || ''}
                  onChange={(e) => updateField('projectId', e.target.value || null)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Todos os projetos</option>
                  {crmProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pipeline Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Database className="w-4 h-4 inline mr-1" />
                  Pipeline <span className="text-red-500">*</span>
                </label>
                {loadingPipelines ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando pipelines...
                  </div>
                ) : pipelines.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Nenhum pipeline encontrado. Crie pipelines na página de CRM.
                    </p>
                  </div>
                ) : (
                  <select
                    value={formData.pipelineId || ''}
                    onChange={(e) => updateField('pipelineId', e.target.value || null)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Selecione um pipeline</option>
                    {pipelines.map(pipeline => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Stage Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <ChevronRight className="w-4 h-4 inline mr-1" />
                  Etapa Inicial <span className="text-red-500">*</span>
                </label>
                {loadingStages ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando etapas...
                  </div>
                ) : !formData.pipelineId ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Selecione um pipeline primeiro
                  </p>
                ) : pipelineStages.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Nenhuma etapa encontrada neste pipeline.
                    </p>
                  </div>
                ) : (
                  <select
                    value={formData.stageId || ''}
                    onChange={(e) => updateField('stageId', e.target.value || null)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Selecione uma etapa</option>
                    {pipelineStages.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
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
                {!formData.pipelineId ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    Selecione um pipeline primeiro
                  </p>
                ) : pipelineUsers.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Nenhum usuário com acesso a este pipeline. Adicione usuários ao pipeline nas configurações.
                    </p>
                  </div>
                ) : (
                  <RodizioUserSelector
                    users={pipelineUsers}
                    selectedUsers={formData.assignees}
                    onChange={(assignees) => updateField('assignees', assignees)}
                  />
                )}
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Como funciona:</strong> Os leads encontrados serão inseridos no pipeline e etapa selecionados,
                  e distribuídos automaticamente entre os atendentes na ordem definida.
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
