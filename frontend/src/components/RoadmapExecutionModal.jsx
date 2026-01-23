// frontend/src/components/RoadmapExecutionModal.jsx
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Map as MapIcon, Calendar, CheckCircle, Loader, User,
  Clock, AlertTriangle, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import api from '../services/api';

// Avatar component with fallback to initials
const UserAvatar = ({ user, size = 'md' }) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm'
  };
  const name = user?.user_name || user?.name || 'U';
  const avatarUrl = user?.avatar_url || user?.avatar;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 border-white dark:border-gray-800`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium border-2 border-white dark:border-gray-800`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

const RoadmapExecutionModal = ({
  execution,
  isOpen,
  onClose,
  onTaskToggle,
  onCancel
}) => {
  const { t, i18n } = useTranslation('settings');
  const [togglingTask, setTogglingTask] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);

  const getLocale = () => i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';

  // Get tasks safely (even if execution is null)
  const tasks = execution?.tasks || [];

  // Get unique participants from all tasks - MUST be before conditional return
  const participants = useMemo(() => {
    const participantMap = new Map();
    tasks.forEach(task => {
      (task.assignees || []).forEach(assignee => {
        if (!participantMap.has(assignee.user_id)) {
          participantMap.set(assignee.user_id, assignee);
        }
      });
    });
    return Array.from(participantMap.values());
  }, [tasks]);

  // Calculate next due task - MUST be before conditional return
  const nextDueTask = useMemo(() => {
    const pendingTasks = tasks
      .filter(t => !t.is_completed && t.due_date)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return pendingTasks[0];
  }, [tasks]);

  // Early return AFTER all hooks
  if (!isOpen || !execution) return null;

  // Format date for display
  const formatDueDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    const hours = Math.round(diff / (1000 * 60 * 60));
    const days = Math.round(diff / (1000 * 60 * 60 * 24));

    if (diff < 0) {
      const overdueDays = Math.abs(days);
      if (overdueDays === 0) {
        return { text: t('roadmaps.execution.overdueToday', 'Atrasado'), isOverdue: true };
      }
      return {
        text: t('roadmaps.execution.overdueDays', 'Atrasado {{count}}d').replace('{{count}}', overdueDays),
        isOverdue: true
      };
    }

    if (hours < 1) {
      return { text: t('roadmaps.execution.now', 'Agora'), isOverdue: false };
    } else if (hours < 24) {
      return { text: t('roadmaps.execution.inHours', 'Em {{count}}h').replace('{{count}}', hours), isOverdue: false };
    } else if (days === 1) {
      return { text: t('roadmaps.execution.tomorrow', 'Amanhã'), isOverdue: false };
    } else {
      return { text: t('roadmaps.execution.inDays', 'Em {{count}} dias').replace('{{count}}', days), isOverdue: false };
    }
  };

  const formatFullDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(getLocale(), {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handle task toggle
  const handleTaskToggle = async (taskId) => {
    setTogglingTask(taskId);
    try {
      const response = await api.toggleRoadmapExecutionTask(taskId);
      if (response.success) {
        onTaskToggle?.(execution.id, taskId, response.data.task);
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    } finally {
      setTogglingTask(null);
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!window.confirm(t('roadmaps.execution.confirmCancel', 'Tem certeza que deseja cancelar este roadmap?'))) {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await api.cancelRoadmapExecution(execution.id);
      if (response.success) {
        onCancel?.(execution.id);
        onClose();
      }
    } catch (error) {
      console.error('Error cancelling execution:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const completedTasks = execution.completed_tasks || tasks.filter(t => t.is_completed).length;
  const totalTasks = execution.total_tasks || tasks.length;
  const isCompleted = execution.status === 'completed';
  const isCancelled = execution.status === 'cancelled';

  // Get owner (who started the execution)
  const owner = {
    name: execution.started_by_name,
    avatar_url: execution.started_by_avatar
  };

  const nextDueInfo = nextDueTask ? formatDueDate(nextDueTask.due_date) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isCompleted
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-blue-100 dark:bg-blue-900/30'
            }`}>
              <MapIcon className={`w-5 h-5 ${
                isCompleted
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-blue-600 dark:text-blue-400'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {execution.roadmap_name}
              </h2>
              {execution.roadmap_snapshot?.roadmap?.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {execution.roadmap_snapshot.roadmap.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Owner and Participants */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-8">
            {/* Owner */}
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {t('roadmaps.execution.owner', 'Responsável')}
              </p>
              <div className="flex items-center gap-2">
                <UserAvatar user={owner} size="md" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {owner.name || t('roadmaps.execution.unknown', 'Desconhecido')}
                </span>
              </div>
            </div>

            {/* Participants */}
            {participants.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t('roadmaps.execution.participants', 'Participantes')}
                </p>
                <div className="flex items-center">
                  <div className="flex -space-x-2">
                    {participants.slice(0, 5).map((participant, idx) => (
                      <UserAvatar key={participant.user_id || idx} user={participant} size="md" />
                    ))}
                  </div>
                  {participants.length > 5 && (
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                      +{participants.length - 5}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Next Due / Progress Card */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className={`flex items-center justify-between p-4 rounded-xl ${
            isCompleted
              ? 'bg-green-50 dark:bg-green-900/20'
              : nextDueInfo?.isOverdue
                ? 'bg-red-50 dark:bg-red-900/20'
                : 'bg-gray-50 dark:bg-gray-700/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                isCompleted
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : nextDueInfo?.isOverdue
                    ? 'bg-red-100 dark:bg-red-900/30'
                    : 'bg-blue-100 dark:bg-blue-900/30'
              }`}>
                {isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : nextDueInfo?.isOverdue ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : (
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${
                  isCompleted
                    ? 'text-green-700 dark:text-green-300'
                    : nextDueInfo?.isOverdue
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {isCompleted
                    ? t('roadmaps.execution.completed', 'Concluído')
                    : nextDueInfo
                      ? t('roadmaps.execution.nextTaskDue', 'Próxima tarefa')
                      : t('roadmaps.execution.noTasksDue', 'Sem tarefas pendentes')
                  }
                </p>
                <p className={`text-xs ${
                  isCompleted
                    ? 'text-green-600 dark:text-green-400'
                    : nextDueInfo?.isOverdue
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {isCompleted
                    ? execution.completed_at && new Date(execution.completed_at).toLocaleDateString(getLocale())
                    : nextDueInfo?.text || ''
                  }
                </p>
              </div>
            </div>

            {/* Progress badge */}
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {completedTasks}/{totalTasks}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('roadmaps.execution.tasksCompleted', 'concluídas')}
              </p>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Section Header */}
          <button
            onClick={() => setIsTasksExpanded(!isTasksExpanded)}
            className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isTasksExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t('roadmaps.execution.tasks', 'Tarefas')}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {completedTasks} / {totalTasks} {t('roadmaps.execution.done', 'concluídas')}
            </span>
          </button>

          {/* Tasks List */}
          {isTasksExpanded && (
            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <div className="space-y-1">
                {tasks
                  .sort((a, b) => a.position - b.position)
                  .map((task) => {
                    const isTaskCompleted = task.is_completed || task.status === 'completed';
                    const dueInfo = task.due_date ? formatDueDate(task.due_date) : null;

                    return (
                      <div
                        key={task.id}
                        className={`group flex items-start gap-3 p-3 rounded-lg transition-colors ${
                          isTaskCompleted
                            ? 'bg-gray-50 dark:bg-gray-700/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => !isCancelled && handleTaskToggle(task.id)}
                          disabled={togglingTask === task.id || isCancelled}
                          className={`flex-shrink-0 mt-0.5 ${
                            isCancelled ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          {togglingTask === task.id ? (
                            <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : isTaskCompleted ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-500 group-hover:border-blue-400 dark:group-hover:border-blue-400 transition-colors" />
                          )}
                        </button>

                        {/* Task content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            isTaskCompleted
                              ? 'text-gray-400 dark:text-gray-500 line-through'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {task.title}
                          </p>

                          {task.content && task.content !== task.title && (
                            <p className={`text-xs mt-0.5 ${
                              isTaskCompleted
                                ? 'text-gray-400 dark:text-gray-500'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {task.content}
                            </p>
                          )}

                          {/* Task meta */}
                          <div className="flex items-center gap-3 mt-2">
                            {/* Assignees */}
                            {task.assignees?.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="flex -space-x-1">
                                  {task.assignees.slice(0, 2).map((assignee, idx) => (
                                    <UserAvatar key={idx} user={assignee} size="xs" />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {task.assignees[0].user_name || task.assignees[0].name}
                                  {task.assignees.length > 1 && ` +${task.assignees.length - 1}`}
                                </span>
                              </div>
                            )}

                            {/* Due date */}
                            {dueInfo && !isTaskCompleted && (
                              <div className={`flex items-center gap-1 text-xs ${
                                dueInfo.isOverdue
                                  ? 'text-red-500 dark:text-red-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                <Clock className="w-3 h-3" />
                                <span>{formatFullDate(task.due_date)}</span>
                              </div>
                            )}

                            {/* Completed date */}
                            {isTaskCompleted && task.completed_at && (
                              <div className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                <span>{formatFullDate(task.completed_at)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isCompleted && !isCancelled && (
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
            >
              {isCancelling ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {t('roadmaps.execution.cancelRoadmap', 'Cancelar Roadmap')}
            </button>
          </div>
        )}

        {/* Completed/Cancelled status */}
        {isCancelled && (
          <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <X className="w-4 h-4" />
              <span>
                {t('roadmaps.execution.cancelledStatus', 'Roadmap cancelado')}
                {execution.cancelled_reason && `: ${execution.cancelled_reason}`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoadmapExecutionModal;
