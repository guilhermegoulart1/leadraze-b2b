// frontend/src/components/aiemployees/WorkflowBuilder/nodes/ActionNode.jsx
// Action node - execute actions like transfer, schedule, send, etc.

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import {
  PhoneCall,
  Calendar,
  Send,
  Tag,
  MinusCircle,
  XCircle,
  CheckCircle,
  UserPlus,
  Mail,
  Webhook,
  Trash2,
  Copy,
  X,
  AlertTriangle,
  User,
  Building2,
  RefreshCw,
  Clock,
  MessageCircle,
  FastForward,
  Target,
  ArrowRightCircle
} from 'lucide-react';

const actionConfigs = {
  transfer: {
    icon: PhoneCall,
    label: 'Transferir',
    color: 'blue',
    hasOutput: false
  },
  schedule: {
    icon: Calendar,
    label: 'Agendar Reuniao',
    color: 'purple',
    hasOutput: true
  },
  send_message: {
    icon: Send,
    label: 'Enviar Mensagem',
    color: 'green',
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
  close_positive: {
    icon: CheckCircle,
    label: 'Encerrar (Positivo)',
    color: 'green',
    hasOutput: false
  },
  close_negative: {
    icon: XCircle,
    label: 'Encerrar (Negativo)',
    color: 'red',
    hasOutput: false
  },
  assign_agent: {
    icon: UserPlus,
    label: 'Atribuir Agente',
    color: 'indigo',
    hasOutput: true
  },
  send_email: {
    icon: Mail,
    label: 'Enviar Email',
    color: 'cyan',
    hasOutput: true
  },
  webhook: {
    icon: Webhook,
    label: 'Webhook',
    color: 'gray',
    hasOutput: true
  },
  wait: {
    icon: Clock,
    label: 'Aguardar',
    color: 'amber',
    hasOutput: true
  },
  create_opportunity: {
    icon: Target,
    label: 'Criar Oportunidade',
    color: 'purple',
    hasOutput: true
  },
  move_stage: {
    icon: ArrowRightCircle,
    label: 'Mover Etapa',
    color: 'teal',
    hasOutput: true
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
  blue: {
    border: 'border-blue-400/50 hover:border-blue-400',
    borderSelected: 'border-blue-500 shadow-blue-500/20',
    bg: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconText: 'text-blue-600 dark:text-blue-400'
  },
  purple: {
    border: 'border-purple-400/50 hover:border-purple-400',
    borderSelected: 'border-purple-500 shadow-purple-500/20',
    bg: 'from-purple-500 to-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconText: 'text-purple-600 dark:text-purple-400'
  },
  green: {
    border: 'border-green-400/50 hover:border-green-400',
    borderSelected: 'border-green-500 shadow-green-500/20',
    bg: 'from-green-500 to-green-600',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconText: 'text-green-600 dark:text-green-400'
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
  },
  indigo: {
    border: 'border-indigo-400/50 hover:border-indigo-400',
    borderSelected: 'border-indigo-500 shadow-indigo-500/20',
    bg: 'from-indigo-500 to-indigo-600',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconText: 'text-indigo-600 dark:text-indigo-400'
  },
  cyan: {
    border: 'border-cyan-400/50 hover:border-cyan-400',
    borderSelected: 'border-cyan-500 shadow-cyan-500/20',
    bg: 'from-cyan-500 to-cyan-600',
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconText: 'text-cyan-600 dark:text-cyan-400'
  },
  gray: {
    border: 'border-gray-400/50 hover:border-gray-400',
    borderSelected: 'border-gray-500 shadow-gray-500/20',
    bg: 'from-gray-500 to-gray-600',
    iconBg: 'bg-gray-100 dark:bg-gray-900/30',
    iconText: 'text-gray-600 dark:text-gray-400'
  },
  yellow: {
    border: 'border-yellow-400/50 hover:border-yellow-400',
    borderSelected: 'border-yellow-500 shadow-yellow-500/20',
    bg: 'from-yellow-500 to-yellow-600',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconText: 'text-yellow-600 dark:text-yellow-400'
  },
  teal: {
    border: 'border-teal-400/50 hover:border-teal-400',
    borderSelected: 'border-teal-500 shadow-teal-500/20',
    bg: 'from-teal-500 to-teal-600',
    iconBg: 'bg-teal-100 dark:bg-teal-900/30',
    iconText: 'text-teal-600 dark:text-teal-400'
  },
  amber: {
    border: 'border-amber-400/50 hover:border-amber-400',
    borderSelected: 'border-amber-500 shadow-amber-500/20',
    bg: 'from-amber-500 to-amber-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconText: 'text-amber-600 dark:text-amber-400'
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
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
          Esta acao ira remover todas as conexoes associadas.
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

// Check if action configuration is complete
const checkActionComplete = (data) => {
  const issues = [];

  if (data.actionType === 'transfer') {
    if (!data.transferMode) {
      issues.push('Selecione modo de transferencia');
    } else if (data.transferMode === 'user' && !data.transferUserId) {
      issues.push('Selecione um usuario');
    } else if (data.transferMode === 'sector' && !data.transferSectorId) {
      issues.push('Selecione um setor');
    }
  }

  if (data.actionType === 'schedule') {
    if (!data.params?.schedulingLink) {
      issues.push('Configure o link de agendamento');
    }
  }

  if (data.actionType === 'send_message') {
    if (!data.message || data.message.trim() === '') {
      issues.push('Digite a mensagem');
    }
  }

  if (data.actionType === 'add_tag' || data.actionType === 'remove_tag') {
    if (!data.params?.removeAll && (!data.params?.tags || data.params.tags.length === 0)) {
      issues.push('Selecione pelo menos uma tag');
    }
  }

  if (data.actionType === 'webhook') {
    if (!data.params?.url) {
      issues.push('Configure a URL do webhook');
    }
  }

  if (data.actionType === 'create_opportunity') {
    if (!data.params?.pipelineId) {
      issues.push('Selecione uma pipeline');
    }
    if (!data.params?.stageId) {
      issues.push('Selecione uma etapa');
    }
  }

  if (data.actionType === 'move_stage') {
    if (!data.params?.pipelineId) {
      issues.push('Selecione uma pipeline');
    }
    if (!data.params?.stageId) {
      issues.push('Selecione a etapa destino');
    }
  }

  return issues;
};

const ActionNode = ({ id, data, selected }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const config = actionConfigs[data.actionType] || actionConfigs.send_message;
  const Icon = config.icon;
  const colors = colorClasses[config.color] || colorClasses.blue;

  // Check if configuration is complete
  const configIssues = checkActionComplete(data);
  const isIncomplete = configIssues.length > 0;

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
          w-[260px] rounded-xl shadow-lg border-2 overflow-hidden relative group
          ${isIncomplete ? 'border-amber-400 dark:border-amber-500' : selected ? `${colors.borderSelected} shadow-xl` : colors.border}
          transition-all duration-200
        `}
      >
        {/* Incomplete configuration warning badge */}
        {isIncomplete && (
          <div
            className="absolute -top-2 -right-2 z-20 p-1.5 bg-amber-500 rounded-full shadow-lg cursor-help"
            title={configIssues.join('\n')}
          >
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Action buttons - appears on hover */}
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

        {/* Input handle - left side */}
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
              <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                {data.label || config.label}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {config.label}
              </p>
            </div>
          </div>

          {/* Transfer configuration display */}
          {data.actionType === 'transfer' && data.transferMode && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 text-sm">
                {data.transferMode === 'user' ? (
                  <>
                    <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Para Usuario</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Para Setor</span>
                  </>
                )}
              </div>
              {data.transferMode === 'sector' && data.transferSectorMode && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {data.transferSectorMode === 'round_robin' ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      <span>Round Robin</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3" />
                      <span>Usuario Especifico</span>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Wait configuration display */}
          {data.actionType === 'wait' && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {data.waitTime || 24} {data.waitUnit === 'seconds' ? 'segundos' : data.waitUnit === 'minutes' ? 'minutos' : data.waitUnit === 'days' ? 'dias' : 'horas'}
                </span>
              </div>
            </div>
          )}

          {/* Send Message - Wait for response indicator */}
          {data.actionType === 'send_message' && (
            <div className={`mt-4 p-3 rounded-lg border ${
              data.waitForResponse !== false
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            }`}>
              <div className="flex items-center gap-2 text-sm">
                {data.waitForResponse !== false ? (
                  <>
                    <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-green-700 dark:text-green-300 font-medium">
                      Aguarda resposta
                    </span>
                  </>
                ) : (
                  <>
                    <FastForward className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-orange-700 dark:text-orange-300 font-medium">
                      Continua sem esperar
                    </span>
                  </>
                )}
              </div>
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
          {data.actionType === 'remove_tag' && data.params?.tags?.length > 0 && (
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

          {/* Create Opportunity configuration display */}
          {data.actionType === 'create_opportunity' && data.params?.pipelineId && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 text-sm">
                <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-purple-700 dark:text-purple-300 font-medium">
                  {data.params.pipelineName || 'Pipeline'}
                </span>
              </div>
              {data.params.stageName && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>{data.params.stageName}</span>
                </div>
              )}
            </div>
          )}

          {/* Move Stage configuration display */}
          {data.actionType === 'move_stage' && data.params?.pipelineId && (
            <div className="mt-4 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2 text-sm">
                <ArrowRightCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span className="text-teal-700 dark:text-teal-300 font-medium">
                  {data.params.pipelineName || 'Pipeline'}
                </span>
              </div>
              {data.params.stageName && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                  <span>→ {data.params.stageName}</span>
                </div>
              )}
            </div>
          )}

          {/* Message preview if applicable */}
          {data.message && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg line-clamp-3 border-l-3 border-gray-300">
              {data.message}
            </div>
          )}
        </div>

        {/* Output handle - right side (only if action continues workflow) */}
        {config.hasOutput && (
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white"
          />
        )}
      </div>

      {/* Delete confirmation modal */}
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
