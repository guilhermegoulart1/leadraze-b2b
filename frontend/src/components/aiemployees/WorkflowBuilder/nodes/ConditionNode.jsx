// frontend/src/components/aiemployees/WorkflowBuilder/nodes/ConditionNode.jsx
// Condition node - IF/ELSE branching

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch, HelpCircle, Trash2, Copy, X, AlertTriangle, Clock } from 'lucide-react';

// Conditions that support wait time
const timeBasedConditions = [
  'invite_accepted',
  'has_responded',
  'response_received'
];

// Format wait time for display
const formatWaitTime = (time, unit) => {
  if (!time) return null;
  const labels = {
    minutes: time === 1 ? 'minuto' : 'minutos',
    hours: time === 1 ? 'hora' : 'horas',
    days: time === 1 ? 'dia' : 'dias'
  };
  return `${time} ${labels[unit] || labels.days}`;
};

const conditionLabels = {
  // LinkedIn
  invite_accepted: 'Convite Aceito?',
  invite_ignored: 'Convite Ignorado?',
  is_connected: 'Ja Conectado?',
  // Conversation
  sentiment: 'Sentimento',
  keyword: 'Palavra-chave',
  intent: 'Intencao',
  response_received: 'Resposta Recebida?',
  has_responded: 'Lead Respondeu?',
  // Time
  time_elapsed: 'Tempo Passado',
  // Custom
  custom: 'Customizado'
};

// Boolean conditions that don't need operator/value display
const booleanConditions = [
  'invite_accepted',
  'invite_ignored',
  'is_connected',
  'response_received',
  'has_responded'
];

const operatorLabels = {
  equals: '=',
  not_equals: '!=',
  contains: 'contem',
  not_contains: 'nao contem',
  greater_than: '>',
  less_than: '<'
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
            Excluir Condicao
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

const ConditionNode = ({ id, data, selected }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
          w-[280px] rounded-xl shadow-lg border-2 overflow-hidden relative group
          ${selected
            ? 'border-amber-500 shadow-amber-500/20 shadow-xl'
            : 'border-amber-400/50 hover:border-amber-400'}
          transition-all duration-200
        `}
      >
        {/* Action buttons - appears on hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={handleClone}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
            title="Clonar condicao"
          >
            <Copy className="w-4 h-4 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
            title="Excluir condicao"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        </div>

        {/* Input handle - left side */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white"
        />

        {/* Header with name */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-base">
            {data.label || conditionLabels[data.conditionType] || 'Condicao'}
          </span>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 p-4">
          {/* Condition type */}
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-2">
            {conditionLabels[data.conditionType] || 'Condicao'}
          </p>

          {/* Wait time for time-based conditions */}
          {timeBasedConditions.includes(data.conditionType) && data.waitTime && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded mb-3">
              <Clock className="w-3 h-3" />
              <span>Aguardar {formatWaitTime(data.waitTime, data.waitUnit)}</span>
            </div>
          )}

          {/* For non-boolean conditions, show operator and value */}
          {!booleanConditions.includes(data.conditionType) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center border border-amber-200 dark:border-amber-800 mb-3">
              <div className="font-mono text-sm text-gray-800 dark:text-gray-100">
                {operatorLabels[data.operator] || '='} "{data.value || '...'}"
              </div>
            </div>
          )}

        </div>

        {/* Branch labels section */}
        <div className="bg-white dark:bg-gray-800 px-4 pb-4">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-md pr-5">
              <span>SIM</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-md pr-5">
              <span>NAO</span>
            </div>
          </div>
        </div>

        {/* Output handles - positioned from bottom for consistent alignment */}
        <Handle
          type="source"
          position={Position.Right}
          id="yes"
          style={{ bottom: 44, top: 'auto' }}
          className="!w-4 !h-4 !bg-green-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="no"
          style={{ bottom: 16, top: 'auto' }}
          className="!w-4 !h-4 !bg-red-500 !border-2 !border-white"
        />
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        nodeName={data.label || 'Condicao'}
      />
    </>
  );
};

export default memo(ConditionNode);
