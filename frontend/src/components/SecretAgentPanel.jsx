import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';

// Avatares dos agentes (mesmas URLs do backend)
const AGENT_AVATARS = [
  { id: 'diagnostico', image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&h=80&fit=crop&crop=face' },
  { id: 'closer', image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop&crop=face' },
  { id: 'objections', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face' },
  { id: 'relationship', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face' },
  { id: 'discovery', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face' },
  { id: 'reengagement', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face' },
];

/**
 * SecretAgentPanel - Painel visual do time de agentes
 * Exibe avatares sobrepostos e botão para chamar o time
 */
const SecretAgentPanel = ({ onCallAgent }) => {
  const { t } = useTranslation('secretAgentCoaching');

  return (
    <div className="text-center">
      {/* Avatares sobrepostos */}
      <div className="flex justify-center -space-x-2 mb-3">
        {AGENT_AVATARS.map((agent, index) => (
          <img
            key={agent.id}
            src={agent.image}
            alt={t(`agents.${agent.id}.name`)}
            title={t(`agents.${agent.id}.name`)}
            className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 object-cover hover:scale-110 transition-transform"
            style={{ zIndex: AGENT_AVATARS.length - index }}
          />
        ))}
      </div>

      {/* Texto */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {t('panel.teamReady')}
      </p>

      {/* Botão */}
      <button
        onClick={() => onCallAgent?.()}
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-sm"
      >
        <Users className="w-4 h-4" />
        {t('panel.callTeamButton')}
      </button>
    </div>
  );
};

export default SecretAgentPanel;
