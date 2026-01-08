import React, { useState, useEffect } from 'react';
import {
  X, XCircle, Loader, ChevronDown, AlertCircle, FileText
} from 'lucide-react';
import api from '../../services/api';

const LoseOpportunityModal = ({ isOpen, onClose, opportunity, targetStageId, onSuccess }) => {
  const [reasons, setReasons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedReason, setSelectedReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadReasons();
      setSelectedReason('');
      setNotes('');
      setError('');
    }
  }, [isOpen]);

  const loadReasons = async () => {
    setLoading(true);
    try {
      const response = await api.getDiscardReasons({ active_only: 'true' });
      const loadedReasons = response.data?.reasons || [];
      setReasons(loadedReasons);

      // If no reasons, seed defaults
      if (loadedReasons.length === 0) {
        await api.seedDiscardReasons();
        const refreshed = await api.getDiscardReasons({ active_only: 'true' });
        setReasons(refreshed.data?.reasons || []);
      }
    } catch (err) {
      console.error('Error loading discard reasons:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError('Selecione um motivo de perda');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Move opportunity to loss stage with reason
      const response = await api.moveOpportunity(opportunity.id, {
        stage_id: targetStageId,
        loss_reason_id: selectedReason,
        loss_notes: notes || null
      });

      if (response.success) {
        onSuccess?.(response.data.opportunity);
        onClose();
      }
    } catch (err) {
      console.error('Error losing opportunity:', err);
      setError(err.message || 'Erro ao marcar oportunidade como perdida');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedReasonData = reasons.find(r => r.id === selectedReason);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-red-500 to-rose-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Marcar como Perdido
              </h2>
              <p className="text-sm text-red-100 mt-1">
                {opportunity?.contact_name || opportunity?.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-4">
          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Reason Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Motivo da perda *
            </label>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    Selecione um motivo
                  </option>
                  {reasons.map(reason => (
                    <option key={reason.id} value={reason.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      {reason.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            )}
            {selectedReasonData?.description && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {selectedReasonData.description}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre a perda..."
              rows={4}
              className="w-full px-4 py-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedReason}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && <Loader className="w-4 h-4 animate-spin" />}
              <XCircle className="w-4 h-4" />
              Marcar como Perdido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoseOpportunityModal;
