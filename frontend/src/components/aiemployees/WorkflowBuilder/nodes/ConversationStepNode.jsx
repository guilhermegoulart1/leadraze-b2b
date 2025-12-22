// frontend/src/components/aiemployees/WorkflowBuilder/nodes/ConversationStepNode.jsx
// Conversation step node - represents a stage in the conversation

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { MessageCircle, Target, Clock, MessageSquare, Trash2, Copy, X, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

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
            Excluir Etapa
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

// Check if step configuration is complete
const checkStepComplete = (data) => {
  const issues = [];

  if (!data.instructions || data.instructions.trim() === '') {
    issues.push('Adicione instrucoes para a IA');
  }

  if (!data.objective || data.objective.trim() === '') {
    issues.push('Defina o objetivo da etapa');
  }

  return issues;
};

const ConversationStepNode = ({ id, data, selected }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Check if configuration is complete
  const configIssues = checkStepComplete(data);
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
          w-[300px] rounded-xl shadow-lg border-2 overflow-hidden relative group
          ${isIncomplete
            ? 'border-amber-400 dark:border-amber-500'
            : selected
              ? 'border-purple-500 shadow-purple-500/20 shadow-xl'
              : 'border-purple-400/50 hover:border-purple-400'}
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
            title="Clonar etapa"
          >
            <Copy className="w-4 h-4 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
            title="Excluir etapa"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        </div>

        {/* Input handle - left side */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-4 !h-4 !bg-purple-500 !border-2 !border-white"
        />

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-base">ETAPA {data.stepNumber || 1}</span>
          </div>
          {data.hasMaxMessages && data.maxMessages && (
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5 text-white" />
              <span className="text-sm text-white font-medium">{data.maxMessages} msgs</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 p-5 space-y-4">
          {/* Step Name */}
          <h4 className="font-semibold text-gray-900 dark:text-white text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-500" />
            {data.label || 'Etapa da Conversa'}
          </h4>

          {/* Instructions preview */}
          {data.instructions && (
            <div className="text-sm text-gray-600 dark:text-gray-300 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg line-clamp-3 border-l-3 border-purple-400">
              {data.instructions}
            </div>
          )}

          {/* Objective */}
          {data.objective && (
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {data.objective}
              </span>
            </div>
          )}

          {/* Examples indicator */}
          {data.examples && data.examples.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg w-fit">
              <MessageCircle className="w-4 h-4" />
              <span>{data.examples.length} exemplo(s)</span>
            </div>
          )}

        </div>

        {/* Branch labels section */}
        <div className="bg-white dark:bg-gray-800 px-5 pb-4">
          <div className="flex flex-col items-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            {/* Success row */}
            <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-md pr-5">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>ATINGIDO</span>
            </div>
            {/* Failure row */}
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-md pr-5">
              <XCircle className="w-3.5 h-3.5" />
              <span>NAO ATINGIDO</span>
            </div>
          </div>
        </div>

        {/* Output handles - positioned from bottom for consistent alignment */}
        <Handle
          type="source"
          position={Position.Right}
          id="success"
          style={{ bottom: 52, top: 'auto' }}
          className="!w-4 !h-4 !bg-green-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="failure"
          style={{ bottom: 20, top: 'auto' }}
          className="!w-4 !h-4 !bg-red-500 !border-2 !border-white"
        />
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        nodeName={data.label || `Etapa ${data.stepNumber || 1}`}
      />
    </>
  );
};

export default memo(ConversationStepNode);
