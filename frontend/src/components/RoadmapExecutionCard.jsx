// frontend/src/components/RoadmapExecutionCard.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  CheckCircle, Loader, Eye
} from 'lucide-react';
import api from '../services/api';

// Avatar component with fallback to initials
const UserAvatar = ({ user, size = 'sm' }) => {
  const sizeClasses = size === 'sm' ? 'w-4 h-4 text-[8px]' : 'w-5 h-5 text-[10px]';
  const name = user?.user_name || user?.name || 'U';
  const avatarUrl = user?.avatar_url || user?.avatar;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover`}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
};

const RoadmapExecutionCard = ({
  execution,
  onTaskToggle,
  onViewDetails,
  defaultExpanded = false
}) => {
  const { t, i18n } = useTranslation('settings');
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [togglingTask, setTogglingTask] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  // Helper to get locale for date formatting
  const getLocale = () => i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';

  // Format date for display (Mattermost style)
  const formatDueDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    const hours = Math.round(diff / (1000 * 60 * 60));
    const days = Math.round(diff / (1000 * 60 * 60 * 24));

    // Check if overdue
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

  // Handle task toggle
  const handleTaskToggle = async (taskId, currentStatus) => {
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

  const tasks = execution.tasks || [];
  const completedTasks = execution.completed_tasks || 0;
  const totalTasks = execution.total_tasks || tasks.length;
  const isCompleted = execution.status === 'completed';
  const isCancelled = execution.status === 'cancelled';

  // Calculate progress percentage
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div
      className={`overflow-hidden transition-colors ${
        isCancelled ? 'opacity-60' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header - Compact style */}
      <div className="w-full py-1 flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded transition-colors">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <ChevronRight className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />

          <div className="flex-1 min-w-0 text-left">
            {/* Title row */}
            <div className="flex items-center gap-1.5">
              <span className={`font-medium text-xs text-gray-900 dark:text-gray-100 truncate ${
                isCompleted ? 'line-through text-gray-500 dark:text-gray-400' : ''
              }`}>
                {execution.roadmap_name}
              </span>
              {isCompleted && (
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              )}
              {isCancelled && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  ({t('roadmaps.progress.cancelled', 'Cancelado')})
                </span>
              )}
            </div>

            {/* Progress bar row */}
            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isCompleted
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap">
                {completedTasks} / {totalTasks} {t('roadmaps.execution.done', 'feitas')}
              </span>
            </div>
          </div>
        </button>

        {/* View details button on hover */}
        {isHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(execution);
            }}
            className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex-shrink-0"
            title={t('roadmaps.execution.viewDetails', 'Ver Detalhes')}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="ml-4 mt-0.5">
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {tasks
              .sort((a, b) => a.position - b.position)
              .map((task) => {
                const isTaskCompleted = task.is_completed || task.status === 'completed';
                const dueInfo = task.due_date ? formatDueDate(task.due_date) : null;

                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 py-1 rounded transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isCancelled) {
                          handleTaskToggle(task.id, task.status);
                        }
                      }}
                      disabled={togglingTask === task.id || isCancelled}
                      className={`flex-shrink-0 ${
                        isCancelled ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {togglingTask === task.id ? (
                        <Loader className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : isTaskCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-400 transition-colors" />
                      )}
                    </button>

                    {/* Task title */}
                    <span className={`flex-1 text-xs leading-tight truncate ${
                      isTaskCompleted
                        ? 'text-gray-400 dark:text-gray-500 line-through'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {task.title || t('roadmaps.execution.untitledTask', 'Tarefa sem título')}
                    </span>

                    {/* Assignee avatar */}
                    {task.assignees?.length > 0 && (
                      <div className="flex items-center -space-x-1 flex-shrink-0">
                        <UserAvatar user={task.assignees[0]} size="sm" />
                        {task.assignees.length > 1 && (
                          <span className="text-[10px] text-gray-400 pl-1.5">+{task.assignees.length - 1}</span>
                        )}
                      </div>
                    )}

                    {/* Due date */}
                    {dueInfo && !isTaskCompleted && (
                      <span className={`text-[10px] flex-shrink-0 ${
                        dueInfo.isOverdue
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        {dueInfo.text}
                      </span>
                    )}

                    {/* Completed indicator */}
                    {isTaskCompleted && task.completed_at && (
                      <span className="text-[10px] text-green-500 flex-shrink-0">
                        {new Date(task.completed_at).toLocaleDateString(getLocale(), {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoadmapExecutionCard;
