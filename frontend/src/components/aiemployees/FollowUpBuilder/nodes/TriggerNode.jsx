// frontend/src/components/aiemployees/FollowUpBuilder/nodes/TriggerNode.jsx
// Follow-up trigger node - "No Response" with wait time

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, Trash2, Copy, X, AlertTriangle } from 'lucide-react';

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
            Excluir Trigger
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

const TriggerNode = ({ id, data, selected }) => {
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
          w-[260px] rounded-xl shadow-lg border-2 overflow-hidden relative group
          ${selected
            ? 'border-green-500 shadow-green-500/20 shadow-xl'
            : 'border-green-400/50 hover:border-green-400'}
          transition-all duration-200
        `}
      >
        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={handleClone}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600 transition-all"
            title="Clonar trigger"
          >
            <Copy className="w-4 h-4 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
            title="Excluir trigger"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-base">TRIGGER</span>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 p-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <Clock className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                {data.label || 'Sem Resposta'}
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Quando lead nao responde
              </p>
            </div>
          </div>

          {data.description && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
              {data.description}
            </div>
          )}
        </div>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-4 !h-4 !bg-green-500 !border-2 !border-white"
        />
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        nodeName={data.label || 'Sem Resposta'}
      />
    </>
  );
};

export default memo(TriggerNode);
