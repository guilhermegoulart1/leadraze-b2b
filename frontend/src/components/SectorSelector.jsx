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
      <label className="block text-xs font-medium text-gray-700 mb-1">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-gray-500" />
          <span>Setor {required && <span className="text-red-500">*</span>}</span>
        </div>
      </label>

      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled || loading}
          className={`
            w-full px-3 py-2 text-sm border rounded-lg appearance-none
            focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}
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
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}

      {/* Helper text */}
      {!error && required && (
        <p className="mt-1 text-[10px] text-gray-500">
          O setor determina quais usuários podem receber transferências
        </p>
      )}
    </div>
  );
};

export default SectorSelector;
