import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Laptop, Briefcase, Wrench, Package, Building, User, Users, UserCog, UserCheck,
  GraduationCap, HeartPulse, Landmark, Megaphone, Cpu, Factory, ShoppingBag, Home, X
} from 'lucide-react';

// Reusable chat bubble component
const ChatBubble = ({ candidate, message, isQuestion = false }) => (
  <div className="flex items-start gap-3 mb-4">
    <div
      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2 dark:ring-offset-gray-900"
      style={{ ringColor: candidate?.color || '#3B82F6' }}
    >
      {candidate?.avatar ? (
        <img
          src={candidate.avatar}
          alt={candidate?.name || ''}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-sm font-bold text-white" style="background-color: ${candidate?.color || '#3B82F6'}">${candidate?.name?.[0] || '?'}</div>`;
          }}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: candidate?.color || '#3B82F6' }}
        >
          {candidate?.name?.[0] || '?'}
        </div>
      )}
    </div>
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl rounded-tl-none p-4 border border-blue-100 dark:border-blue-800 max-w-lg">
      <p className={`text-gray-800 dark:text-gray-200 ${isQuestion ? 'font-medium' : ''}`}>
        {message}
      </p>
    </div>
  </div>
);

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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Chat from candidate */}
      <div>
        <ChatBubble
          candidate={candidate}
          message={t('product.greeting', { name: candidate?.name || 'seu vendedor' })}
        />
        <ChatBubble
          candidate={candidate}
          message={t('product.question')}
          isQuestion
        />
      </div>

      {/* Category Selection */}
      <div className="pl-14 space-y-4">
        {/* Selected categories as chips */}
        {productData.categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {productData.categories.map((key) => {
              const cat = categories.find(c => c.key === key);
              if (!cat) return null;
              const Icon = cat.icon;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(`product.categories.${key}`)}
                  <button
                    type="button"
                    onClick={() => toggleCategory(key)}
                    className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Type categories */}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
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
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-blue-500 text-white shadow-sm'
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
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
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
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isSelected
                      ? 'bg-blue-500 text-white shadow-sm'
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {t('product.describeMore')}
          </p>
          <textarea
            value={productData.description}
            onChange={(e) => updateDescription(e.target.value)}
            placeholder={t('product.placeholder')}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
          />
        </div>
      </div>
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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Chat from candidate */}
      <div>
        <ChatBubble
          candidate={candidate}
          message={t('target.understanding', { product: shortProduct })}
        />
        <ChatBubble
          candidate={candidate}
          message={t('target.question')}
          isQuestion
        />
      </div>

      {/* Role Selection */}
      <div className="pl-14 space-y-6">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('target.selectRoles')}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = (data.roles || []).includes(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => toggleRole(role.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-left
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{t(`target.roles.${role.id}`)}</span>
                  {isSelected && (
                    <span className="ml-auto text-blue-500">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Company Size */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('target.companySize')}
          </p>
          <div className="flex items-center gap-2">
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
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {t(`target.companySizes.${size.id}`, { defaultValue: size.id })}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{t('target.small')}</span>
            <span>{t('target.large')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default { ProductStep, TargetAudienceStep };
