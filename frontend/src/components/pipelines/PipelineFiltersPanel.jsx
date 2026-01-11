// frontend/src/components/pipelines/PipelineFiltersPanel.jsx
import { useEffect, useRef } from 'react';
import { X, User, Tag, DollarSign, Calendar, Mail, Phone, Globe } from 'lucide-react';

// Mapa de cores legadas (para compatibilidade)
const LEGACY_COLOR_MAP = {
  slate: '#64748b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  orange: '#f97316',
  emerald: '#10b981',
  red: '#ef4444',
  pink: '#ec4899',
  cyan: '#0891b2'
};

const resolveColor = (color) => {
  if (!color) return '#6366f1';
  if (color.startsWith('#')) return color;
  return LEGACY_COLOR_MAP[color] || '#6366f1';
};

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'list', label: 'Lista' },
  { value: 'paid_traffic', label: 'Tráfego Pago' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Outro' }
];

const PipelineFiltersPanel = ({
  filters,
  onChange,
  stages = [],
  tags = [],
  users = [],
  onClose
}) => {
  const panelRef = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleStageToggle = (stageId) => {
    const newStages = filters.stages.includes(stageId)
      ? filters.stages.filter(id => id !== stageId)
      : [...filters.stages, stageId];
    onChange({ ...filters, stages: newStages });
  };

  const handleTagToggle = (tagId) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(id => id !== tagId)
      : [...filters.tags, tagId];
    onChange({ ...filters, tags: newTags });
  };

  const handleSourceToggle = (source) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter(s => s !== source)
      : [...filters.sources, source];
    onChange({ ...filters, sources: newSources });
  };

  const clearAllFilters = () => {
    onChange({
      stages: [],
      tags: [],
      owner_id: null,
      value_min: null,
      value_max: null,
      date_from: null,
      date_to: null,
      sources: [],
      has_email: null,
      has_phone: null
    });
  };

  const hasActiveFilters =
    filters.stages.length > 0 ||
    filters.tags.length > 0 ||
    filters.owner_id ||
    filters.value_min ||
    filters.value_max ||
    filters.date_from ||
    filters.date_to ||
    filters.sources.length > 0 ||
    filters.has_email !== null ||
    filters.has_phone !== null;

  return (
    <div
      ref={panelRef}
      className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Filtros</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Etapas */}
        {stages.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <span className="w-3 h-3 rounded bg-purple-500"></span>
              Etapa
            </label>
            <div className="flex flex-wrap gap-1.5">
              {stages.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => handleStageToggle(stage.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.stages.includes(stage.id)
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: resolveColor(stage.color) }}></span>
                  {stage.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Responsável */}
        {users.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-3 h-3" />
              Responsável
            </label>
            <select
              value={filters.owner_id || ''}
              onChange={(e) => onChange({ ...filters, owner_id: e.target.value || null })}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos os responsáveis</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Etiquetas */}
        {tags.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              <Tag className="w-3 h-3" />
              Etiquetas
            </label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filters.tags.includes(tag.id)
                      ? 'ring-1 ring-purple-500'
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                    borderColor: `${tag.color}40`
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Valor */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <DollarSign className="w-3 h-3" />
            Valor da Oportunidade
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={filters.value_min || ''}
              onChange={(e) => onChange({ ...filters, value_min: e.target.value ? Number(e.target.value) : null })}
              placeholder="Mín"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              value={filters.value_max || ''}
              onChange={(e) => onChange({ ...filters, value_max: e.target.value ? Number(e.target.value) : null })}
              placeholder="Máx"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Período de criação */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="w-3 h-3" />
            Período de Criação
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.date_from || ''}
              onChange={(e) => onChange({ ...filters, date_from: e.target.value || null })}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <span className="text-gray-400">-</span>
            <input
              type="date"
              value={filters.date_to || ''}
              onChange={(e) => onChange({ ...filters, date_to: e.target.value || null })}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Origem */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            <Globe className="w-3 h-3" />
            Origem
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_OPTIONS.map(source => (
              <button
                key={source.value}
                onClick={() => handleSourceToggle(source.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filters.sources.includes(source.value)
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {source.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dados de contato */}
        <div>
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
            Dados de Contato
          </label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.has_email === true}
                onChange={(e) => onChange({ ...filters, has_email: e.target.checked ? true : null })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <Mail className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Com email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.has_phone === true}
                onChange={(e) => onChange({ ...filters, has_phone: e.target.checked ? true : null })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <Phone className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Com telefone</span>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      {hasActiveFilters && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
          <button
            onClick={clearAllFilters}
            className="w-full px-4 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
          >
            Limpar todos os filtros
          </button>
        </div>
      )}
    </div>
  );
};

export default PipelineFiltersPanel;
