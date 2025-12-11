import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Package, Target, MessageSquare, BookOpen, Check, Save,
  Laptop, Briefcase, Wrench, Package as PackageIcon, GraduationCap,
  HeartPulse, Landmark, Megaphone, Cpu, Factory, ShoppingBag, Home,
  User, Users, UserCog, UserCheck, Building,
  UserPlus, MessageSquarePlus, Hand, Calendar, Filter, ShoppingCart,
  Shield, Linkedin
} from 'lucide-react';
import api from '../../services/api';
import {
  CONNECTION_STRATEGIES,
  CONVERSATION_STYLES,
  OBJECTIVES,
  SALES_METHODOLOGIES
} from './salesRepTemplates';

const SECTIONS = {
  PRODUCT: 'product',
  TARGET: 'target',
  STYLE: 'style',
  METHODOLOGY: 'methodology',
  OBJECTIVE: 'objective',
  LINKEDIN: 'linkedin',
  RULES: 'rules'
};

const AgentEditModal = ({ isOpen, onClose, agent, onSaved }) => {
  const { t } = useTranslation(['hire', 'agents']);
  const [activeSection, setActiveSection] = useState(SECTIONS.PRODUCT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    productService: { categories: [], description: '' },
    targetAudience: { roles: [], companySizes: [], industry: '' },
    conversationStyle: 'consultivo',
    methodology: null,
    objective: 'qualify_transfer',
    maxMessages: 3,
    schedulingLink: '',
    connectionStrategy: 'with-intro',
    inviteMessage: '',
    priorityRules: [],
    waitTimeAfterAccept: 5,
    requireLeadReply: false
  });

  // Populate form when agent changes
  useEffect(() => {
    if (isOpen && agent) {
      console.log('Loading agent data:', agent);
      // Parse products_services
      let productService = { categories: [], description: '' };
      if (agent.products_services) {
        if (typeof agent.products_services === 'string') {
          try {
            productService = JSON.parse(agent.products_services);
          } catch {
            productService = { categories: [], description: agent.products_services };
          }
        } else {
          productService = agent.products_services;
        }
      }

      // Parse target_audience
      let targetAudience = { roles: [], companySizes: [], industry: '' };
      if (agent.target_audience) {
        if (typeof agent.target_audience === 'string') {
          try {
            targetAudience = JSON.parse(agent.target_audience);
          } catch {
            targetAudience = { roles: [], companySizes: [], industry: agent.target_audience };
          }
        } else {
          targetAudience = agent.target_audience;
        }
      }

      // Parse priority_rules
      let priorityRules = [];
      if (agent.priority_rules) {
        if (typeof agent.priority_rules === 'string') {
          try {
            priorityRules = JSON.parse(agent.priority_rules);
          } catch {
            priorityRules = [];
          }
        } else {
          priorityRules = agent.priority_rules;
        }
      }

      // Extract methodology and objective from config if stored there
      // Config can be a string (from JSON column) or already parsed object
      let agentConfig = {};
      if (agent.config) {
        if (typeof agent.config === 'string') {
          try {
            agentConfig = JSON.parse(agent.config);
          } catch {
            agentConfig = {};
          }
        } else {
          agentConfig = agent.config;
        }
      }
      console.log('Parsed agentConfig:', agentConfig);

      setFormData({
        name: agent.name || '',
        productService,
        targetAudience,
        conversationStyle: agent.behavioral_profile || 'consultivo',
        methodology: agentConfig.methodology_template_id || null,
        objective: agentConfig.objective || 'qualify_transfer',
        maxMessages: agentConfig.max_messages_before_escalation || 3,
        schedulingLink: agent.scheduling_link || '',
        connectionStrategy: agent.connection_strategy || 'with-intro',
        inviteMessage: agent.invite_message || agent.initial_approach || '',
        priorityRules,
        waitTimeAfterAccept: agent.wait_time_after_accept || 5,
        requireLeadReply: agent.require_lead_reply || false
      });
      setHasChanges(false);
      setActiveSection(SECTIONS.PRODUCT);
    }
  }, [isOpen, agent]);

  const updateFormData = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Build agent data with only fields that exist in the database
      const agentData = {
        name: formData.name,
        products_services: formData.productService,
        behavioral_profile: formData.conversationStyle,
        target_audience: formData.targetAudience,
        connection_strategy: formData.connectionStrategy,
        invite_message: formData.inviteMessage,
        initial_approach: formData.inviteMessage || null,
        scheduling_link: formData.schedulingLink,
        priority_rules: formData.priorityRules,
        wait_time_after_accept: formData.waitTimeAfterAccept || 5,
        require_lead_reply: formData.requireLeadReply || false,
        // Store methodology, objective and other wizard settings in config JSON
        config: {
          methodology_template_id: formData.methodology,
          objective: formData.objective,
          max_messages_before_escalation: formData.maxMessages || 3,
          escalate_on_price_question: formData.objective === 'qualify_transfer',
          escalate_on_specific_feature: true,
          escalate_keywords: ['preço', 'quanto custa', 'demo', 'reunião', 'proposta']
        }
      };

      await api.updateAIAgent(agent.id, agentData);
      setHasChanges(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Error saving agent:', err);
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setIsLoading(false);
    }
  };

  // Sidebar sections config
  const sections = [
    { id: SECTIONS.PRODUCT, icon: Package, label: 'Produto' },
    { id: SECTIONS.TARGET, icon: Target, label: 'Público-alvo' },
    { id: SECTIONS.STYLE, icon: MessageSquare, label: 'Estilo' },
    { id: SECTIONS.METHODOLOGY, icon: BookOpen, label: 'Metodologia' },
    { id: SECTIONS.OBJECTIVE, icon: Check, label: 'Objetivo' },
    { id: SECTIONS.LINKEDIN, icon: Linkedin, label: 'LinkedIn' },
    { id: SECTIONS.RULES, icon: Shield, label: 'Regras' }
  ];

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {formData.name?.[0] || 'A'}
            </div>
            <div>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                className="text-lg font-bold text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded px-1 -ml-1"
                placeholder="Nome do vendedor"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Editando configurações
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-40 border-r border-gray-200 dark:border-gray-700 p-1.5 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeSection === SECTIONS.PRODUCT && (
              <ProductSection
                data={formData.productService}
                onChange={(value) => updateFormData('productService', value)}
              />
            )}

            {activeSection === SECTIONS.TARGET && (
              <TargetSection
                data={formData.targetAudience}
                onChange={(value) => updateFormData('targetAudience', value)}
              />
            )}

            {activeSection === SECTIONS.STYLE && (
              <StyleSection
                selected={formData.conversationStyle}
                onChange={(value) => updateFormData('conversationStyle', value)}
              />
            )}

            {activeSection === SECTIONS.METHODOLOGY && (
              <MethodologySection
                selected={formData.methodology}
                onChange={(value) => updateFormData('methodology', value)}
              />
            )}

            {activeSection === SECTIONS.OBJECTIVE && (
              <ObjectiveSection
                selected={formData.objective}
                maxMessages={formData.maxMessages}
                schedulingLink={formData.schedulingLink}
                onChange={(key, value) => updateFormData(key, value)}
              />
            )}

            {activeSection === SECTIONS.LINKEDIN && (
              <LinkedInSection
                connectionStrategy={formData.connectionStrategy}
                inviteMessage={formData.inviteMessage}
                onChange={(key, value) => updateFormData(key, value)}
              />
            )}

            {activeSection === SECTIONS.RULES && (
              <RulesSection
                rules={formData.priorityRules}
                onChange={(value) => updateFormData('priorityRules', value)}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {hasChanges && !error && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Alterações não salvas
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || !hasChanges}
              className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ SECTION COMPONENTS ============

const ProductSection = ({ data, onChange }) => {
  const { t } = useTranslation('hire');
  const productData = data || { categories: [], description: '' };

  const categories = [
    { icon: Laptop, key: 'software', group: 'type' },
    { icon: Briefcase, key: 'consulting', group: 'type' },
    { icon: Wrench, key: 'services', group: 'type' },
    { icon: PackageIcon, key: 'products', group: 'type' },
    { icon: GraduationCap, key: 'education', group: 'type' },
    { icon: HeartPulse, key: 'health', group: 'segment' },
    { icon: Landmark, key: 'finance', group: 'segment' },
    { icon: Megaphone, key: 'marketing', group: 'segment' },
    { icon: Cpu, key: 'technology', group: 'segment' },
    { icon: Factory, key: 'industrial', group: 'segment' },
    { icon: ShoppingBag, key: 'retail', group: 'segment' },
    { icon: Home, key: 'realestate', group: 'segment' }
  ];

  const toggleCategory = (key) => {
    const newCategories = productData.categories.includes(key)
      ? productData.categories.filter(c => c !== key)
      : [...productData.categories, key];
    onChange({ ...productData, categories: newCategories });
  };

  const typeCategories = categories.filter(c => c.group === 'type');
  const segmentCategories = categories.filter(c => c.group === 'segment');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Produto/Serviço
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          O que você vende? Selecione as categorias e descreva.
        </p>
      </div>

      {/* Type categories */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Tipo de oferta
        </label>
        <div className="flex flex-wrap gap-1.5">
          {typeCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = productData.categories.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`product.categories.${cat.key}`, { defaultValue: cat.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Segment categories */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Segmento
        </label>
        <div className="flex flex-wrap gap-1.5">
          {segmentCategories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = productData.categories.includes(cat.key);
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`product.categories.${cat.key}`, { defaultValue: cat.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Descrição
        </label>
        <textarea
          value={productData.description}
          onChange={(e) => onChange({ ...productData, description: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Descreva brevemente o que você vende..."
        />
      </div>
    </div>
  );
};

const TargetSection = ({ data, onChange }) => {
  const { t } = useTranslation('hire');
  const targetData = data || { roles: [], companySizes: [], industry: '' };

  const roles = [
    { icon: User, key: 'ceo' },
    { icon: UserCog, key: 'director' },
    { icon: UserCheck, key: 'manager' },
    { icon: Users, key: 'coordinator' },
    { icon: Building, key: 'owner' }
  ];

  const companySizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

  const toggleRole = (key) => {
    const newRoles = targetData.roles.includes(key)
      ? targetData.roles.filter(r => r !== key)
      : [...targetData.roles, key];
    onChange({ ...targetData, roles: newRoles });
  };

  const toggleCompanySize = (size) => {
    const newSizes = targetData.companySizes.includes(size)
      ? targetData.companySizes.filter(s => s !== size)
      : [...targetData.companySizes, size];
    onChange({ ...targetData, companySizes: newSizes });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Público-alvo
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Para quem você quer vender?
        </p>
      </div>

      {/* Roles */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Cargos
        </label>
        <div className="flex flex-wrap gap-1.5">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = targetData.roles.includes(role.key);
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => toggleRole(role.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`target.roles.${role.key}`, { defaultValue: role.key })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company sizes */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Tamanho da empresa
        </label>
        <div className="flex flex-wrap gap-1.5">
          {companySizes.map((size) => {
            const isSelected = targetData.companySizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleCompanySize(size)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      {/* Industry */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Setor/Indústria
        </label>
        <input
          type="text"
          value={targetData.industry}
          onChange={(e) => onChange({ ...targetData, industry: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          placeholder="Ex: Tecnologia, Saúde, Varejo..."
        />
      </div>
    </div>
  );
};

const StyleSection = ({ selected, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Estilo de Conversa
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Como seu vendedor deve se comunicar?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CONVERSATION_STYLES.map((style) => {
          const isSelected = selected === style.id;
          return (
            <button
              key={style.id}
              type="button"
              onClick={() => onChange(style.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  {style.name}
                </h4>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {style.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MethodologySection = ({ selected, onChange }) => {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Metodologia de Vendas
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Qual framework seu vendedor deve seguir? (Opcional)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SALES_METHODOLOGIES.map((method) => {
          const isSelected = selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              onClick={() => onChange(isSelected ? null : method.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                  {method.name}
                </h4>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {method.shortDescription}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Remover metodologia
        </button>
      )}
    </div>
  );
};

const ObjectiveSection = ({ selected, maxMessages, schedulingLink, onChange }) => {
  const iconMap = {
    UserPlus: UserPlus,
    Filter: Filter,
    Calendar: Calendar,
    ShoppingCart: ShoppingCart
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Objetivo
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          O que seu vendedor deve buscar alcançar?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {OBJECTIVES.map((obj) => {
          const Icon = iconMap[obj.icon] || Check;
          const isSelected = selected === obj.id;
          return (
            <button
              key={obj.id}
              type="button"
              onClick={() => onChange('objective', obj.id)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {obj.name}
                  </h4>
                </div>
                {isSelected && (
                  <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {obj.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Conditional fields */}
      {selected === 'qualify_transfer' && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Máximo de mensagens antes de transferir
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={maxMessages}
            onChange={(e) => onChange('maxMessages', parseInt(e.target.value) || 3)}
            className="w-24 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
      )}

      {selected === 'schedule_meeting' && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Link de agendamento (Calendly, Cal.com, etc)
          </label>
          <input
            type="url"
            value={schedulingLink}
            onChange={(e) => onChange('schedulingLink', e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="https://calendly.com/seu-link"
          />
        </div>
      )}

    </div>
  );
};

const LinkedInSection = ({ connectionStrategy, inviteMessage, onChange }) => {
  const iconMap = {
    UserPlus: UserPlus,
    MessageSquarePlus: MessageSquarePlus,
    HandWaving: Hand
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Configurações do LinkedIn
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Como fazer o primeiro contato no LinkedIn?
        </p>
      </div>

      {/* Connection Strategy */}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          Estratégia de conexão
        </label>
        <div className="space-y-2">
          {CONNECTION_STRATEGIES.map((strategy) => {
            const Icon = iconMap[strategy.icon] || UserPlus;
            const isSelected = connectionStrategy === strategy.id;
            return (
              <button
                key={strategy.id}
                type="button"
                onClick={() => onChange('connectionStrategy', strategy.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-purple-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                      {strategy.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {strategy.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Invite Message */}
      {(connectionStrategy === 'with-intro' || connectionStrategy === 'icebreaker') && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mensagem do convite
          </label>
          <textarea
            value={inviteMessage}
            onChange={(e) => onChange('inviteMessage', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs"
            placeholder="Oi {{first_name}}, tudo bem?..."
          />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span className="text-xs text-gray-500">Variáveis:</span>
            {['{{first_name}}', '{{company}}', '{{title}}'].map((variable) => (
              <button
                key={variable}
                type="button"
                onClick={() => onChange('inviteMessage', (inviteMessage || '') + ` ${variable}`)}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {variable}
              </button>
            ))}
            <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">
              Limite: 300 caracteres
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const RulesSection = ({ rules, onChange }) => {
  const [newRule, setNewRule] = useState({ prefix: 'SEMPRE', instruction: '' });

  const prefixes = ['SEMPRE', 'NUNCA', 'QUANDO', 'SE'];

  const addRule = () => {
    if (newRule.instruction.trim()) {
      onChange([...rules, newRule]);
      setNewRule({ prefix: 'SEMPRE', instruction: '' });
    }
  };

  const removeRule = (index) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Regras Prioritárias
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Instruções que o vendedor deve seguir rigorosamente.
        </p>
      </div>

      {/* Existing rules */}
      {rules.length > 0 && (
        <div className="space-y-1.5">
          {rules.map((rule, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md"
            >
              <span className={`px-1.5 py-0.5 text-xs font-bold rounded ${
                rule.prefix === 'NUNCA' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                rule.prefix === 'SEMPRE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
              }`}>
                {rule.prefix}
              </span>
              <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                {rule.instruction}
              </span>
              <button
                onClick={() => removeRule(index)}
                className="p-0.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new rule */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Adicionar nova regra
        </label>
        <div className="flex gap-1.5">
          <select
            value={newRule.prefix}
            onChange={(e) => setNewRule({ ...newRule, prefix: e.target.value })}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs"
          >
            {prefixes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <input
            type="text"
            value={newRule.instruction}
            onChange={(e) => setNewRule({ ...newRule, instruction: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Ex: mencionar que a primeira reunião é gratuita"
          />
          <button
            onClick={addRule}
            disabled={!newRule.instruction.trim()}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentEditModal;
