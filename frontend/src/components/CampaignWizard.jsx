// frontend/src/components/CampaignWizard.jsx
import React, { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Search, Target, CheckCircle, Loader, Hand, Bot, Users, MapPin, Briefcase } from 'lucide-react';
import AsyncSelect from 'react-select/async';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import TagsInput from './TagsInput';

const CampaignWizard = ({ isOpen, onClose, onCampaignCreated }) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiAgents, setAiAgents] = useState([]);
  const [linkedinAccounts, setLinkedinAccounts] = useState([]);

  const [formData, setFormData] = useState({
    // Step 1: Busca
    type: '', // 'manual' | 'automatic'
    selected_location: null, // Location selecionada pelo usuário
    search_filters: null,

    // Campos estruturados para busca automática (simplificado)
    manual_job_titles: [], // Apenas cargos

    // Step 2: Coleta
    name: '',
    description: '',
    target_profiles_count: 100,

    // Step 3: Validação
    linkedin_account_id: '',     // Legacy: single account
    linkedin_account_ids: [],    // New: multiple accounts
    ai_agent_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadAIAgents();
      loadLinkedinAccounts();
    }
  }, [isOpen]);

  const loadAIAgents = async () => {
    try {
      const response = await api.getAIAgents();
      setAiAgents(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar agentes:', err);
      setAiAgents([]);
    }
  };

  const loadLinkedinAccounts = async () => {
    try {
      const response = await api.getLinkedInAccounts();
      setLinkedinAccounts(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar contas LinkedIn:', err);
      setLinkedinAccounts([]);
    }
  };

  const handleCampaignTypeSelect = (type) => {
    if (type === 'manual') {
      // Redirecionar para página de busca
      onClose();
      navigate('/search');
    } else {
      setFormData({ ...formData, type });
      setCurrentStep(1.5); // Sub-step para AI prompt
    }
  };

  const handleGenerateFilters = async () => {
    if (!formData.selected_location) {
      setError('Selecione uma localização primeiro');
      return;
    }

    // Validar se os cargos foram preenchidos
    if (formData.manual_job_titles.length === 0) {
      setError('Preencha pelo menos um cargo que deseja buscar');
      return;
    }

    console.log('🔍 Location selecionada:', formData.selected_location);
    console.log('📍 Location VALUE:', formData.selected_location.value);
    console.log('📍 Location LABEL:', formData.selected_location.label);

    setIsLoading(true);
    setError('');

    try {
      // Construir prompt incluindo localização para a IA adaptar ao idioma/contexto correto
      const structuredPrompt = `Localização: ${formData.selected_location.label}. Cargos: ${formData.manual_job_titles.join(', ')}`;

      console.log('📝 Prompt estruturado:', structuredPrompt);

      const result = await api.generateSearchFilters(structuredPrompt);

      console.log('🤖 Filtros recebidos da IA:', result.data.filters);

      // Combinar filtros da IA com a location selecionada pelo usuário
      const filters = {
        ...result.data.filters,
        location: [formData.selected_location.value] // Usar o ID da location selecionada
      };

      console.log('✅ Filtros finais combinados:', filters);

      setFormData({
        ...formData,
        search_filters: filters,
        name: `Campanha ${result.data.filters.industries?.[0] || 'Automática'} - ${new Date().toLocaleDateString('pt-BR')}`
      });
      setCurrentStep(2);
    } catch (err) {
      console.error('Erro ao gerar filtros:', err);
      setError(err.message || 'Erro ao gerar filtros com IA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    setError('');

    if (currentStep === 2) {
      if (!formData.name || formData.name.trim().length < 3) {
        setError('Nome da campanha obrigatório (mínimo 3 caracteres)');
        return;
      }

      if (!formData.target_profiles_count || formData.target_profiles_count < 10) {
        setError('Quantidade mínima de 10 perfis');
        return;
      }
    }

    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setError('');
    if (currentStep === 1.5) {
      setCurrentStep(1);
      setFormData({
        ...formData,
        type: '',
        ai_search_prompt: '',
        selected_location: null,
        search_filters: null,
        manual_job_titles: []
      });
    } else if (currentStep === 2) {
      setCurrentStep(1.5);
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (formData.linkedin_account_ids.length === 0) {
      setError('Selecione pelo menos uma conta do LinkedIn');
      return;
    }

    if (!formData.ai_agent_id) {
      setError('Selecione um agente de IA para conduzir a campanha');
      return;
    }

    setIsLoading(true);

    try {
      // Criar campanha em status draft
      const campaign = await api.createCampaign({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        search_filters: formData.search_filters,
        ai_search_prompt: formData.ai_search_prompt,
        target_profiles_count: formData.target_profiles_count,
        linkedin_account_ids: formData.linkedin_account_ids, // Múltiplas contas
        ai_agent_id: formData.ai_agent_id,
        current_step: 3,
        status: 'draft'
      });

      console.log('✅ Campaign created successfully:', campaign);

      // Iniciar coleta automaticamente após criar a campanha
      if (formData.type === 'automatic' && formData.search_filters) {
        console.log('🚀 Iniciando coleta automática de leads...');
        try {
          await api.startBulkCollection(campaign.data.id);
          console.log('✅ Coleta iniciada com sucesso!');
        } catch (collectionError) {
          console.error('⚠️ Erro ao iniciar coleta, mas campanha foi criada:', collectionError);
          // Não bloqueia o fluxo, apenas avisa
        }
      }

      onCampaignCreated(campaign);
      handleClose();
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      setError(err.message || 'Erro ao criar campanha');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      type: '',
      ai_search_prompt: '',
      selected_location: null,
      search_filters: null,
      manual_job_titles: [],
      manual_industries: [],
      manual_companies: [],
      manual_keywords: [],
      name: '',
      description: '',
      target_profiles_count: 100,
      linkedin_account_id: '',
      linkedin_account_ids: [],
      ai_agent_id: ''
    });
    setError('');
    onClose();
  };

  // Função para buscar localizações via Unipile
  const fetchLocationSuggestions = async (inputValue) => {
    if (!inputValue || inputValue.length < 2) return [];
    if (!formData.type || !linkedinAccounts.length) return [];

    try {
      const linkedinAccountId = linkedinAccounts[0]?.id;
      if (!linkedinAccountId) return [];

      const response = await api.searchLocations(inputValue, linkedinAccountId);
      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar localizações:', error);
      return [];
    }
  };

  if (!isOpen) return null;

  const stepLabels = {
    1: 'Busca',
    1.5: 'Busca',
    2: 'Coleta',
    3: 'Validação'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Nova Campanha</h2>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 p-4 bg-gray-50 border-b">
          {[1, 2, 3].map((step) => {
            const isCurrent = Math.floor(currentStep) === step;
            const isPast = currentStep > step;

            return (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-sm font-medium ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isPast
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {isPast ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                <div className="ml-2 text-xs font-medium text-gray-700">
                  {step === 1 ? 'Busca' : step === 2 ? 'Coleta' : 'Validação'}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Escolher tipo de campanha */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Como deseja criar sua campanha?</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Escolha entre criar filtros manualmente ou deixar a IA gerar para você
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Manual */}
                <button
                  onClick={() => handleCampaignTypeSelect('manual')}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                      <Hand className="w-8 h-8 text-gray-600 group-hover:text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">Manual</h4>
                    <p className="text-sm text-gray-600">
                      Defina seus próprios filtros de busca no LinkedIn
                    </p>
                  </div>
                </button>

                {/* Automática */}
                <button
                  onClick={() => handleCampaignTypeSelect('automatic')}
                  className="p-6 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                      <Sparkles className="w-8 h-8 text-purple-600" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2 justify-center">
                      Automática (IA)
                    </h4>
                    <p className="text-sm text-gray-600">
                      Escolha cidade e cargos, a IA cria os filtros otimizados
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 1.5: Descrição para IA */}
          {currentStep === 1.5 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Configure sua busca automática
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Simples e direto: escolha a <strong>cidade</strong> e os <strong>cargos</strong>. A IA faz o resto! 🚀
                </p>
              </div>

              {/* Location Autocomplete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Localização *
                </label>
                <AsyncSelect
                  cacheOptions
                  loadOptions={fetchLocationSuggestions}
                  onChange={(selected) => setFormData({ ...formData, selected_location: selected })}
                  value={formData.selected_location}
                  placeholder="Digite uma cidade ou região..."
                  noOptionsMessage={() => "Digite para buscar localizações"}
                  loadingMessage={() => "Buscando..."}
                  className="text-sm"
                  styles={{
                    control: (base) => ({
                      ...base,
                      borderColor: '#d1d5db',
                      '&:hover': { borderColor: '#9ca3af' },
                      boxShadow: 'none',
                      '&:focus-within': {
                        borderColor: '#a855f7',
                        boxShadow: '0 0 0 2px rgba(168, 85, 247, 0.1)'
                      }
                    })
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ex: São Paulo, SP ou Rio de Janeiro, RJ
                </p>
              </div>

              {/* Cargos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Cargos *
                </label>
                <TagsInput
                  tags={formData.manual_job_titles}
                  onChange={(tags) => setFormData({ ...formData, manual_job_titles: tags })}
                  placeholder="Ex: CEO, Diretor, Gerente, Fundador..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite os cargos que deseja buscar e pressione vírgula ou Enter para adicionar
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800">
                  <strong>✨ Como funciona:</strong> Você define a cidade e os cargos, e nossa IA expande e otimiza os filtros automaticamente para encontrar os melhores perfis.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Coleta */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Configurar coleta de perfis</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Revise os filtros gerados e defina quantos perfis deseja coletar
                </p>
              </div>

              {/* Filtros gerados */}
              {formData.search_filters && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-purple-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Filtros gerados pela IA
                  </h4>
                  <div className="space-y-2 text-sm">
                    {formData.search_filters.keywords && (
                      <div>
                        <span className="font-medium text-gray-700">Palavras-chave:</span>{' '}
                        <span className="text-gray-900">{formData.search_filters.keywords}</span>
                      </div>
                    )}
                    {formData.selected_location && (
                      <div>
                        <span className="font-medium text-gray-700">Localização:</span>{' '}
                        <span className="text-gray-900">{formData.selected_location.label}</span>
                      </div>
                    )}
                    {formData.search_filters.industries && formData.search_filters.industries.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Indústrias:</span>{' '}
                        <span className="text-gray-900">{formData.search_filters.industries.join(', ')}</span>
                      </div>
                    )}
                    {formData.search_filters.job_titles && formData.search_filters.job_titles.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-700">Cargos:</span>{' '}
                        <span className="text-gray-900">{formData.search_filters.job_titles.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Campanha *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Prospecção SaaS B2B - São Paulo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição (opcional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o objetivo desta campanha..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade de perfis a coletar *
                </label>
                <input
                  type="number"
                  value={formData.target_profiles_count}
                  onChange={(e) => setFormData({ ...formData, target_profiles_count: parseInt(e.target.value) || 0 })}
                  min="10"
                  max="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo: 10 perfis | Máximo: 1000 perfis
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Validação */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Configuração final</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Selecione a conta do LinkedIn e o agente de IA para esta campanha
                </p>
              </div>

              {/* LinkedIn Account Selector (Múltiplo) */}
              {linkedinAccounts.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Você ainda não conectou nenhuma conta do LinkedIn. Conecte uma conta primeiro para criar campanhas.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Contas do LinkedIn * (selecione uma ou mais)
                  </label>

                  <div className="space-y-2">
                    {linkedinAccounts.map((account) => {
                      const isSelected = formData.linkedin_account_ids.includes(account.id);

                      return (
                        <div
                          key={account.id}
                          onClick={() => {
                            const newIds = isSelected
                              ? formData.linkedin_account_ids.filter(id => id !== account.id)
                              : [...formData.linkedin_account_ids, account.id];
                            setFormData({ ...formData, linkedin_account_ids: newIds });
                          }}
                          className={`
                            cursor-pointer p-4 rounded-lg border-2 transition-all
                            ${isSelected
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by div onClick
                                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                              />
                              <div>
                                <p className="font-medium text-gray-900">
                                  {account.profile_name || account.linkedin_username}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Limite: {account.daily_limit || 0} convites/dia
                                </p>
                              </div>
                            </div>
                            {account.status === 'active' && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Resumo de limites */}
                  {formData.linkedin_account_ids.length > 0 && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {formData.linkedin_account_ids.length} conta(s) selecionada(s)
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Os envios serão distribuídos automaticamente
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-purple-600">
                            {linkedinAccounts
                              .filter(acc => formData.linkedin_account_ids.includes(acc.id))
                              .reduce((sum, acc) => sum + (acc.daily_limit || 0), 0)
                            }
                          </p>
                          <p className="text-xs text-gray-600">convites/dia total</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Agent Selector */}
              {aiAgents.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Você ainda não criou nenhum agente de IA. Crie um agente primeiro para poder ativar campanhas.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Agente de IA *
                  </label>
                  <select
                    value={formData.ai_agent_id}
                    onChange={(e) => setFormData({ ...formData, ai_agent_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Selecione um agente...</option>
                    {aiAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name} ({agent.behavioral_profile})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.linkedin_account_id && formData.ai_agent_id && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">Resumo da campanha</h4>
                  <div className="space-y-1 text-sm text-green-800">
                    <p><strong>Nome:</strong> {formData.name}</p>
                    <p><strong>Tipo:</strong> {formData.type === 'automatic' ? 'Automática (IA)' : 'Manual'}</p>
                    <p><strong>Perfis a coletar:</strong> {formData.target_profiles_count}</p>
                    <p><strong>Conta LinkedIn:</strong> {linkedinAccounts.find(a => a.id === formData.linkedin_account_id)?.profile_name || linkedinAccounts.find(a => a.id === formData.linkedin_account_id)?.linkedin_username}</p>
                    <p><strong>Agente selecionado:</strong> {aiAgents.find(a => a.id === formData.ai_agent_id)?.name}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t bg-gray-50">
          <div>
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>

            {currentStep === 1.5 ? (
              <button
                onClick={handleGenerateFilters}
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Gerando filtros...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Filtros com IA
                  </>
                )}
              </button>
            ) : currentStep < 3 ? (
              <button
                onClick={handleNext}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                Avançar
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading || formData.linkedin_account_ids.length === 0 || !formData.ai_agent_id}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
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

export default CampaignWizard;
