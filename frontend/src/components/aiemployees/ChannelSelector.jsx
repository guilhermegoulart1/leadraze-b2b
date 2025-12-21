// frontend/src/components/aiemployees/ChannelSelector.jsx
// Channel selection for AI Employees - LinkedIn, WhatsApp, Email, etc.

import React from 'react';
import { Linkedin, MessageCircle, Mail, Globe } from 'lucide-react';

// Channel configurations with their specific triggers
export const CHANNELS = {
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Prospecte via LinkedIn com convites, mensagens e InMails',
    icon: Linkedin,
    color: 'blue',
    availableFor: ['prospeccao'], // Only for prospecting
    triggers: [
      {
        id: 'invite_sent',
        label: 'Convite Enviado',
        description: 'Quando um convite de conexao e enviado',
        icon: 'send'
      },
      {
        id: 'invite_accepted',
        label: 'Convite Aceito',
        description: 'Quando o lead aceita o convite de conexao',
        icon: 'user-check'
      },
      {
        id: 'invite_ignored',
        label: 'Convite Ignorado',
        description: 'Quando o convite nao e aceito apos X dias',
        icon: 'user-x'
      },
      {
        id: 'message_received',
        label: 'Mensagem Recebida',
        description: 'Quando o lead responde uma mensagem',
        icon: 'message-circle'
      },
      {
        id: 'profile_viewed',
        label: 'Perfil Visualizado',
        description: 'Quando o lead visualiza seu perfil',
        icon: 'eye'
      },
      {
        id: 'post_engagement',
        label: 'Engajou no Post',
        description: 'Quando o lead curte/comenta seu post',
        icon: 'heart'
      },
      {
        id: 'inmail_received',
        label: 'InMail Recebido',
        description: 'Quando recebe resposta de InMail',
        icon: 'mail'
      },
      {
        id: 'no_response',
        label: 'Sem Resposta',
        description: 'Quando nao ha resposta apos X dias',
        icon: 'clock'
      }
    ]
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Atenda e prospecte via WhatsApp Business',
    icon: MessageCircle,
    color: 'green',
    availableFor: ['prospeccao', 'atendimento'],
    triggers: [
      {
        id: 'message_received',
        label: 'Mensagem Recebida',
        description: 'Quando uma nova mensagem e recebida',
        icon: 'message-circle'
      },
      {
        id: 'first_contact',
        label: 'Primeiro Contato',
        description: 'Primeira mensagem de um novo contato',
        icon: 'user-plus'
      },
      {
        id: 'media_received',
        label: 'Midia Recebida',
        description: 'Quando recebe imagem, video ou audio',
        icon: 'image'
      },
      {
        id: 'button_clicked',
        label: 'Botao Clicado',
        description: 'Quando um botao interativo e clicado',
        icon: 'mouse-pointer'
      },
      {
        id: 'list_selected',
        label: 'Lista Selecionada',
        description: 'Quando uma opcao de lista e selecionada',
        icon: 'list'
      },
      {
        id: 'no_response',
        label: 'Sem Resposta',
        description: 'Quando nao ha resposta apos X horas',
        icon: 'clock'
      }
    ]
  },
  email: {
    id: 'email',
    name: 'Email',
    description: 'Campanhas de email outbound e follow-ups',
    icon: Mail,
    color: 'purple',
    availableFor: ['prospeccao'],
    triggers: [
      {
        id: 'email_sent',
        label: 'Email Enviado',
        description: 'Quando um email e enviado',
        icon: 'send'
      },
      {
        id: 'email_opened',
        label: 'Email Aberto',
        description: 'Quando o lead abre o email',
        icon: 'eye'
      },
      {
        id: 'email_clicked',
        label: 'Link Clicado',
        description: 'Quando o lead clica em um link',
        icon: 'mouse-pointer'
      },
      {
        id: 'email_replied',
        label: 'Email Respondido',
        description: 'Quando o lead responde o email',
        icon: 'reply'
      },
      {
        id: 'email_bounced',
        label: 'Email Rejeitado',
        description: 'Quando o email nao e entregue',
        icon: 'x-circle'
      },
      {
        id: 'no_response',
        label: 'Sem Resposta',
        description: 'Quando nao ha resposta apos X dias',
        icon: 'clock'
      }
    ]
  },
  webchat: {
    id: 'webchat',
    name: 'Chat do Site',
    description: 'Widget de chat para seu site',
    icon: Globe,
    color: 'indigo',
    availableFor: ['atendimento'],
    triggers: [
      {
        id: 'chat_started',
        label: 'Chat Iniciado',
        description: 'Quando visitante inicia conversa',
        icon: 'message-circle'
      },
      {
        id: 'message_received',
        label: 'Mensagem Recebida',
        description: 'Quando recebe mensagem do visitante',
        icon: 'message-square'
      },
      {
        id: 'page_visited',
        label: 'Pagina Visitada',
        description: 'Quando visitante acessa pagina especifica',
        icon: 'file'
      },
      {
        id: 'time_on_page',
        label: 'Tempo na Pagina',
        description: 'Quando visitante fica X segundos',
        icon: 'clock'
      },
      {
        id: 'exit_intent',
        label: 'Intencao de Saida',
        description: 'Quando visitante vai fechar a pagina',
        icon: 'log-out'
      }
    ]
  }
};

