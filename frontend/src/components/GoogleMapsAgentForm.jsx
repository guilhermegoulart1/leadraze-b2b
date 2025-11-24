// frontend/src/components/GoogleMapsAgentForm.jsx
import React, { useState } from 'react';
import {
  X, Bot, MapPin, Search, Star, Phone, Mail, Loader2,
  Database, Send, MessageCircle, DollarSign, ChevronLeft,
  ChevronRight, RefreshCw, Check
} from 'lucide-react';
import LocationMapPicker from './LocationMapPicker';
import { BUSINESS_CATEGORIES, detectUserLanguage, getTranslatedCategories } from '../data/businessCategories';

const GoogleMapsAgentForm = ({ onClose, onSubmit }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  // Avatar state
  const [avatarSeed, setAvatarSeed] = useState(Math.floor(Math.random() * 70) + 1);
  const [avatarUrl, setAvatarUrl] = useState(`https://i.pravatar.cc/200?img=${Math.floor(Math.random() * 70) + 1}`);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Avatar + Name
    name: '',
    avatarUrl: avatarUrl,

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
    actionType: 'crm_only'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detect user language for categories
  const userLang = detectUserLanguage();
  const translatedCategories = getTranslatedCategories(userLang);

  // Update field
  const updateField = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  // Refresh avatar
  const refreshAvatar = () => {
    const newSeed = Math.floor(Math.random() * 70) + 1;
    setAvatarSeed(newSeed);
    setAvatarLoading(true);
    setAvatarError(false);
    const newUrl = `https://i.pravatar.cc/200?img=${newSeed}`;
    setAvatarUrl(newUrl);
    updateField('avatarUrl', newUrl);
  };

  // Handle avatar load
  const handleAvatarLoad = () => {
    setAvatarLoading(false);
    setAvatarError(false);
  };

  // Handle avatar error
  const handleAvatarError = (e) => {
    console.error('Avatar loading error:', e);
    console.log('Failed URL:', avatarUrl);
    setAvatarLoading(false);
    setAvatarError(true);
  };

  // Validation for each step
  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.name.trim()) {
          setError('Nome do agente é obrigatório');
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
      case 5:
        return true; // No validation needed

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
        avatar_url: formData.avatarUrl,

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

        // Action
        actionType: formData.actionType,

        // Fixed params
        dailyLimit: 20
      };

      await onSubmit(payload);
    } catch (error) {
      setError(error.message || 'Erro ao criar agente');
      setLoading(false);
    }
  };

  // Step progress indicator
  const StepIndicator = () => (
    <div className="flex items-center justify-center space-x-2 mb-6">
      {[1, 2, 3, 4, 5].map(step => (
        <div
          key={step}
          className={`h-2 w-12 rounded-full transition-all ${
            step === currentStep
              ? 'bg-purple-600'
              : step < currentStep
              ? 'bg-purple-300'
              : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bot className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Criar Agente Google Maps
              </h2>
              <p className="text-sm text-gray-500">
                Passo {currentStep} de {totalSteps}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Step 1: Avatar + Name */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Escolha um avatar e dê um nome ao seu agente
                </h3>
                <p className="text-sm text-gray-500">
                  O avatar é apenas visual, você pode mudá-lo a qualquer momento
                </p>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center space-y-3">
                <div className="relative">
                  {avatarError ? (
                    <div className="w-32 h-32 rounded-full border-4 border-purple-200 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                      <Bot className="w-16 h-16 text-purple-600" />
                    </div>
                  ) : (
                    <>
                      <img
                        src={avatarUrl}
                        alt="Agent Avatar"
                        onLoad={handleAvatarLoad}
                        onError={handleAvatarError}
                        className={`w-32 h-32 rounded-full object-cover border-4 border-purple-200 transition-opacity ${
                          avatarLoading ? 'opacity-0' : 'opacity-100'
                        }`}
                      />
                      {avatarLoading && (
                        <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-purple-200 bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                        </div>
                      )}
                    </>
                  )}
                  <button
                    onClick={refreshAvatar}
                    className="absolute bottom-0 right-0 p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-colors"
                    title="Trocar foto"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Clique no ícone para gerar uma nova foto
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Agente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Ex: Academias em São Paulo"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Onde você quer buscar leads?
                </h3>
                <p className="text-sm text-gray-500">
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Qual nicho você quer prospectar?
                </h3>
                <p className="text-sm text-gray-500">
                  Preencha pelo menos uma das opções abaixo
                </p>
              </div>

              {/* Category (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria principal
                </label>
                <select
                  value={formData.businessCategory}
                  onChange={(e) => updateField('businessCategory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Especificação
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.businessSpecification}
                    onChange={(e) => updateField('businessSpecification', e.target.value)}
                    placeholder="Ex: Nutricionista, Pizzaria, Academia CrossFit..."
                    className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  💡 Exemplos: "Dentist" + "Dentist", "Health" + "Nutritionist", ou apenas "Pizzeria"
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Filters */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Filtros de qualificação
                </h3>
                <p className="text-sm text-gray-500">
                  Defina critérios para filtrar os melhores leads
                </p>
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Avaliação mínima
                </label>
                <select
                  value={formData.minRating || ''}
                  onChange={(e) => updateField('minRating', e.target.value ? parseFloat(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mínimo de avaliações
                </label>
                <select
                  value={formData.minReviews || ''}
                  onChange={(e) => updateField('minReviews', e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Informações de contato obrigatórias
                </label>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.requirePhone}
                      onChange={(e) => updateField('requirePhone', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <Phone className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-700">Exigir telefone</span>
                  </label>

                  <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.requireEmail}
                      onChange={(e) => updateField('requireEmail', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <Mail className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-700">Exigir email</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Actions + Summary */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  O que fazer com cada lead?
                </h3>
                <p className="text-sm text-gray-500">
                  Escolha a ação que será executada para cada lead encontrado
                </p>
              </div>

              {/* Action types */}
              <div className="space-y-3">
                <label className="flex items-start space-x-3 p-4 border-2 border-purple-600 bg-purple-50 rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    name="actionType"
                    value="crm_only"
                    checked={formData.actionType === 'crm_only'}
                    onChange={(e) => updateField('actionType', e.target.value)}
                    className="mt-1 w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Database className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-gray-900">
                        Apenas inserir no CRM
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Os leads serão apenas adicionados ao seu CRM
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed">
                  <input
                    type="radio"
                    disabled
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Send className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-700">
                        Inserir no CRM + enviar email
                      </span>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Em breve
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Inserir no CRM e enviar email de apresentação
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed">
                  <input
                    type="radio"
                    disabled
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <MessageCircle className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-700">
                        CRM + Email + WhatsApp
                      </span>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Em breve
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Inserir no CRM, enviar email E mensagem no WhatsApp
                    </p>
                  </div>
                </label>
              </div>

              {/* Summary */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-900 mb-3">
                  Resumo do Agente
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-purple-600 mt-0.5" />
                    <span className="text-gray-700">
                      <strong>Nome:</strong> {formData.name}
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-purple-600 mt-0.5" />
                    <span className="text-gray-700">
                      <strong>Localização:</strong> {formData.location?.location || 'Não definida'} ({formData.location?.radius || 10}km)
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-purple-600 mt-0.5" />
                    <span className="text-gray-700">
                      <strong>Nicho:</strong> {formData.businessSpecification || formData.businessCategory || 'Não definido'}
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <Check className="w-4 h-4 text-purple-600 mt-0.5" />
                    <span className="text-gray-700">
                      <strong>Frequência:</strong> 20 leads por dia
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1 || loading}
            className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="flex items-center space-x-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors"
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
