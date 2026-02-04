import React, { useState, useEffect } from 'react';
import { Loader2, Building2 } from 'lucide-react';
import api from '../services/api';

/**
 * SectorSelector
 * Dropdown para seleção de setor (obrigatório para agentes)
 */
const SectorSelector = ({
  value,
  onChange,
  required = true,
  error = null,
  disabled = false,
  className = ''
}) => {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSectors = async () => {
      try {
        setLoading(true);
        const response = await api.getSectors();
        if (response.success) {
          setSectors(response.data || []);
        }
      } catch (err) {
        console.error('Error loading sectors:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSectors();
  }, []);

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span>Setor {required && <span className="text-red-500">*</span>}</span>
        </div>
      </label>

      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || loading}
          className={`
            w-full px-3 py-2.5 text-sm border rounded-lg appearance-none
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400
            dark:focus:ring-gray-500 dark:focus:border-gray-500
            disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
            placeholder-gray-400 dark:placeholder-gray-500
            ${error
              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-gray-600'
            }
          `}
        >
          <option value="">
            {loading ? 'Carregando setores...' : 'Selecione um setor...'}
          </option>
          {sectors.map(sector => (
            <option key={sector.id} value={sector.id}>
              {sector.name}
            </option>
          ))}
        </select>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
          </div>
        )}

        {/* Custom dropdown arrow */}
        {!loading && (
          <div className="absolute right-2.5 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Helper text */}
      {!error && required && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          O setor determina quais usuarios podem receber transferencias
        </p>
      )}
    </div>
  );
};

export default SectorSelector;
