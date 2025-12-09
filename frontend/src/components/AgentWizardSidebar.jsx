import React from 'react';
import {
  User,
  Brain,
  UserCheck,
  BookOpen,
  Play,
  MapPin,
  Building,
  Filter,
  Zap,
  Mail,
  Check,
  AlertCircle
} from 'lucide-react';

// Define sections for each agent type
const SECTIONS_BY_TYPE = {
  linkedin: [
    { id: 'basic', label: 'Informações Básicas', icon: User },
    { id: 'ai_config', label: 'Configuração de IA', icon: Brain },
    { id: 'transfer', label: 'Transferência Automática', icon: UserCheck },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'test', label: 'Modo Teste', icon: Play }
  ],

  whatsapp: [
    { id: 'basic', label: 'Informações Básicas', icon: User },
    { id: 'ai_config', label: 'Configuração de IA', icon: Brain },
    { id: 'transfer', label: 'Transferência Automática', icon: UserCheck },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'test', label: 'Modo Teste', icon: Play }
  ],

  email: [
    { id: 'basic', label: 'Informações Básicas', icon: User },
    { id: 'ai_config', label: 'Configuração de IA', icon: Brain },
    { id: 'email_settings', label: 'Config. de Email', icon: Mail },
    { id: 'transfer', label: 'Transferência Automática', icon: UserCheck },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'test', label: 'Modo Teste', icon: Play }
  ],

  google_maps: [
    { id: 'basic', label: 'Informações Básicas', icon: User },
    { id: 'location', label: 'Localização', icon: MapPin },
    { id: 'business', label: 'Nicho de Negócio', icon: Building },
    { id: 'filters', label: 'Filtros', icon: Filter },
    { id: 'actions', label: 'Ações', icon: Zap },
    { id: 'transfer', label: 'Transferência Automática', icon: UserCheck },
    { id: 'test', label: 'Modo Teste', icon: Play }
  ],

  facilitador: [
    { id: 'basic', label: 'Informações Básicas', icon: User },
    { id: 'transfer', label: 'Transferência Automática', icon: UserCheck },
    { id: 'test', label: 'Modo Teste', icon: Play }
  ],

  // Default when no type selected yet
  '': [
    { id: 'basic', label: 'Informações Básicas', icon: User }
  ]
};

/**
 * AgentWizardSidebar
 * Menu lateral para navegação entre seções do wizard de agentes
 */
const AgentWizardSidebar = ({
  agentType,
  activeSection,
  sectionStatus = {},
  onSectionChange,
  disabled = false
}) => {
  const sections = SECTIONS_BY_TYPE[agentType] || SECTIONS_BY_TYPE[''];

  return (
    <div className="w-full">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1.5">
        <div className="space-y-0.5">
          {sections.map((section) => {
            const Icon = section.icon;
            const status = sectionStatus[section.id];
            const isActive = activeSection === section.id;
            const isDisabled = disabled && section.id !== 'basic' && !agentType;

            return (
              <button
                key={section.id}
                onClick={() => !isDisabled && onSectionChange(section.id)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all
                  ${isActive
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {/* Status indicator */}
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {status === 'complete' ? (
                    <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                    </div>
                  ) : status === 'error' ? (
                    <div className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <AlertCircle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    </div>
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} />
                  )}
                </div>

                {/* Label */}
                <span className={`text-xs font-medium ${isActive ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                  {section.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AgentWizardSidebar;
export { SECTIONS_BY_TYPE };