const colorClasses = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    borderHover: 'hover:border-blue-400 dark:hover:border-blue-600',
    borderSelected: 'border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20',
    icon: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    borderHover: 'hover:border-green-400 dark:hover:border-green-600',
    borderSelected: 'border-green-500 dark:border-green-500 ring-2 ring-green-500/20',
    icon: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/40'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    borderHover: 'hover:border-purple-400 dark:hover:border-purple-600',
    borderSelected: 'border-purple-500 dark:border-purple-500 ring-2 ring-purple-500/20',
    icon: 'text-purple-600 dark:text-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40'
  },
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    borderHover: 'hover:border-indigo-400 dark:hover:border-indigo-600',
    borderSelected: 'border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20',
    icon: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40'
  }
};

const ChannelSelector = ({ agentType, selectedChannel, onSelect }) => {
  // Filter channels available for the selected agent type
  const availableChannels = Object.values(CHANNELS).filter(
    channel => channel.availableFor.includes(agentType)
  );

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
          Escolha o Canal
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {agentType === 'prospeccao'
            ? 'Por qual canal seu agente vai prospectar?'
            : 'Por qual canal seu agente vai atender?'}
        </p>
      </div>

      {/* Channel cards - 3 columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl mx-auto">
        {availableChannels.map((channel) => {
          const Icon = channel.icon;
          const colors = colorClasses[channel.color];
          const isSelected = selectedChannel === channel.id;

          return (
            <button
              key={channel.id}
              onClick={() => onSelect(channel.id)}
              className={`
                relative p-3 rounded-xl border-2 text-left transition-all duration-200
                ${colors.bg} ${isSelected ? colors.borderSelected : `${colors.border} ${colors.borderHover}`}
              `}
            >
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${colors.icon}`} />
              </div>

              {/* Content */}
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                {channel.name}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                {channel.description}
              </p>

              {/* Triggers preview */}
              <div className="flex flex-wrap gap-1">
                {channel.triggers.slice(0, 3).map((trigger) => (
                  <span
                    key={trigger.id}
                    className="text-[10px] px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                  >
                    {trigger.label}
                  </span>
                ))}
                {channel.triggers.length > 3 && (
                  <span className="text-[10px] px-1.5 py-0.5 text-gray-500 dark:text-gray-500">
                    +{channel.triggers.length - 3} mais
                  </span>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className={`absolute top-2 right-2 w-5 h-5 rounded-full ${colors.iconBg} flex items-center justify-center`}>
                  <svg className={`w-3 h-3 ${colors.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default ChannelSelector;
