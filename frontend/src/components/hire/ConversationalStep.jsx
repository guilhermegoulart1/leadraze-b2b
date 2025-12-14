import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Laptop, Briefcase, Wrench, Package, Building, User, Users, UserCog, UserCheck,
  GraduationCap, HeartPulse, Landmark, Megaphone, Cpu, Factory, ShoppingBag, Home
} from 'lucide-react';
import ChatMessage from './ChatMessage';

// Product/Service Step - "O que você vende?"
export const ProductStep = ({ candidate, data, onChange }) => {
  const { t } = useTranslation('hire');

  // Parse data - support both old string format and new object format
  const productData = typeof data === 'string'
    ? { categories: [], description: data }
    : { categories: data?.categories || [], description: data?.description || '' };

  const categories = [
    // Tipo de oferta
    { icon: Laptop, key: 'software', group: 'type' },
    { icon: Briefcase, key: 'consulting', group: 'type' },
    { icon: Wrench, key: 'services', group: 'type' },
    { icon: Package, key: 'products', group: 'type' },
    { icon: GraduationCap, key: 'education', group: 'type' },
    // Segmentos
    { icon: HeartPulse, key: 'health', group: 'segment' },
    { icon: Landmark, key: 'finance', group: 'segment' },
    { icon: Megaphone, key: 'marketing', group: 'segment' },
    { icon: Cpu, key: 'technology', group: 'segment' },
    { icon: Factory, key: 'industrial', group: 'segment' },
    { icon: ShoppingBag, key: 'retail', group: 'segment' },
    { icon: Home, key: 'realestate', group: 'segment' },
  ];

  const toggleCategory = (key) => {
    const currentCategories = productData.categories;
    const newCategories = currentCategories.includes(key)
      ? currentCategories.filter(c => c !== key)
      : [...currentCategories, key];
    onChange({ ...productData, categories: newCategories });
  };

  const updateDescription = (description) => {
    onChange({ ...productData, description });
  };

  const typeCategories = categories.filter(c => c.group === 'type');
  const segmentCategories = categories.filter(c => c.group === 'segment');

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <ChatMessage
        type="agent"
        avatar={candidate?.avatar}
        name={candidate?.name}
        color={candidate?.color}
      >
        {t('product.greeting', { name: candidate?.name || 'seu vendedor' })}
      </ChatMessage>

      {/* Question */}
      <ChatMessage
        type="agent"
        avatar={candidate?.avatar}
        name={candidate?.name}
        color={candidate?.color}
      >
        <p className="font-medium">{t('product.question')}</p>
      </ChatMessage>

      {/* Options */}
      <ChatMessage type="options">
        {/* Type categories */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('product.whatYouOffer')}
          </p>
          <div className="flex flex-wrap gap-2">
            {typeCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = productData.categories.includes(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {t(`product.categories.${cat.key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Segment categories */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('product.segment')}
          </p>
          <div className="flex flex-wrap gap-2">
            {segmentCategories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = productData.categories.includes(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => toggleCategory(cat.key)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-purple-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {t(`product.categories.${cat.key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Description */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('product.describeMore')}
          </p>
          <textarea
            value={productData.description}
            onChange={(e) => updateDescription(e.target.value)}
            placeholder={t('product.placeholder')}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none text-sm"
          />
        </div>
      </ChatMessage>
    </div>
  );
};

// Target Audience Step - "Quem é seu cliente ideal?"
export const TargetAudienceStep = ({ candidate, productValue, data, onChange }) => {
  const { t } = useTranslation('hire');

  const roles = [
    { id: 'owner', icon: Building },
    { id: 'director', icon: User },
    { id: 'manager', icon: Users },
    { id: 'coordinator', icon: UserCog },
    { id: 'analyst', icon: UserCheck },
  ];

  const companySizes = [
    { id: '1-10' },
    { id: '11-50' },
    { id: '51-200' },
    { id: '201-500' },
    { id: '500+' },
  ];

  const toggleRole = (roleId) => {
    const currentRoles = data.roles || [];
    const newRoles = currentRoles.includes(roleId)
      ? currentRoles.filter(r => r !== roleId)
      : [...currentRoles, roleId];
    onChange({ ...data, roles: newRoles });
  };

  const toggleSize = (sizeId) => {
    const currentSizes = data.companySizes || [];
    const newSizes = currentSizes.includes(sizeId)
      ? currentSizes.filter(s => s !== sizeId)
      : [...currentSizes, sizeId];
    onChange({ ...data, companySizes: newSizes });
  };

  // Extract short version of product for display
  const shortProduct = productValue?.split('.')[0] || '';

  return (
    <div className="space-y-4">
      {/* Understanding message */}
      <ChatMessage
        type="agent"
        avatar={candidate?.avatar}
        name={candidate?.name}
        color={candidate?.color}
      >
        {t('target.understanding', { product: shortProduct })}
      </ChatMessage>

      {/* Question */}
      <ChatMessage
        type="agent"
        avatar={candidate?.avatar}
        name={candidate?.name}
        color={candidate?.color}
      >
        <p className="font-medium">{t('target.question')}</p>
      </ChatMessage>

      {/* Options */}
      <ChatMessage type="options">
        {/* Role Selection */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('target.selectRoles')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = (data.roles || []).includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-left
                    ${isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{t(`target.roles.${role.id}`)}</span>
                  {isSelected && (
                    <span className="ml-auto text-purple-500 text-xs">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Company Size */}
        <div>
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('target.companySize')}
          </p>
          <div className="flex flex-wrap gap-2">
            {companySizes.map((size) => {
              const isSelected = (data.companySizes || []).includes(size.id);
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => toggleSize(size.id)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {t(`target.companySizes.${size.id}`, { defaultValue: size.id })}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>{t('target.small')}</span>
            <span>{t('target.large')}</span>
          </div>
        </div>
      </ChatMessage>
    </div>
  );
};

export default { ProductStep, TargetAudienceStep };
