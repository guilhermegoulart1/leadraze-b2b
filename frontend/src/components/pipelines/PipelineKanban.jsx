// frontend/src/components/pipelines/PipelineKanban.jsx
import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  User,
  Calendar,
  DollarSign,
  MoreHorizontal,
  Plus,
  Building2
} from 'lucide-react';
import api from '../../services/api';

const PipelineKanban = ({ pipeline, onOpportunityClick, onRefresh }) => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadKanban = useCallback(async () => {
    if (!pipeline?.id) return;

    try {
      setLoading(true);
      const response = await api.getOpportunitiesKanban(pipeline.id);
      if (response.success) {
        setStages(response.data.stages || []);
      }
    } catch (error) {
      console.error('Erro ao carregar kanban:', error);
    } finally {
      setLoading(false);
    }
  }, [pipeline?.id]);

  useEffect(() => {
    loadKanban();
  }, [loadKanban]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // Se não soltou em lugar válido
    if (!destination) return;

    // Se soltou no mesmo lugar
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Atualizar UI otimisticamente
    const sourceStageIndex = stages.findIndex(s => s.id === source.droppableId);
    const destStageIndex = stages.findIndex(s => s.id === destination.droppableId);

    if (sourceStageIndex === -1 || destStageIndex === -1) return;

    const newStages = [...stages];
    const [movedOpp] = newStages[sourceStageIndex].opportunities.splice(source.index, 1);

    // Adicionar na nova posição
    newStages[destStageIndex].opportunities.splice(destination.index, 0, movedOpp);

    // Atualizar contadores
    newStages[sourceStageIndex].count--;
    newStages[destStageIndex].count++;

    setStages(newStages);

    // Se mudou de stage, chamar API
    if (source.droppableId !== destination.droppableId) {
      try {
        await api.moveOpportunity(draggableId, destination.droppableId);
        // Recarregar para garantir sincronização
        onRefresh?.();
      } catch (error) {
        console.error('Erro ao mover oportunidade:', error);
        // Reverter em caso de erro
        loadKanban();
      }
    } else {
      // Apenas reordenar dentro do mesmo stage
      const orders = newStages[destStageIndex].opportunities.map((opp, index) => ({
        id: opp.id,
        order: index
      }));
      try {
        await api.reorderOpportunities(orders);
      } catch (error) {
        console.error('Erro ao reordenar:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-x-auto p-4 gap-4">
        {stages.map(stage => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            onOpportunityClick={onOpportunityClick}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

const KanbanColumn = ({ stage, onOpportunityClick }) => {
  const isWinStage = stage.is_win_stage;
  const isLossStage = stage.is_loss_stage;

  const headerColor = isWinStage
    ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
    : isLossStage
      ? 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800'
      : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  return (
    <div className="flex flex-col w-80 min-w-[320px] bg-gray-100 dark:bg-gray-800/50 rounded-xl">
      {/* Column Header */}
      <div className={`px-4 py-3 rounded-t-xl border-b ${headerColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color || '#6366f1' }}
            />
            <h3 className="font-medium text-gray-900 dark:text-white">
              {stage.name}
            </h3>
            <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {stage.count}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              maximumFractionDigits: 0
            }).format(stage.total_value || 0)}
          </span>
        </div>
      </div>

      {/* Cards Container */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 overflow-y-auto min-h-[200px] ${
              snapshot.isDraggingOver ? 'bg-purple-50 dark:bg-purple-900/20' : ''
            }`}
          >
            {stage.opportunities.map((opp, index) => (
              <Draggable key={opp.id} draggableId={opp.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`mb-2 ${snapshot.isDragging ? 'rotate-2' : ''}`}
                  >
                    <OpportunityCard
                      opportunity={opp}
                      onClick={() => onOpportunityClick(opp)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {stage.opportunities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <p className="text-sm">Nenhuma oportunidade</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
};

const OpportunityCard = ({ opportunity, onClick }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const formatDate = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short'
    });
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
          {opportunity.title}
        </h4>
      </div>

      {/* Contact Info */}
      <div className="flex items-center gap-2 mb-2">
        {opportunity.contact_picture ? (
          <img
            src={opportunity.contact_picture}
            alt={opportunity.contact_name}
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <User className="w-3 h-3 text-gray-500" />
          </div>
        )}
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
          {opportunity.contact_name}
        </span>
      </div>

      {/* Company */}
      {opportunity.contact_company && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Building2 className="w-3.5 h-3.5" />
          <span className="truncate">{opportunity.contact_company}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        {/* Value */}
        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <DollarSign className="w-3.5 h-3.5" />
          <span className="text-sm font-medium">{formatCurrency(opportunity.value)}</span>
        </div>

        {/* Expected Close Date */}
        {opportunity.expected_close_date && (
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span className="text-xs">{formatDate(opportunity.expected_close_date)}</span>
          </div>
        )}

        {/* Owner Avatar */}
        {opportunity.owner_avatar && (
          <img
            src={opportunity.owner_avatar}
            alt={opportunity.owner_name}
            className="w-5 h-5 rounded-full"
            title={opportunity.owner_name}
          />
        )}
      </div>
    </div>
  );
};

export default PipelineKanban;
