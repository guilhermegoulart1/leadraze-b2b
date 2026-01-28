// frontend/src/components/aiemployees/WorkflowBuilder/Sidebar.jsx
// Sidebar with draggable node types - channel aware

import React, { useMemo } from 'react';
import {
  Zap, MessageCircle, GitBranch, PhoneCall, Calendar, Send,
  XCircle, CheckCircle, Tag, MinusCircle, UserCheck, UserX, Eye,
  Heart, Mail, Clock, UserPlus, Image, MousePointer, List,
  Globe, LogOut, Reply, Target, ArrowRightCircle
} from 'lucide-react';

// Channel-specific triggers by agent type
// Prospecção (ativo): invite_sent - você vai atrás do lead
// Atendimento (passivo): message_received, connection_request_received - lead vem até você
const CHANNEL_TRIGGERS = {
  // LinkedIn triggers separados por tipo de agente
  linkedin_prospeccao: [
    { event: 'invite_sent', label: 'Convite Enviado', description: 'Ao enviar convite', icon: Send }
  ],
  linkedin_atendimento: [
    { event: 'message_received', label: 'Msg Recebida', description: 'Lead te envia msg', icon: MessageCircle },
    { event: 'connection_request_received', label: 'Pedido Conexão', description: 'Lead pede conexão', icon: UserPlus }
  ],
  // Fallback para compatibilidade (usa prospecção como padrão)
  linkedin: [
    { event: 'invite_sent', label: 'Convite Enviado', description: 'Ao enviar convite', icon: Send }
  ],
  whatsapp: [
    { event: 'message_received', label: 'Msg Recebida', description: 'Nova mensagem', icon: MessageCircle },
    { event: 'first_contact', label: '1o Contato', description: 'Novo contato', icon: UserPlus },
    { event: 'media_received', label: 'Midia', description: 'Foto/video/audio', icon: Image },
    { event: 'button_clicked', label: 'Botao', description: 'Clicou botao', icon: MousePointer },
    { event: 'list_selected', label: 'Lista', description: 'Selecionou opcao', icon: List }
  ],
  email: [
    { event: 'email_sent', label: 'Email Enviado', description: 'Ao enviar email', icon: Send },
    { event: 'email_opened', label: 'Email Aberto', description: 'Lead abriu', icon: Eye },
    { event: 'email_clicked', label: 'Link Clicado', description: 'Clicou no link', icon: MousePointer },
    { event: 'email_replied', label: 'Respondeu', description: 'Lead respondeu', icon: Reply },
    { event: 'email_bounced', label: 'Rejeitado', description: 'Nao entregue', icon: XCircle }
  ],
  webchat: [
    { event: 'chat_started', label: 'Chat Iniciado', description: 'Visitante inicia', icon: MessageCircle },
    { event: 'message_received', label: 'Msg Recebida', description: 'Nova mensagem', icon: MessageCircle },
    { event: 'page_visited', label: 'Pagina', description: 'Visitou pagina', icon: Globe },
    { event: 'time_on_page', label: 'Tempo', description: 'X segundos', icon: Clock },
    { event: 'exit_intent', label: 'Saindo', description: 'Vai fechar', icon: LogOut }
  ]
};

