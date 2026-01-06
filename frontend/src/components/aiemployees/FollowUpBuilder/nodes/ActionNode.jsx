// frontend/src/components/aiemployees/FollowUpBuilder/nodes/ActionNode.jsx
// Follow-up action node - simplified version for follow-up flows

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  PhoneCall,
  Send,
  Tag,
  MinusCircle,
  XCircle,
  Mail,
  Trash2,
  Copy,
  X,
  AlertTriangle,
  Sparkles,
  Clock
} from 'lucide-react';

const actionConfigs = {
  wait: {
    icon: Clock,
    label: 'Aguardar',
    color: 'amber',
    hasOutput: true
  },
  send_message: {
    icon: Send,
    label: 'Enviar Mensagem',
    color: 'cyan',
    hasOutput: true
  },
  ai_message: {
    icon: Sparkles,
    label: 'Mensagem com IA',
    color: 'purple',
    hasOutput: true
  },
  send_email: {
    icon: Mail,
    label: 'Enviar Email',
    color: 'blue',
    hasOutput: true
  },
  add_tag: {
    icon: Tag,
    label: 'Adicionar Tag',
    color: 'orange',
    hasOutput: true
  },
  remove_tag: {
    icon: MinusCircle,
    label: 'Remover Tag',
    color: 'orange',
    hasOutput: true
  },
  transfer: {
    icon: PhoneCall,
    label: 'Transferir',
    color: 'blue',
    hasOutput: false
  },
  close_negative: {
    icon: XCircle,
    label: 'Encerrar (Perdido)',
    color: 'red',
    hasOutput: false
  }
};

// Função para gerar estilos de tag a partir de cor hex
const getTagStyles = (hexColor) => {
  const colorMap = {
    purple: '#9333ea',
    blue: '#2563eb',
    green: '#16a34a',
    yellow: '#ca8a04',
    red: '#dc2626',
    pink: '#db2777',
    orange: '#ea580c',
    gray: '#6b7280',
  };

  const hex = colorMap[hexColor] || hexColor || '#9333ea';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    color: hex,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
  };
};

const colorClasses = {
  amber: {
    border: 'border-amber-400/50 hover:border-amber-400',
    borderSelected: 'border-amber-500 shadow-amber-500/20',
    bg: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400'
  },
  blue: {
    border: 'border-blue-400/50 hover:border-blue-400',
    borderSelected: 'border-blue-500 shadow-blue-500/20',
    bg: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400'
  },
  cyan: {
    border: 'border-cyan-400/50 hover:border-cyan-400',
    borderSelected: 'border-cyan-500 shadow-cyan-500/20',
    bg: 'from-cyan-500 to-cyan-600',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconText: 'text-cyan-600 dark:text-cyan-400'
  },
  purple: {
    border: 'border-purple-400/50 hover:border-purple-400',
    borderSelected: 'border-purple-500 shadow-purple-500/20',
    bg: 'from-purple-500 to-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconText: 'text-purple-600 dark:text-purple-400'
  },
  orange: {
    border: 'border-orange-400/50 hover:border-orange-400',
    borderSelected: 'border-orange-500 shadow-orange-500/20',
    bg: 'from-orange-500 to-orange-600',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconText: 'text-orange-600 dark:text-orange-400'
  },
  red: {
    border: 'border-red-400/50 hover:border-red-400',
    borderSelected: 'border-red-500 shadow-red-500/20',
    bg: 'from-red-500 to-red-600',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconText: 'text-red-600 dark:text-red-400'
  }
};

// Delete confirmation modal
const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, nodeName }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm mx-4 z-10">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Excluir Acao
          </h3>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tem certeza que deseja excluir <span className="font-medium text-gray-900 dark:text-white">"{nodeName}"</span>?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

const ActionNode = ({ id, data, selected }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const config = actionConfigs[data.actionType] || actionConfigs.send_message;
  const Icon = config.icon;
  const colors = colorClasses[config.color] || colorClasses.blue;

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleClone = (e) => {
    e.stopPropagation();
    if (data.onClone) {
      data.onClone(id);
    }
  };

  const confirmDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
    setShowDeleteModal(false);
  };

  return (
    <>
      <div
        className={`
          w-[240px] rounded-xl shadow-lg border-2 overflow-hidden relative group
          ${selected ? `${colors.borderSelected} shadow-xl` : colors.border}
          transition-all duration-200
        `}
      >
        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={handleClone}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
            title="Clonar acao"
          >
            <Copy className="w-4 h-4 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
            title="Excluir acao"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        </div>

        {/* Input handle */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white"
        />

        {/* Header */}
        <div className={`bg-gradient-to-r ${colors.bg} px-4 py-3 flex items-center gap-3`}>
          <div className="p-2 bg-white/20 rounded-lg">
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-base">ACAO</span>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-4">
            <div className={`p-3 ${colors.iconBg} rounded-xl`}>
              <Icon className={`w-7 h-7 ${colors.iconText}`} />
            </div>
            <div className="flex-1">
              {data.actionType === 'wait' ? (
                <>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                    {data.waitTime || 24} {data.waitUnit === 'seconds' ? 'segundos' : data.waitUnit === 'minutes' ? 'minutos' : data.waitUnit === 'days' ? 'dias' : 'horas'}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Aguardar sem resposta
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                    {data.label || config.label}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {config.label}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Message preview */}
          {data.message && data.actionType !== 'ai_message' && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg line-clamp-2">
              {data.message}
            </div>
          )}

          {/* AI Instructions preview */}
          {data.actionType === 'ai_message' && data.aiInstructions && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg line-clamp-2 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-medium mb-1">
                <Sparkles className="w-3 h-3" />
                Instrucoes IA
              </div>
              {data.aiInstructions}
            </div>
          )}

          {/* Add Tag - Display selected tags */}
          {data.actionType === 'add_tag' && data.params?.tags?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.params.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs font-medium rounded border"
                  style={getTagStyles(tag.color)}
                >
                  + {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Remove Tag - Display tags to remove */}
          {data.actionType === 'remove_tag' && data.params?.tags?.length > 0 && !data.params?.removeAll && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.params.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs font-medium rounded border line-through opacity-75"
                  style={getTagStyles(tag.color)}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Remove All Tags indicator */}
          {data.actionType === 'remove_tag' && data.params?.removeAll && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-sm">
                <MinusCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-red-700 dark:text-red-300 font-medium">
                  Remover todas as tags
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Output handle */}
        {config.hasOutput && (
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white"
          />
        )}
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        nodeName={data.label || config.label}
      />
    </>
  );
};

export default memo(ActionNode);
