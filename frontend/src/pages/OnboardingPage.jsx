import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Building2, Users, MessageSquare, CheckCircle,
  ChevronLeft, ChevronRight, Loader2, PartyPopper,
  Lightbulb, Info, Plus, Trash2
} from 'lucide-react';
import api from '../services/api';
import OnboardingProgress from '../components/OnboardingProgress';

const OnboardingPage = () => {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [onboardingId, setOnboardingId] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [checklistData, setChecklistData] = useState(null);
  const [fieldErrors, setFieldErrors] = useState([]);

  // Estados para adicionar FAQ e Objeções
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
  const [newObjection, setNewObjection] = useState({ objection: '', response: '' });

  const [formData, setFormData] = useState({
    // Step 1: Company
    company_name: '',
    website: '',
    industry: '',
    company_size: '',
    description: '',
    products_services: '',
    differentials: '',
    success_cases: '',
    // Step 2: Customers
    ideal_customer: '',
    target_roles: '',
    target_location: '',
    target_industries: '',
    buying_signals: '',
    main_problem: '',
    // Step 3: Support
    faq: [],
    objections: [],
    policies: '',
    business_hours: '',
    escalation_triggers: [],
    // Step 4: Final
    goals: [],
    lead_target: '',
    meeting_target: '',
    materials_links: '',
    calendar_link: '',
    blacklist: '',
    additional_notes: '',
    contact_name: '',
    contact_role: '',
    contact_email: '',
    contact_phone: '',
  });

  const steps = [
    { id: 1, title: t('steps.company'), icon: Building2 },
    { id: 2, title: t('steps.customers'), icon: Users },
    { id: 3, title: t('steps.support'), icon: MessageSquare },
    { id: 4, title: t('steps.finish'), icon: CheckCircle },
  ];

  const industries = [
    { value: 'agronegocio', label: t('industries.agribusiness') },
    { value: 'alimentacao', label: t('industries.foodservice') },
    { value: 'automotivo', label: t('industries.automotive') },
    { value: 'beleza', label: t('industries.beauty') },
    { value: 'construcao', label: t('industries.construction') },
    { value: 'consultoria', label: t('industries.consulting') },
    { value: 'contabilidade', label: t('industries.accounting') },
    { value: 'educacao', label: t('industries.education') },
    { value: 'energia', label: t('industries.energy') },
    { value: 'eventos', label: t('industries.events') },
    { value: 'imobiliario', label: t('industries.realestate') },
    { value: 'industria', label: t('industries.manufacturing') },
    { value: 'juridico', label: t('industries.legal') },
    { value: 'logistica', label: t('industries.logistics') },
    { value: 'marketing', label: t('industries.marketing') },
    { value: 'rh', label: t('industries.hr') },
    { value: 'saude', label: t('industries.health') },
    { value: 'financeiro', label: t('industries.financial') },
    { value: 'seguros', label: t('industries.insurance') },
    { value: 'tecnologia', label: t('industries.technology') },
    { value: 'telecom', label: t('industries.telecom') },
    { value: 'turismo', label: t('industries.tourism') },
    { value: 'varejo', label: t('industries.retail') },
    { value: 'outro', label: t('industries.other') },
  ];

  const goalOptions = [
    { value: 'mais_clientes', label: t('goals.moreClients') },
    { value: 'tempo', label: t('goals.moreTime') },
    { value: 'atendimento', label: t('goals.betterSupport') },
    { value: 'escalar', label: t('goals.scaleSales') },
    { value: 'custo', label: t('goals.reduceCosts') },
    { value: 'organizar', label: t('goals.organizeProspecting') },
  ];

  const escalationOptions = [
    // Início da conversa
    { value: 'primeiro_contato', label: t('escalation.firstContact') },
    { value: 'respondeu', label: t('escalation.replied') },
    { value: 'interesse_minimo', label: t('escalation.minimalInterest') },
    // Meio do funil
    { value: 'perguntou_preco', label: t('escalation.askedPrice') },
    { value: 'qualificado', label: t('escalation.qualified') },
    { value: 'reuniao', label: t('escalation.wantsMeeting') },
    // Fim do funil
    { value: 'interesse', label: t('escalation.wantsToBuy') },
    { value: 'negociacao', label: t('escalation.wantsNegotiation') },
    // Outros
    { value: 'reclamacao', label: t('escalation.hasComplaint') },
    { value: 'humano', label: t('escalation.wantsHuman') },
    { value: 'complexo', label: t('escalation.complexQuestion') },
  ];

  useEffect(() => {
    loadOnboarding();
  }, []);

  const loadOnboarding = async () => {
    try {
      const response = await api.getOnboarding();
      if (response.success && response.data.onboarding) {
        const onboarding = response.data.onboarding;
        setOnboardingId(onboarding.id);
        setCurrentStep(onboarding.current_step || 1);

        if (onboarding.status === 'completed' || onboarding.status === 'reviewed') {
          setIsCompleted(true);
          // Load checklist progress
          try {
            const checklistRes = await api.getChecklistProgress();
            if (checklistRes.success) {
              setChecklistData(checklistRes.data);
            }
          } catch (err) {
            console.error('Error loading checklist:', err);
          }
        }

        setFormData({
          company_name: onboarding.company_name || '',
          website: onboarding.website || '',
          industry: onboarding.industry || '',
          company_size: onboarding.company_size || '',
          description: onboarding.description || '',
          products_services: onboarding.products_services || '',
          differentials: onboarding.differentials || '',
          success_cases: onboarding.success_cases || '',
          ideal_customer: onboarding.ideal_customer || '',
          target_roles: onboarding.target_roles || '',
          target_location: onboarding.target_location || '',
          target_industries: onboarding.target_industries || '',
          buying_signals: onboarding.buying_signals || '',
          main_problem: onboarding.main_problem || '',
          faq: onboarding.faq || [],
          objections: onboarding.objections || [],
          policies: onboarding.policies || '',
          business_hours: onboarding.business_hours || '',
          escalation_triggers: onboarding.escalation_triggers || [],
          goals: onboarding.goals || [],
          lead_target: onboarding.lead_target || '',
          meeting_target: onboarding.meeting_target || '',
          materials_links: onboarding.materials_links || '',
          calendar_link: onboarding.calendar_link || '',
          blacklist: onboarding.blacklist || '',
          additional_notes: onboarding.additional_notes || '',
          contact_name: onboarding.contact_name || '',
          contact_role: onboarding.contact_role || '',
          contact_email: onboarding.contact_email || '',
          contact_phone: onboarding.contact_phone || '',
        });
      }
    } catch (error) {
      console.error('Error loading onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (field, value) => {
    setFormData(prev => {
      const currentValues = prev[field] || [];
      if (currentValues.includes(value)) {
        return { ...prev, [field]: currentValues.filter(v => v !== value) };
      } else {
        return { ...prev, [field]: [...currentValues, value] };
      }
    });
  };

  // Funções para FAQ
  const handleAddFaq = () => {
    if (newFaq.question.trim() && newFaq.answer.trim()) {
      setFormData(prev => ({
        ...prev,
        faq: [...(prev.faq || []), { question: newFaq.question.trim(), answer: newFaq.answer.trim() }]
      }));
      setNewFaq({ question: '', answer: '' });
      setFieldErrors(prev => prev.filter(e => e !== 'faq'));
    }
  };

  const handleRemoveFaq = (index) => {
    setFormData(prev => ({
      ...prev,
      faq: prev.faq.filter((_, i) => i !== index)
    }));
  };

  // Funções para Objeções
  const handleAddObjection = () => {
    if (newObjection.objection.trim() && newObjection.response.trim()) {
      setFormData(prev => ({
        ...prev,
        objections: [...(prev.objections || []), { objection: newObjection.objection.trim(), response: newObjection.response.trim() }]
      }));
      setNewObjection({ objection: '', response: '' });
      setFieldErrors(prev => prev.filter(e => e !== 'objections'));
    }
  };

  const handleRemoveObjection = (index) => {
    setFormData(prev => ({
      ...prev,
      objections: prev.objections.filter((_, i) => i !== index)
    }));
  };

  const saveProgress = async (nextStep, status = 'pending') => {
    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        current_step: nextStep,
        status: status,
      };

      let response;
      if (onboardingId) {
        response = await api.updateOnboarding(onboardingId, dataToSave);
      } else {
        response = await api.createOnboarding(dataToSave);
        if (response.success && response.data.onboarding) {
          setOnboardingId(response.data.onboarding.id);
        }
      }

      if (response.success) {
        return true;
      } else {
        alert(t('errors.saveFailed'));
        return false;
      }
    } catch (error) {
      console.error('Error saving onboarding:', error);
      alert(t('errors.saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (step) => {
    const errors = [];

    if (step === 1) {
      if (!formData.company_name?.trim()) errors.push('company_name');
      if (!formData.industry) errors.push('industry');
      if (!formData.description?.trim()) errors.push('description');
      if (!formData.products_services?.trim()) errors.push('products_services');
      if (!formData.differentials?.trim()) errors.push('differentials');
    }

    if (step === 2) {
      if (!formData.ideal_customer?.trim()) errors.push('ideal_customer');
      if (!formData.target_roles?.trim()) errors.push('target_roles');
      if (!formData.target_industries?.trim()) errors.push('target_industries');
      if (!formData.main_problem?.trim()) errors.push('main_problem');
    }

    if (step === 3) {
      if (!formData.faq?.length) errors.push('faq');
      if (!formData.objections?.length) errors.push('objections');
      if (!formData.escalation_triggers?.length) errors.push('escalation_triggers');
    }

    if (step === 4) {
      if (!formData.goals?.length) errors.push('goals');
      if (!formData.contact_name?.trim()) errors.push('contact_name');
      if (!formData.contact_email?.trim()) errors.push('contact_email');
      if (!formData.contact_phone?.trim()) errors.push('contact_phone');
    }

    return errors;
  };

  const hasError = (field) => fieldErrors.includes(field);

  const getInputClass = (field, baseClass = '') => {
    const errorClass = hasError(field) ? 'border-red-500 ring-2 ring-red-200 dark:ring-red-900' : 'border-gray-300 dark:border-gray-600';
    return `${baseClass} ${errorClass}`.trim();
  };

  const handleNext = async () => {
    if (currentStep < 4) {
      const errors = validateStep(currentStep);
      if (errors.length > 0) {
        setFieldErrors(errors);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      setFieldErrors([]);
      const saved = await saveProgress(currentStep + 1);
      if (saved) {
        setCurrentStep(currentStep + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setFieldErrors([]);
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    const errors = validateStep(4);
    if (errors.length > 0) {
      setFieldErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setFieldErrors([]);
    const saved = await saveProgress(4, 'completed');
    if (saved) {
      setIsCompleted(true);
      // Dispara evento para notificar o Layout que o onboarding foi completado
      window.dispatchEvent(new CustomEvent('onboarding-completed'));
    }
  };

  const goToStep = async (step) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isCompleted) {
    // If checklist is still pending, show progress view
    if (checklistData && !checklistData.checklistComplete) {
      return (
        <div className="max-w-2xl mx-auto py-8 px-4">
          <OnboardingProgress data={checklistData} inline={true} />
        </div>
      );
    }

    // Checklist 100% complete or no data yet - show success page
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <PartyPopper className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('success.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {t('success.description')}
          </p>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-left">
            <h3 className="font-semibold text-green-800 dark:text-green-400 mb-4">
              {t('success.nextSteps')}
            </h3>
            <ol className="space-y-3 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">1</span>
                {t('success.step1')}
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">2</span>
                {t('success.step2')}
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">3</span>
                {t('success.step3')}
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">4</span>
                {t('success.step4')}
              </li>
            </ol>
          </div>
          <button
            onClick={() => navigate('/')}
            className="mt-8 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('success.goToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Welcome Box */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-6 mb-8">
        <h1 className="text-xl font-bold text-purple-900 dark:text-purple-100 mb-2">
          {t('welcome.title')}
        </h1>
        <p className="text-purple-700 dark:text-purple-300">
          {t('welcome.description')}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700" />
          <div
            className="absolute top-5 left-0 h-0.5 bg-purple-600 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <div key={step.id} className="relative flex flex-col items-center">
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={step.id > currentStep}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-200
                    ${isCompleted ? 'bg-green-500 text-white' : ''}
                    ${isActive ? 'bg-purple-600 text-white ring-4 ring-purple-200 dark:ring-purple-900' : ''}
                    ${!isActive && !isCompleted ? 'bg-gray-200 dark:bg-gray-700 text-gray-500' : ''}
                    ${step.id <= currentStep ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  `}
                >
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </button>
                <span className={`
                  mt-2 text-xs font-medium text-center
                  ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'}
                `}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 md:p-8">
        {/* Step 1: Company */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-purple-600" />
                {t('step1.title')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{t('step1.description')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('fields.companyName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleInputChange}
                  placeholder={t('placeholders.companyName')}
                  className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('company_name')}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('fields.website')}
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  placeholder="https://suaempresa.com.br"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.industry')} <span className="text-red-500">*</span>
              </label>
              <select
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('industry')}`}
              >
                <option value="">{t('placeholders.select')}</option>
                {industries.map(ind => (
                  <option key={ind.value} value={ind.value}>{ind.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.description')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.description')}</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                placeholder={t('placeholders.description')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('description')}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.productsServices')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.productsServices')}</span>
              </label>
              <textarea
                name="products_services"
                value={formData.products_services}
                onChange={handleInputChange}
                rows={4}
                placeholder={t('placeholders.productsServices')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('products_services')}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.differentials')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.differentials')}</span>
              </label>
              <textarea
                name="differentials"
                value={formData.differentials}
                onChange={handleInputChange}
                rows={4}
                placeholder={t('placeholders.differentials')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('differentials')}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.successCases')}
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.successCases')}</span>
              </label>
              <textarea
                name="success_cases"
                value={formData.success_cases}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.successCases')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {/* Step 2: Customers */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" />
                {t('step2.title')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{t('step2.description')}</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex gap-3">
              <Lightbulb className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-700 dark:text-purple-300">{t('step2.tip')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.idealCustomer')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.idealCustomer')}</span>
              </label>
              <textarea
                name="ideal_customer"
                value={formData.ideal_customer}
                onChange={handleInputChange}
                rows={4}
                placeholder={t('placeholders.idealCustomer')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('ideal_customer')}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.targetRoles')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.targetRoles')}</span>
              </label>
              <input
                type="text"
                name="target_roles"
                value={formData.target_roles}
                onChange={handleInputChange}
                placeholder={t('placeholders.targetRoles')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('target_roles')}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.targetLocation')}
              </label>
              <input
                type="text"
                name="target_location"
                value={formData.target_location}
                onChange={handleInputChange}
                placeholder={t('placeholders.targetLocation')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.targetIndustries')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.targetIndustries')}</span>
              </label>
              <textarea
                name="target_industries"
                value={formData.target_industries}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.targetIndustries')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('target_industries')}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.buyingSignals')}
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.buyingSignals')}</span>
              </label>
              <textarea
                name="buying_signals"
                value={formData.buying_signals}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.buyingSignals')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.mainProblem')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.mainProblem')}</span>
              </label>
              <textarea
                name="main_problem"
                value={formData.main_problem}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.mainProblem')}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('main_problem')}`}
              />
            </div>
          </div>
        )}

        {/* Step 3: Support */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-purple-600" />
                {t('step3.title')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{t('step3.description')}</p>
            </div>

            {/* FAQ - Perguntas Frequentes */}
            <div className={`rounded-lg border p-4 ${hasError('faq') ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fields.faq')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs">{t('hints.faq')}</span>
              </label>

              {/* Formulário inline para adicionar */}
              <div className="flex gap-2 items-end mb-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newFaq.question}
                    onChange={(e) => setNewFaq(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Pergunta do cliente"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={newFaq.answer}
                    onChange={(e) => setNewFaq(prev => ({ ...prev, answer: e.target.value }))}
                    placeholder="Sua resposta"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddFaq}
                  disabled={!newFaq.question.trim() || !newFaq.answer.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Lista de FAQs adicionados */}
              {formData.faq?.length > 0 && (
                <div className="space-y-2">
                  {formData.faq.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg group">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">P:</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 ml-1">{item.question}</span>
                        <span className="text-sm text-green-600 dark:text-green-400 font-medium ml-3">R:</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 ml-1">{item.answer}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFaq(index)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Objeções */}
            <div className={`rounded-lg border p-4 ${hasError('objections') ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fields.objections')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs">{t('hints.objections')}</span>
              </label>

              {/* Formulário inline para adicionar */}
              <div className="flex gap-2 items-end mb-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newObjection.objection}
                    onChange={(e) => setNewObjection(prev => ({ ...prev, objection: e.target.value }))}
                    placeholder="Objeção do cliente"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={newObjection.response}
                    onChange={(e) => setNewObjection(prev => ({ ...prev, response: e.target.value }))}
                    placeholder="Como você responde"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddObjection}
                  disabled={!newObjection.objection.trim() || !newObjection.response.trim()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Lista de Objeções adicionadas */}
              {formData.objections?.length > 0 && (
                <div className="space-y-2">
                  {formData.objections.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg group">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">O:</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 ml-1">{item.objection}</span>
                        <span className="text-sm text-blue-600 dark:text-blue-400 font-medium ml-3">R:</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 ml-1">{item.response}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveObjection(index)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.policies')}
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.policies')}</span>
              </label>
              <textarea
                name="policies"
                value={formData.policies}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.policies')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.businessHours')}
              </label>
              <input
                type="text"
                name="business_hours"
                value={formData.business_hours}
                onChange={handleInputChange}
                placeholder={t('placeholders.businessHours')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fields.escalationTriggers')} <span className="text-red-500">*</span>
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.escalationTriggers')}</span>
              </label>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg ${hasError('escalation_triggers') ? 'ring-2 ring-red-200 dark:ring-red-900 bg-red-50 dark:bg-red-900/10' : ''}`}>
                {escalationOptions.map(option => (
                  <label
                    key={option.value}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                      ${formData.escalation_triggers?.includes(option.value)
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={formData.escalation_triggers?.includes(option.value)}
                      onChange={() => handleCheckboxChange('escalation_triggers', option.value)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Final */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-purple-600" />
                {t('step4.title')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{t('step4.description')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('fields.goals')} <span className="text-red-500">*</span>
              </label>
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg ${hasError('goals') ? 'ring-2 ring-red-200 dark:ring-red-900 bg-red-50 dark:bg-red-900/10' : ''}`}>
                {goalOptions.map(option => (
                  <label
                    key={option.value}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                      ${formData.goals?.includes(option.value)
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={formData.goals?.includes(option.value)}
                      onChange={() => handleCheckboxChange('goals', option.value)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('fields.leadTarget')}
                </label>
                <input
                  type="text"
                  name="lead_target"
                  value={formData.lead_target}
                  onChange={handleInputChange}
                  placeholder={t('placeholders.leadTarget')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('fields.meetingTarget')}
                </label>
                <input
                  type="text"
                  name="meeting_target"
                  value={formData.meeting_target}
                  onChange={handleInputChange}
                  placeholder={t('placeholders.meetingTarget')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.materialsLinks')}
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.materialsLinks')}</span>
              </label>
              <textarea
                name="materials_links"
                value={formData.materials_links}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.materialsLinks')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.calendarLink')}
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.calendarLink')}</span>
              </label>
              <input
                type="url"
                name="calendar_link"
                value={formData.calendar_link}
                onChange={handleInputChange}
                placeholder="https://calendly.com/sua-empresa"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.blacklist')}
                <span className="font-normal text-gray-500 block text-xs mt-1">{t('hints.blacklist')}</span>
              </label>
              <textarea
                name="blacklist"
                value={formData.blacklist}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.blacklist')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('fields.additionalNotes')}
              </label>
              <textarea
                name="additional_notes"
                value={formData.additional_notes}
                onChange={handleInputChange}
                rows={3}
                placeholder={t('placeholders.additionalNotes')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Contact Info */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('step4.contactInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('fields.contactName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="contact_name"
                    value={formData.contact_name}
                    onChange={handleInputChange}
                    placeholder={t('placeholders.contactName')}
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('contact_name')}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('fields.contactRole')}
                  </label>
                  <input
                    type="text"
                    name="contact_role"
                    value={formData.contact_role}
                    onChange={handleInputChange}
                    placeholder={t('placeholders.contactRole')}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('fields.contactEmail')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleInputChange}
                    placeholder="seu@email.com"
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('contact_email')}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('fields.contactPhone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleInputChange}
                    placeholder="(11) 99999-9999"
                    className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent ${getInputClass('contact_phone')}`}
                  />
                </div>
              </div>
            </div>

            {/* Next Steps Info */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-400 mb-2">{t('step4.nextStepsTitle')}</p>
                  <ol className="text-sm text-green-700 dark:text-green-300 space-y-1 list-decimal list-inside">
                    <li>{t('step4.nextStep1')}</li>
                    <li>{t('step4.nextStep2')}</li>
                    <li>{t('step4.nextStep3')}</li>
                    <li>{t('step4.nextStep4')}</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handlePrev}
            disabled={currentStep === 1 || saving}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors
              ${currentStep === 1
                ? 'opacity-0 pointer-events-none'
                : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            <ChevronLeft className="w-5 h-5" />
            {t('buttons.back')}
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('buttons.saving')}
                </>
              ) : (
                <>
                  {t('buttons.next')}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('buttons.submitting')}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {t('buttons.submit')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