// Base node categories (non-trigger)
const baseCategories = [
  {
    title: 'Conversa',
    nodes: [
      {
        type: 'conversationStep',
        label: 'Etapa IA',
        description: 'Etapa da conversa',
        icon: MessageCircle,
        color: 'purple'
      }
    ]
  },
  {
    title: 'Logica',
    nodes: [
      {
        type: 'condition',
        label: 'Condicao',
        description: 'IF/ELSE',
        icon: GitBranch,
        color: 'amber'
      }
    ]
  },
  {
    title: 'Acoes',
    nodes: [
      {
        type: 'action',
        subtype: 'transfer',
        label: 'Transferir',
        description: 'Para humano',
        icon: PhoneCall,
        color: 'blue'
      },
      {
        type: 'action',
        subtype: 'schedule',
        label: 'Agendar',
        description: 'Reuniao',
        icon: Calendar,
        color: 'indigo'
      },
      {
        type: 'action',
        subtype: 'send_message',
        label: 'Mensagem',
        description: 'Enviar texto',
        icon: Send,
        color: 'cyan'
      },
      {
        type: 'action',
        subtype: 'add_tag',
        label: 'Add Tag',
        description: 'Adicionar tag',
        icon: Tag,
        color: 'orange'
      },
      {
        type: 'action',
        subtype: 'remove_tag',
        label: 'Rem Tag',
        description: 'Remover tag',
        icon: MinusCircle,
        color: 'orange'
      },
      {
        type: 'action',
        subtype: 'close_positive',
        label: 'Encerrar +',
        description: 'Fim positivo',
        icon: CheckCircle,
        color: 'green'
      },
      {
        type: 'action',
        subtype: 'close_negative',
        label: 'Encerrar -',
        description: 'Fim negativo',
        icon: XCircle,
        color: 'red'
      },
      {
        type: 'action',
        subtype: 'wait',
        label: 'Aguardar',
        description: 'Tempo de espera',
        icon: Clock,
        color: 'amber'
      },
      {
        type: 'action',
        subtype: 'create_opportunity',
        label: 'Criar Oport.',
        description: 'Nova oportunidade',
        icon: Target,
        color: 'purple'
      },
      {
        type: 'action',
        subtype: 'move_stage',
        label: 'Mover Etapa',
        description: 'Mudar etapa',
        icon: ArrowRightCircle,
        color: 'teal'
      }
    ]
  },
  {
    title: 'Integracao',
    nodes: [
      {
        type: 'httpRequest',
        label: 'HTTP Request',
        description: 'Requisicao API',
        icon: Globe,
        color: 'indigo'
      }
    ]
  }
];

const colorClasses = {
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-900/50',
  teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 group-hover:bg-teal-200 dark:group-hover:bg-teal-900/50',
  gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-900/50'
};

const DraggableNode = ({ node }) => {
  const Icon = node.icon;
  const colors = colorClasses[node.color] || colorClasses.gray;

  const onDragStart = (event) => {
    event.dataTransfer.setData('application/reactflow', node.type);
    if (node.subtype) {
      event.dataTransfer.setData('node/subtype', node.subtype);
    }
    if (node.event) {
      event.dataTransfer.setData('node/event', node.event);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group flex items-center gap-2 p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
    >
      <div className={`p-1.5 rounded-lg transition-colors ${colors}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-200 leading-tight">
          {node.label}
        </div>
        <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-tight">
          {node.description}
        </div>
      </div>
    </div>
  );
};

const Sidebar = ({ channel, agentType = 'prospeccao', collapsed = false, onToggle }) => {
  // Build categories with channel-specific triggers based on agent type
  const nodeCategories = useMemo(() => {
    // Para LinkedIn, usa triggers específicos por tipo de agente
    let triggerKey = channel;
    if (channel === 'linkedin') {
      triggerKey = `linkedin_${agentType}`;
    }

    const triggers = CHANNEL_TRIGGERS[triggerKey] || CHANNEL_TRIGGERS[channel] || CHANNEL_TRIGGERS.linkedin;

    const triggerCategory = {
      title: 'Triggers',
      nodes: triggers.map(t => ({
        type: 'trigger',
        event: t.event,
        label: t.label,
        description: t.description,
        icon: t.icon,
        color: 'green'
      }))
    };

    return [triggerCategory, ...baseCategories];
  }, [channel, agentType]);

  if (collapsed) {
    return (
      <div className="w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Expandir componentes"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        {nodeCategories.flatMap(cat => cat.nodes).slice(0, 6).map((node, index) => {
          const Icon = node.icon;
          const colors = colorClasses[node.color] || colorClasses.gray;
          return (
            <div
              key={`${node.label}-${index}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/reactflow', node.type);
                if (node.subtype) e.dataTransfer.setData('node/subtype', node.subtype);
                if (node.event) e.dataTransfer.setData('node/event', node.event);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className={`p-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors ${colors}`}
              title={node.label}
            >
              <Icon className="w-4 h-4" />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="w-52 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Componentes
          </h3>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Minimizar"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {nodeCategories.map((category) => (
          <div key={category.title} className="mb-4">
            <h4 className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
              {category.title}
            </h4>
            <div className="space-y-0.5">
              {category.nodes.map((node, index) => (
                <DraggableNode key={`${node.label}-${index}`} node={node} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Channel indicator */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
          Canal
        </div>
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {channel === 'linkedin' && 'LinkedIn'}
          {channel === 'whatsapp' && 'WhatsApp'}
          {channel === 'email' && 'Email'}
          {channel === 'webchat' && 'Chat do Site'}
          {!channel && 'Nao definido'}
        </div>
      </div>

      {/* Tips */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500">
        Arraste para o canvas
      </div>
    </div>
  );
};

export default Sidebar;
