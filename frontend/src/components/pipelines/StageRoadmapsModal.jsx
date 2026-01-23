// frontend/src/components/pipelines/StageRoadmapsModal.jsx
import { useState, useEffect } from 'react';
import {
  X,
  Map,
  Plus,
  Trash2,
  GripVertical,
  Loader,
  Search,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../services/api';

const StageRoadmapsModal = ({ pipeline, onClose }) => {
  const [stages, setStages] = useState([]);
  const [availableRoadmaps, setAvailableRoadmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedStages, setExpandedStages] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [addingTo, setAddingTo] = useState(null);

  useEffect(() => {
    loadData();
  }, [pipeline.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [stageRoadmapsRes, roadmapsRes] = await Promise.all([
        api.getStageRoadmaps(pipeline.id),
        api.getRoadmaps({ active_only: 'true' })
      ]);

      if (stageRoadmapsRes.success) {
        const stageRoadmapsMap = {};
        (stageRoadmapsRes.data.stages || []).forEach(s => {
          stageRoadmapsMap[s.stage_id] = s;
        });

        const allStages = (pipeline.stages || []).map(s => ({
          stage_id: s.id,
          stage_name: s.name,
          stage_color: s.color,
          stage_position: s.position,
          roadmaps: stageRoadmapsMap[s.id]?.roadmaps || []
        }));

        setStages(allStages);
        setExpandedStages({});
      }

      if (roadmapsRes.success) {
        setAvailableRoadmaps(roadmapsRes.data || []);
      }
    } catch (err) {
      setError('Erro ao carregar dados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStage = (stageId) => {
    setExpandedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  const handleAddRoadmap = async (stageId, roadmapId) => {
    try {
      setSaving(true);
      setError('');
      const response = await api.addStageRoadmap(pipeline.id, stageId, roadmapId);
      if (response.success) {
        await loadData();
        setAddingTo(null);
        setSearchTerm('');
      } else {
        setError(response.error || 'Erro ao adicionar roadmap');
      }
    } catch (err) {
      setError(err.message || 'Erro ao adicionar roadmap');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveRoadmap = async (stageId, roadmapId) => {
    try {
      setSaving(true);
      setError('');
      await api.removeStageRoadmap(pipeline.id, stageId, roadmapId);
      await loadData();
    } catch (err) {
      setError(err.message || 'Erro ao remover roadmap');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result, stageId) => {
    if (!result.destination) return;

    const stage = stages.find(s => s.stage_id === stageId);
    if (!stage) return;

    const items = Array.from(stage.roadmaps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setStages(prev => prev.map(s =>
      s.stage_id === stageId ? { ...s, roadmaps: items } : s
    ));

    try {
      await api.reorderStageRoadmaps(pipeline.id, stageId,
        items.map((r, i) => ({ roadmap_id: r.roadmap_id, position: i }))
      );
    } catch (err) {
      console.error('Error reordering:', err);
      loadData();
    }
  };

  const getAvailableForStage = (stageId) => {
    const stage = stages.find(s => s.stage_id === stageId);
    const existingIds = stage?.roadmaps.map(r => r.roadmap_id) || [];
    return availableRoadmaps
      .filter(r => !existingIds.includes(r.id))
      .filter(r => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const resolveColor = (color) => {
    if (!color) return '#6366f1';
    if (color.startsWith('#')) return color;
    const map = {
      blue: '#3b82f6',
      purple: '#8b5cf6',
      emerald: '#10b981',
      green: '#22c55e',
      red: '#ef4444',
      yellow: '#eab308',
      orange: '#f97316',
      pink: '#ec4899',
      gray: '#6b7280',
      indigo: '#6366f1'
    };
    return map[color] || '#6366f1';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Map className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Roadmaps Automaticos
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pipeline.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Description */}
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30">
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Roadmaps vinculados serao executados automaticamente quando uma oportunidade for criada na etapa.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {stages.map(stage => (
                <div
                  key={stage.stage_id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* Stage Header */}
                  <button
                    onClick={() => toggleStage(stage.stage_id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: resolveColor(stage.stage_color) }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {stage.stage_name}
                      </span>
                      {stage.roadmaps.length > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                          {stage.roadmaps.length} roadmap{stage.roadmaps.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {expandedStages[stage.stage_id] ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {/* Stage Content */}
                  {expandedStages[stage.stage_id] && (
                    <div className="p-4 space-y-3">
                      {/* Roadmaps List */}
                      {stage.roadmaps.length > 0 ? (
                        <DragDropContext onDragEnd={(r) => handleDragEnd(r, stage.stage_id)}>
                          <Droppable droppableId={`stage-${stage.stage_id}`}>
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                {stage.roadmaps.map((roadmap, index) => (
                                  <Draggable
                                    key={roadmap.roadmap_id}
                                    draggableId={roadmap.roadmap_id}
                                    index={index}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg ${
                                          snapshot.isDragging ? 'shadow-lg' : ''
                                        }`}
                                      >
                                        <div {...provided.dragHandleProps} className="cursor-grab">
                                          <GripVertical className="w-4 h-4 text-gray-400" />
                                        </div>
                                        <Map className="w-4 h-4 text-purple-500" />
                                        <div className="flex-1">
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {roadmap.roadmap_name}
                                          </p>
                                          {roadmap.roadmap_description && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                              {roadmap.roadmap_description}
                                            </p>
                                          )}
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {roadmap.task_count} tarefa{roadmap.task_count !== 1 ? 's' : ''}
                                        </span>
                                        <button
                                          onClick={() => handleRemoveRoadmap(stage.stage_id, roadmap.roadmap_id)}
                                          disabled={saving}
                                          className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors disabled:opacity-50"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          Nenhum roadmap vinculado a esta etapa.
                        </p>
                      )}

                      {/* Add Roadmap */}
                      {addingTo === stage.stage_id ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              placeholder="Buscar roadmap..."
                              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {getAvailableForStage(stage.stage_id).map(roadmap => (
                              <button
                                key={roadmap.id}
                                onClick={() => handleAddRoadmap(stage.stage_id, roadmap.id)}
                                disabled={saving}
                                className="w-full flex items-center gap-3 p-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Map className="w-4 h-4 text-purple-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {roadmap.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {roadmap.task_count || 0} tarefas
                                  </p>
                                </div>
                                <Plus className="w-4 h-4 text-gray-400" />
                              </button>
                            ))}
                            {getAvailableForStage(stage.stage_id).length === 0 && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                                {searchTerm ? 'Nenhum roadmap encontrado' : 'Todos os roadmaps ja foram adicionados'}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => { setAddingTo(null); setSearchTerm(''); }}
                            className="mt-2 w-full text-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingTo(stage.stage_id)}
                          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar roadmap
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageRoadmapsModal;
