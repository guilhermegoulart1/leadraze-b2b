import React from 'react';
import {
  Linkedin,
  MessageCircle,
  Mail,
  MapPin,
  UserCheck,
  Zap,
  ArrowRight
} from 'lucide-react';

const AGENT_TYPES = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Agente para prospecção e conversas no LinkedIn',
    icon: Linkedin,
    color: 'blue',
    features: ['Conversas automáticas', 'Qualificação de leads', 'Base de conhecimento']
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Agente para atendimento via WhatsApp Business',
    icon: MessageCircle,
    color: 'green',
    features: ['Respostas 24/7', 'Qualificação de leads', 'Base de conhecimento']
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Agente para campanhas e respostas de email',
    icon: Mail,
    color: 'purple',
    features: ['Sequências automáticas', 'Personalização', 'Follow-ups']
  },
  {
    id: 'google_maps',
    name: 'Google Maps',
    description: 'Agente para prospecção via Google Maps',
    icon: MapPin,
    color: 'red',
    features: ['Busca por localização', 'Filtros de negócio', 'Extração de dados']
  },
  {
    id: 'facilitador',
    name: 'Facilitador',
    description: 'Agente simplificado que aquece o lead e transfere rapidamente para humano',
    icon: UserCheck,
    color: 'amber',
    features: ['Transferência rápida', 'Mínima configuração', 'Foco em handoff'],
    badge: 'Novo'
  }
];

const COLOR_CLASSES = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-700',
    borderActive: 'border-blue-500 dark:border-blue-400',
    icon: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-200 dark:border-green-700',
    borderActive: 'border-green-500 dark:border-green-400',
    icon: 'text-green-600 dark:text-green-400',
    badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-200 dark:border-purple-700',
    borderActive: 'border-purple-500 dark:border-purple-400',
    icon: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-700',
    borderActive: 'border-red-500 dark:border-red-400',
    icon: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-700',
    borderActive: 'border-amber-500 dark:border-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
  }
};

/**
 * AgentTypeSelector
 * Cards para seleção do tipo de agente
 */
const AgentTypeSelector = ({
  value,
  onChange,
  disabled = false,
  availableTypes = null, // null = all types, array = filter to specific types
  showFeatures = true,
  compact = false
}) => {
  const types = availableTypes
    ? AGENT_TYPES.filter(t => availableTypes.includes(t.id))
    : AGENT_TYPES;

  if (compact) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {types.map(type => {
          const Icon = type.icon;
          const colors = COLOR_CLASSES[type.color];
          const isSelected = value === type.id;

          return (
            <button
              key={type.id}
              type="button"
              onClick={() => !disabled && onChange(type.id)}
              disabled={disabled}
              className={`
                relative p-3 rounded-lg border-2 transition-all text-center
                ${isSelected
                  ? `${colors.bg} ${colors.borderActive} ring-2 ring-offset-1 ring-${type.color}-200`
                  : `bg-white dark:bg-gray-800 ${colors.border} hover:${colors.bg}`
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {type.badge && (
                <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${colors.badge}`}>
                  {type.badge}
                </span>
              )}
              <Icon className={`w-6 h-6 mx-auto mb-1.5 ${colors.icon}`} />
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{type.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Inline compact mode - all in one row
  return (
    <div className="flex flex-wrap gap-2">
      {types.map(type => {
        const Icon = type.icon;
        const colors = COLOR_CLASSES[type.color];
        const isSelected = value === type.id;

        return (
          <div key={type.id} className="relative group">
            <button
              type="button"
              onClick={() => !disabled && onChange(type.id)}
              disabled={disabled}
              className={`
                relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all
                ${isSelected
                  ? `${colors.bg} ${colors.borderActive} ring-2 ring-offset-1 ring-${type.color}-200`
                  : `bg-white dark:bg-gray-800 ${colors.border} hover:${colors.bg}`
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {type.badge && (
                <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${colors.badge}`}>
                  {type.badge}
                </span>
              )}
              <Icon className={`w-4 h-4 ${colors.icon}`} />
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{type.name}</span>
            </button>

            {/* Tooltip with details */}
            <div className="absolute left-0 bottom-full mb-1 w-56 p-2.5 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">{type.description}</p>
              {showFeatures && (
                <div className="flex flex-wrap gap-1">
                  {type.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded-full"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgentTypeSelector;
export { AGENT_TYPES, COLOR_CLASSES };
