// frontend/src/components/aiemployees/AgentProfileStep/IdentityTab.jsx
// Tab de Identidade - vai no Prompt (sempre carregado)

import React from 'react';
import { User, MessageSquare, Target, Sparkles, Shield } from 'lucide-react';
import RulesList from './components/RulesList';

const toneOptions = [
  { value: 'casual', label: 'Casual', description: 'Descontraido e amigavel' },
  { value: 'consultivo', label: 'Consultivo', description: 'Faz perguntas, entende necessidades' },
  { value: 'profissional', label: 'Profissional', description: 'Formal e objetivo' },
  { value: 'tecnico', label: 'Tecnico', description: 'Detalhado e especializado' }
];

const objectiveOptions = [
  { value: 'qualify', label: 'Qualificar Leads', description: 'Identificar potenciais clientes' },
  { value: 'schedule', label: 'Agendar Reunioes', description: 'Marcar demos/calls' },
  { value: 'sell', label: 'Vender Direto', description: 'Fechar negocios' },
  { value: 'support', label: 'Suporte', description: 'Atender e resolver' },
  { value: 'other', label: 'Outro', description: 'Objetivo personalizado' }
];

const personalityTags = [
  'Empatico', 'Direto', 'Paciente', 'Persuasivo', 'Analitico',
  'Energetico', 'Calmo', 'Curioso', 'Assertivo', 'Flexivel'
];

const IdentityTab = ({ profile, onChange }) => {
  const togglePersonality = (tag) => {
    const current = profile.personality || [];
    if (current.includes(tag)) {
      onChange('personality', current.filter(t => t !== tag));
    } else if (current.length < 4) {
      onChange('personality', [...current, tag]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Nome do Agente */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <User className="w-4 h-4" />
          Nome do Agente
        </label>
        <input
          type="text"
          value={profile.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="Ex: Lucas, Ana, Sales AI..."
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white transition-all"
        />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Nome que o agente usara para se apresentar
        </p>
      </div>

      {/* Tom de Voz */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <MessageSquare className="w-4 h-4" />
          Tom de Voz
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {toneOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onChange('tone', option.value)}
              className={`
                p-3 rounded-lg border-2 text-left transition-all
                ${profile.tone === option.value
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
            >
              <div className={`text-sm font-medium ${
                profile.tone === option.value
                  ? 'text-purple-700 dark:text-purple-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Objetivo Principal */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Target className="w-4 h-4" />
          Objetivo Principal
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {objectiveOptions.map(option => (
            <button
              key={option.value}
              onClick={() => {
                onChange('objective', option.value);
                if (option.value !== 'other') {
                  onChange('customObjective', '');
                }
              }}
              className={`
                p-3 rounded-lg border-2 text-left transition-all
                ${profile.objective === option.value
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }
              `}
            >
              <div className={`text-sm font-medium ${
                profile.objective === option.value
                  ? 'text-purple-700 dark:text-purple-400'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {option.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {option.description}
              </div>
            </button>
          ))}
        </div>
        {profile.objective === 'other' && (
          <input
            type="text"
            value={profile.customObjective || ''}
            onChange={(e) => onChange('customObjective', e.target.value)}
            placeholder="Descreva o objetivo do agente..."
            className="mt-3 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white transition-all"
          />
        )}
      </div>

      {/* Personalidade (Tags) */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Sparkles className="w-4 h-4" />
          Personalidade
          <span className="text-xs text-gray-400 font-normal">(max 4)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {personalityTags.map(tag => {
            const isSelected = (profile.personality || []).includes(tag);
            const isDisabled = !isSelected && (profile.personality || []).length >= 4;
            return (
              <button
                key={tag}
                onClick={() => togglePersonality(tag)}
                disabled={isDisabled}
                className={`
                  px-3 py-1.5 rounded-full text-sm font-medium transition-all
                  ${isSelected
                    ? 'bg-purple-500 text-white'
                    : isDisabled
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }
                `}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Regras de Comportamento */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Shield className="w-4 h-4" />
          Regras de Comportamento
        </label>
        <RulesList
          rules={profile.rules || []}
          onChange={(rules) => onChange('rules', rules)}
          placeholder="Ex: Nunca mencionar precos, Sempre confirmar interesse..."
        />
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Diretrizes que o agente deve sempre seguir
        </p>
      </div>
    </div>
  );
};

export default IdentityTab;
