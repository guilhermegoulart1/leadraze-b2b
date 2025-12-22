// frontend/src/components/aiemployees/FollowUpBuilder/Sidebar.jsx
// Sidebar with draggable node types for Follow-Up flows

import React from 'react';
import { Clock, Send, Tag, MinusCircle, XCircle, PhoneCall, Mail, Sparkles } from 'lucide-react';

// Follow-up specific node types
const nodeCategories = [
  {
    title: 'Triggers',
    nodes: [
      {
        type: 'trigger',
        event: 'no_response',
        label: 'Sem Resposta',
        description: 'Quando lead nao responde',
        icon: Clock,
        color: 'green'
      }
    ]
  },
  {
    title: 'Tempo',
    nodes: [
      {
        type: 'action',
        subtype: 'wait',
        label: 'Aguardar',
        description: 'Esperar X tempo',
        icon: Clock,
        color: 'amber'
      }
    ]
  },
  {
    title: 'Acoes',
    nodes: [
      {
        type: 'action',
        subtype: 'send_message',
        label: 'Mensagem',
        description: 'Texto fixo',
        icon: Send,
        color: 'cyan'
      },
      {
        type: 'action',
        subtype: 'ai_message',
        label: 'Msg com IA',
        description: 'IA gera mensagem',
        icon: Sparkles,
        color: 'purple'
      },
      {
        type: 'action',
        subtype: 'send_email',
        label: 'Email',
        description: 'Enviar email',
        icon: Mail,
        color: 'blue'
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
        subtype: 'transfer',
        label: 'Transferir',
        description: 'Para humano',
        icon: PhoneCall,
        color: 'blue'
      },
      {
        type: 'action',
        subtype: 'close_negative',
        label: 'Encerrar',
        description: 'Fechar como perdido',
        icon: XCircle,
        color: 'red'
      }
    ]
  }
];

const colorClasses = {
  green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 group-hover:bg-amber-200 dark:group-hover:bg-amber-900/50',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-200 dark:group-hover:bg-cyan-900/50',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-900/50',
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

const Sidebar = ({ collapsed = false, onToggle }) => {
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

      {/* Tips */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500">
        Arraste para o canvas
      </div>
    </div>
  );
};

export default Sidebar;
