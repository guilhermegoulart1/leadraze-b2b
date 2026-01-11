import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';

/**
 * SecretAgentPanel - Botão simples para chamar o agente
 * O resultado é exibido no modal, não mais no painel lateral
 */
const SecretAgentPanel = ({ conversationId, onCallAgent }) => {
  const { t } = useTranslation('secretAgentCoaching');

  return (
    <button
      onClick={() => onCallAgent?.()}
      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
    >
      <Sparkles className="w-4 h-4" />
      {t('panel.callAgentButton')}
    </button>
  );
};

export default SecretAgentPanel;
