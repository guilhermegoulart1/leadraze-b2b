import React from 'react';
import {
  Phone,
  Video,
  Mail,
  MessageSquare,
  FileCheck,
  MoreHorizontal
} from 'lucide-react';

const TASK_TYPE_CONFIG = {
  call: { icon: Phone, color: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  meeting: { icon: Video, color: 'border-l-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  email: { icon: Mail, color: 'border-l-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  follow_up: { icon: MessageSquare, color: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  proposal: { icon: FileCheck, color: 'border-l-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  other: { icon: MoreHorizontal, color: 'border-l-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' }
};

const PRIORITY_COLORS = {
  low: 'bg-gray-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500'
};

const CalendarTaskCard = ({
  task,
  onClick,
  compact = false,
  showTime = true,
  isDragging = false,
  className = ''
}) => {
  const config = TASK_TYPE_CONFIG[task.taskType] || TASK_TYPE_CONFIG.other;
  const Icon = config.icon;
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderAvatar = (user) => {
    if (user?.avatarUrl) {
      return (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className="w-5 h-5 rounded-full object-cover"
        />
      );
    }
    return (
      <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-[10px] text-purple-600 dark:text-purple-400 font-medium">
        {user?.name?.charAt(0) || '?'}
      </div>
    );
  };

  if (compact) {
    // Ultra-compact version for month view
    return (
      <div
        onClick={() => onClick?.(task)}
        className={`
          px-1.5 py-0.5 text-xs rounded truncate cursor-pointer
          border-l-2 ${config.color} ${config.bg}
          hover:opacity-80 transition-opacity
          ${task.isCompleted ? 'opacity-50 line-through' : ''}
          ${isDragging ? 'shadow-lg scale-105' : ''}
          ${className}
        `}
        title={task.title}
      >
        <span className="truncate text-gray-700 dark:text-gray-100">{task.title}</span>
      </div>
    );
  }

  // Standard version for week view
  return (
    <div
      onClick={() => onClick?.(task)}
      className={`
        p-2 rounded-md cursor-pointer border-l-3
        ${config.color} ${config.bg}
        hover:shadow-md transition-all
        ${task.isCompleted ? 'opacity-50' : ''}
        ${isDragging ? 'shadow-lg scale-105 rotate-1' : ''}
        ${className}
      `}
    >
      {/* Header with time and priority */}
      <div className="flex items-center justify-between gap-1 mb-1">
        {showTime && task.dueDate && (
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            {formatTime(task.dueDate)}
          </span>
        )}
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${priorityColor}`} title={task.priority} />
          <Icon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {/* Title */}
      <p className={`text-xs font-medium text-gray-700 dark:text-gray-200 line-clamp-2 ${task.isCompleted ? 'line-through' : ''}`}>
        {task.title}
      </p>

      {/* Assignees */}
      {task.assignees && task.assignees.length > 0 && (
        <div className="flex items-center mt-1.5 -space-x-1">
          {task.assignees.slice(0, 2).map((user, idx) => (
            <div key={user.id} className="relative" style={{ zIndex: 2 - idx }} title={user.name}>
              {renderAvatar(user)}
            </div>
          ))}
          {task.assignees.length > 2 && (
            <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-[10px] text-gray-600 dark:text-gray-300">
              +{task.assignees.length - 2}
            </div>
          )}
        </div>
      )}

      {/* Opportunity name if available */}
      {task.opportunity?.title && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 truncate">
          {task.opportunity.title}
        </p>
      )}
    </div>
  );
};

export default CalendarTaskCard;
