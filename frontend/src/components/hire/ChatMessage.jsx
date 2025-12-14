import React from 'react';

/**
 * ChatMessage - Componente reutilizável para mensagens no wizard conversacional
 *
 * @param {string} type - 'agent' | 'user' | 'options'
 * @param {string} avatar - URL do avatar (para tipo 'agent')
 * @param {string} name - Nome do agente
 * @param {string} color - Cor do agente (fallback para avatar)
 * @param {boolean} animate - Se deve animar a entrada
 * @param {ReactNode} children - Conteúdo da mensagem
 */
const ChatMessage = ({
  type = 'agent',
  avatar,
  name,
  color = '#8B5CF6',
  animate = true,
  className = '',
  children
}) => {
  // Mensagem do agente (à esquerda)
  if (type === 'agent') {
    return (
      <div className={`flex items-start gap-3 ${animate ? 'animate-fadeIn' : ''} ${className}`}>
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
          style={{ '--tw-ring-color': color }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name || 'Agent'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
            style={{
              backgroundColor: color,
              display: avatar ? 'none' : 'flex'
            }}
          >
            {name?.[0]?.toUpperCase() || 'A'}
          </div>
        </div>

        {/* Bubble */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl rounded-tl-none px-4 py-3 border border-purple-100 dark:border-purple-800 max-w-[85%]">
          <div className="text-gray-800 dark:text-gray-200 text-sm">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Resposta do usuário (à direita)
  if (type === 'user') {
    return (
      <div className={`flex justify-end ${animate ? 'animate-fadeIn' : ''} ${className}`}>
        <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%]">
          <div className="text-gray-800 dark:text-gray-200 text-sm">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Opções/Conteúdo interativo (full width, indentado)
  if (type === 'options') {
    return (
      <div className={`pl-12 ${animate ? 'animate-fadeIn' : ''} ${className}`}>
        {children}
      </div>
    );
  }

  // Conteúdo customizado sem wrapper
  return (
    <div className={`${animate ? 'animate-fadeIn' : ''} ${className}`}>
      {children}
    </div>
  );
};

/**
 * ChatDivider - Divisor sutil entre seções do chat
 */
export const ChatDivider = ({ label }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    {label && (
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
        {label}
      </span>
    )}
    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
  </div>
);

/**
 * TypingIndicator - Indicador de digitação do agente
 */
export const TypingIndicator = ({ avatar, name, color = '#8B5CF6' }) => (
  <div className="flex items-start gap-3 animate-fadeIn">
    <div
      className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
      style={{ '--tw-ring-color': color }}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name || 'Agent'}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {name?.[0]?.toUpperCase() || 'A'}
        </div>
      )}
    </div>
    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl rounded-tl-none px-4 py-3 border border-purple-100 dark:border-purple-800">
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

export default ChatMessage;
