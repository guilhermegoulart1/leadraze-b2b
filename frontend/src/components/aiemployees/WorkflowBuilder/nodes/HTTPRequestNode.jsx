// frontend/src/components/aiemployees/WorkflowBuilder/nodes/HTTPRequestNode.jsx
// HTTP Request node - Make API calls with success/error routing

import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Globe, CheckCircle, XCircle, Trash2, Copy, X, AlertTriangle } from 'lucide-react';

// Method badge colors
const methodColors = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  PUT: 'bg-amber-500',
  DELETE: 'bg-red-500',
  PATCH: 'bg-purple-500'
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
            Excluir HTTP Request
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

const HTTPRequestNode = ({ id, data, selected }) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const method = data.method || 'GET';
  const hasUrl = !!data.url;
  const hasVariables = data.extractVariables && data.extractVariables.length > 0;

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

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (data.onOpenModal) {
      data.onOpenModal(id);
    }
  };

  const confirmDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
    setShowDeleteModal(false);
  };

  // Truncate URL for display
  const displayUrl = () => {
    if (!data.url) return 'URL nao configurada';
    const url = data.url;
    if (url.length <= 35) return url;
    return url.substring(0, 35) + '...';
  };

  return (
    <>
      <div
        onDoubleClick={handleDoubleClick}
        className={`
          w-[280px] rounded-xl shadow-lg border-2 overflow-hidden relative group cursor-pointer
          ${selected
            ? 'border-indigo-500 shadow-indigo-500/20 shadow-xl'
            : 'border-indigo-400/50 hover:border-indigo-400'}
          transition-all duration-200
        `}
      >
        {/* Warning if URL not configured */}
        {!hasUrl && (
          <div className="absolute -top-2 -right-2 z-20 p-1.5 bg-amber-500 rounded-full shadow-lg" title="URL nao configurada">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Action buttons - appears on hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
          <button
            onClick={handleClone}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
            title="Clonar HTTP Request"
          >
            <Copy className="w-4 h-4 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
            title="Excluir HTTP Request"
          >
            <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" />
          </button>
        </div>

        {/* Input handle - left side */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-4 !h-4 !bg-indigo-500 !border-2 !border-white"
        />

        {/* Header with name */}
        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-base">
            {data.label || 'HTTP Request'}
          </span>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 p-4">
          {/* Method and URL */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 text-xs font-bold text-white rounded ${methodColors[method]}`}>
              {method}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1 font-mono">
              {displayUrl()}
            </span>
          </div>

          {/* Response variables indicator */}
          {hasVariables && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
              {data.responseVariables.length} variavel(is) extraida(s)
            </div>
          )}

          {/* Last test result */}
          {data.lastTestResult && (
            <div className={`p-2 rounded text-xs ${
              data.lastTestResult.status < 400
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">Status: {data.lastTestResult.status}</span>
                <span className="text-[10px] opacity-75">{data.lastTestResult.duration}ms</span>
              </div>
            </div>
          )}
        </div>

        {/* Branch labels section */}
        <div className="bg-white dark:bg-gray-800 px-4 pb-4">
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2.5 py-1.5 rounded-md pr-5">
              <CheckCircle className="w-3 h-3" />
              <span>OK</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2.5 py-1.5 rounded-md pr-5">
              <XCircle className="w-3 h-3" />
              <span>Erro</span>
            </div>
          </div>
        </div>

        {/* Output handles - positioned from bottom for consistent alignment */}
        <Handle
          type="source"
          position={Position.Right}
          id="success"
          style={{ bottom: 44, top: 'auto' }}
          className="!w-4 !h-4 !bg-green-500 !border-2 !border-white"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="error"
          style={{ bottom: 16, top: 'auto' }}
          className="!w-4 !h-4 !bg-red-500 !border-2 !border-white"
        />
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        nodeName={data.label || 'HTTP Request'}
      />
    </>
  );
};

export default memo(HTTPRequestNode);
