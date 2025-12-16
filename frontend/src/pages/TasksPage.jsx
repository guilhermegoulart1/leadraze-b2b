import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, RefreshCw, Calendar, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronRight, Filter, User, MoreHorizontal, Check, X, Link as LinkIcon,
  Loader, LayoutGrid, List, Phone, Video, Mail, MessageSquare, FileCheck
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../services/api';
import TaskModal from '../components/TaskModal';
import { useAuth } from '../contexts/AuthContext';

const TASK_TYPES = {
  call: { icon: Phone, labelKey: 'taskTypes.call' },
  meeting: { icon: Video, labelKey: 'taskTypes.meeting' },
  email: { icon: Mail, labelKey: 'taskTypes.email' },
  follow_up: { icon: MessageSquare, labelKey: 'taskTypes.follow_up' },
  proposal: { icon: FileCheck, labelKey: 'taskTypes.proposal' },
  other: { icon: MoreHorizontal, labelKey: 'taskTypes.other' }
};

const PRIORITY_CONFIG = {
  low: { labelKey: 'priority.low', color: 'text-gray-500 dark:text-gray-400', dotColor: 'bg-gray-400' },
  medium: { labelKey: 'priority.medium', color: 'text-yellow-600 dark:text-yellow-500', dotColor: 'bg-yellow-500' },
  high: { labelKey: 'priority.high', color: 'text-orange-600 dark:text-orange-500', dotColor: 'bg-orange-500' },
  urgent: { labelKey: 'priority.urgent', color: 'text-red-600 dark:text-red-500', dotColor: 'bg-red-500' }
};

const COLUMN_CONFIG = {
  overdue: { titleKey: 'columns.overdue', color: 'text-red-500', dotColor: 'bg-red-500' },
  today: { titleKey: 'columns.today', color: 'text-blue-500', dotColor: 'bg-blue-500' },
  tomorrow: { titleKey: 'columns.tomorrow', color: 'text-purple-500', dotColor: 'bg-purple-500' },
  this_week: { titleKey: 'columns.this_week', color: 'text-indigo-500', dotColor: 'bg-indigo-500' },
  next_week: { titleKey: 'columns.next_week', color: 'text-cyan-500', dotColor: 'bg-cyan-500' },
  later: { titleKey: 'columns.later', color: 'text-gray-500 dark:text-gray-400', dotColor: 'bg-gray-400' },
  no_date: { titleKey: 'columns.no_date', color: 'text-gray-400', dotColor: 'bg-gray-300' }
};

const STATUS_COLUMN_CONFIG = {
  pending: { titleKey: 'status.pending', color: 'text-amber-500', dotColor: 'bg-amber-500' },
  in_progress: { titleKey: 'status.in_progress', color: 'text-blue-500', dotColor: 'bg-blue-500' },
  completed: { titleKey: 'status.completed', color: 'text-green-500', dotColor: 'bg-green-500' }
};

const TasksPage = () => {
  const { t, i18n } = useTranslation('tasks');
  const { user } = useAuth();
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode] = useState('board'); // board or list
  const [groupBy, setGroupBy] = useState('due_date'); // due_date or status
  const [filters, setFilters] = useState({
    assigned_to: '',
    lead_id: '',
    status: 'open', // '', 'open', 'completed'
    period: '30days' // '7days', '15days', '30days', '90days', 'all'
  });
  const [users, setUsers] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  useEffect(() => {
    setTasks({});  // Clear tasks to show spinner during view switch
    loadData();
  }, [groupBy, filters.assigned_to, filters.lead_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const apiFilters = {
        assigned_to: filters.assigned_to,
        lead_id: filters.lead_id
      };
      const [boardResponse, usersResponse] = await Promise.all([
        api.getTasksBoard({ group_by: groupBy, ...apiFilters }),
        api.getAssignableUsers()
      ]);

      setTasks(boardResponse.data?.grouped || {});
      setUsers(usersResponse.data?.users || []);
      setError('');
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setShowTaskModal(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleCompleteTask = async (taskId, e) => {
    e?.stopPropagation();
    try {
      // Optimistic update - remove task from UI immediately
      setTasks(prev => {
        const updated = {};
        Object.keys(prev).forEach(key => {
          updated[key] = prev[key].map(task =>
            task.id === taskId
              ? { ...task, status: 'completed', completedAt: new Date().toISOString() }
              : task
          );
        });
        return updated;
      });

      // Then update on server
      await api.completeTask(taskId);

      // Reload to sync with server and reorganize groups
      loadData();
    } catch (error) {
      console.error('Error completing task:', error);
      // Reload to restore correct state
      loadData();
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    e?.stopPropagation();
    if (!confirm(t('confirmDelete'))) return;
    try {
      // Optimistic update - remove task from UI immediately
      setTasks(prev => {
        const updated = {};
        Object.keys(prev).forEach(key => {
          updated[key] = prev[key].filter(task => task.id !== taskId);
        });
        return updated;
      });

      // Then delete on server
      await api.deleteTask(taskId);

      // Reload to sync with server
      loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
      // Reload to restore correct state
      loadData();
    }
  };

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const getLocale = () => i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Selection functions
  const toggleTaskSelection = (taskId, e) => {
    e.stopPropagation();
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleBulkComplete = async () => {
    try {
      await Promise.all(
        selectedTaskIds.map(taskId => api.completeTask(taskId))
      );
      setSelectedTaskIds([]);
      loadData();
    } catch (error) {
      console.error('Error completing tasks:', error);
      loadData();
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('confirmBulkDelete', { count: selectedTaskIds.length }))) return;

    try {
      await Promise.all(
        selectedTaskIds.map(taskId => api.deleteTask(taskId))
      );
      setSelectedTaskIds([]);
      loadData();
    } catch (error) {
      console.error('Error deleting tasks:', error);
      loadData();
    }
  };

  // Drag & Drop handler
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    // Dropped outside or no movement
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const taskId = draggableId.replace('task-', '');
    const sourceColumn = source.droppableId;
    const destColumn = destination.droppableId;

    // Helper to get local date string
    const getLocalDate = (daysToAdd = 0) => {
      const date = new Date();
      date.setDate(date.getDate() + daysToAdd);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      // Add T12:00 to ensure the date stays correct after timezone conversion
      return `${year}-${month}-${day}T12:00`;
    };

    // Date mapping for columns
    const dueDateMap = {
      overdue: getLocalDate(-1), // Yesterday (D-1)
      today: getLocalDate(0),
      tomorrow: getLocalDate(1),
      this_week: getLocalDate(3), // 3 days from now
      next_week: getLocalDate(7), // 1 week from now
      later: getLocalDate(30), // 30 days from now (future tasks)
      no_date: null
    };

    // Find the task
    let movedTask = null;
    for (const key of Object.keys(tasks)) {
      const found = tasks[key]?.find(t => t.id === taskId);
      if (found) {
        movedTask = found;
        break;
      }
    }
    if (!movedTask) return;

    // Calculate new values for optimistic update
    const newDueDate = groupBy === 'due_date' ? dueDateMap[destColumn] : movedTask.dueDate;
    const newStatus = groupBy === 'status' ? destColumn : movedTask.status;

    // Create updated task with new values
    const updatedTask = {
      ...movedTask,
      dueDate: newDueDate,
      status: newStatus
    };

    // Optimistic update - move task between columns with updated data
    setTasks(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        updated[key] = prev[key].filter(t => t.id !== taskId);
      });
      // Add to destination column with updated task
      if (!updated[destColumn]) updated[destColumn] = [];
      const destTasks = [...updated[destColumn]];
      destTasks.splice(destination.index, 0, updatedTask);
      updated[destColumn] = destTasks;
      return updated;
    });

    // Update on backend (fire-and-forget, optimistic update already applied)
    const updateBackend = async () => {
      try {
        if (groupBy === 'status') {
          await api.updateTaskStatus(taskId, destColumn);
        } else {
          if (newDueDate !== undefined) {
            await api.updateTask(taskId, { due_date: newDueDate });
          }
        }
        // Success - no need to reload, optimistic update is already correct
      } catch (error) {
        console.error('Error moving task:', error);
        // Only reload on error to restore correct state
        loadData();
      }
    };

    // Fire and forget - don't block UI
    updateBackend();
  };

  // Board View Card (styled like LeadCard)
  const TaskCard = ({ task, index, provided, snapshot }) => {
    const isCompleted = task.status === 'completed';
    const taskType = TASK_TYPES[task.taskType] || TASK_TYPES.other;
    const TaskTypeIcon = taskType.icon;
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const isSelected = selectedTaskIds.includes(task.id);

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className={`bg-white dark:bg-gray-800 rounded-lg border p-3 cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md transition-all w-full max-w-full overflow-hidden box-border relative ${
          isSelected
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10'
            : isCompleted
              ? 'opacity-50 border-gray-200 dark:border-gray-700'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:border-gray-600'
        } ${snapshot.isDragging ? 'shadow-xl ring-2 ring-purple-400' : ''}`}
        onClick={() => handleEditTask(task)}
      >
        {/* Action buttons - absolute positioned on hover */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {!isCompleted && (
            <button
              onClick={(e) => handleCompleteTask(task.id, e)}
              className="p-1 bg-white dark:bg-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded shadow-sm flex-shrink-0"
              title={t('buttons.complete')}
            >
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            </button>
          )}
          <button
            onClick={(e) => handleDeleteTask(task.id, e)}
            className="p-1 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded shadow-sm flex-shrink-0"
            title={t('buttons.delete')}
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>

        <div className="flex items-start gap-2 w-full min-w-0">
          {/* Selection Checkbox */}
          <button
            onClick={(e) => toggleTaskSelection(task.id, e)}
            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border ${
              isSelected
                ? 'bg-purple-600 border-purple-600 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
            } flex items-center justify-center transition-colors`}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Lead name - small reference at top */}
            {task.lead && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mb-0.5 pr-10">
                {task.lead.name}
              </p>
            )}

            {/* Title - smaller font, wraps to 2 lines */}
            <h4 className={`text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-relaxed pr-10 ${isCompleted ? 'line-through' : ''}`}>
              {task.title}
            </h4>

            {/* Footer: Type Icon, Priority, Due Date on left - Assignee on right */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                {/* Task Type Icon */}
                <TaskTypeIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" title={t(taskType.labelKey)} />
                {/* Priority with colored dot */}
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${priority.dotColor}`}></div>
                  <span className={`text-xs font-medium ${priority.color}`}>
                    {t(priority.labelKey)}
                  </span>
                </div>

                {/* Due Date with calendar icon */}
                {task.dueDate && (
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span className="text-xs">
                      {formatDate(task.dueDate)}
                    </span>
                  </div>
                )}
              </div>

              {/* Assignees Avatars - stacked, positioned to the far right */}
              {(task.assignees?.length > 0 || task.assignedTo) && (
                <div className="flex items-center flex-shrink-0 -space-x-2">
                  {(task.assignees || (task.assignedTo ? [task.assignedTo] : [])).slice(0, 3).map((assignee, idx) => (
                    <div key={assignee.id || idx} title={assignee.name} style={{ zIndex: 10 - idx }}>
                      {assignee.avatarUrl ? (
                        <img
                          src={
                            assignee.avatarUrl.startsWith('http')
                              ? `${assignee.avatarUrl}?v=${assignee.updatedAt || Date.now()}`
                              : assignee.avatarUrl
                          }
                          alt=""
                          className="w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 border-2 border-white dark:border-gray-800 flex items-center justify-center">
                          <span className="text-[8px] font-medium text-purple-600 dark:text-purple-400">
                            {(() => {
                              const names = (assignee.name || '').trim().split(' ').filter(n => n.length > 0);
                              if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                              return (names[0][0] + names[1][0]).toUpperCase();
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {(task.assignees?.length || 0) > 3 && (
                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-800 flex items-center justify-center" style={{ zIndex: 7 }}>
                      <span className="text-[8px] font-medium text-gray-600 dark:text-gray-300">
                        +{task.assignees.length - 3}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Board Column (styled like LeadsPage pipeline)
  const BoardColumn = ({ columnKey, columnTasks, config }) => {
    const count = columnTasks?.length || 0;

    return (
      <div className="w-[260px] flex-shrink-0 flex flex-col h-full">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">{t(config.titleKey)}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400`}>
              {count}
            </span>
          </div>
          <button
            onClick={handleCreateTask}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </button>
        </div>

        {/* Column Content - Droppable */}
        <Droppable droppableId={columnKey}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`flex-1 rounded-lg p-2 transition-colors min-h-[400px] ${
                snapshot.isDraggingOver ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-gray-50 dark:bg-gray-900'
              }`}
            >
              {count === 0 ? (
                <div className={`flex items-center justify-center h-32 text-sm border-2 border-dashed rounded-lg ${
                  snapshot.isDraggingOver
                    ? 'border-purple-400 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                }`}>
                  {snapshot.isDraggingOver ? t('dragDrop.dropHere') : t('dragDrop.noTasks')}
                </div>
              ) : (
                <div className="space-y-2 w-full overflow-hidden">
                  {columnTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={`task-${task.id}`} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <TaskCard
                          task={task}
                          index={index}
                          provided={dragProvided}
                          snapshot={dragSnapshot}
                        />
                      )}
                    </Draggable>
                  ))}
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  };

  // List View Row
  const TaskRow = ({ task }) => {
    const isCompleted = task.status === 'completed';
    const taskType = TASK_TYPES[task.taskType] || TASK_TYPES.other;
    const TaskTypeIcon = taskType.icon;
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

    return (
      <div
        className={`flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group ${
          isCompleted ? 'opacity-50' : ''
        }`}
        onClick={() => handleEditTask(task)}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => handleCompleteTask(task.id, e)}
          className={`flex-shrink-0 w-4 h-4 rounded border ${
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          } flex items-center justify-center`}
        >
          {isCompleted && <Check className="w-3 h-3" />}
        </button>

        {/* Task Type Icon */}
        <TaskTypeIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm text-gray-900 dark:text-gray-100 ${isCompleted ? 'line-through' : ''}`}>
            {task.title}
          </span>
        </div>

        {/* Lead/Lista */}
        <div className="w-32 flex-shrink-0">
          {task.lead ? (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate block">
              {task.lead.name}
            </span>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">-</span>
          )}
        </div>

        {/* Due Date (Previsto) */}
        <div className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {formatDate(task.dueDate)}
        </div>

        {/* Completed Date (Conclusao) */}
        <div className="w-24 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
          {task.completedAt ? formatDate(task.completedAt) : '-'}
        </div>

        {/* Priority */}
        <div className="w-20 flex-shrink-0">
          <span className={`text-xs ${priority.color}`}>
            {t(priority.labelKey)}
          </span>
        </div>

        {/* Assignee */}
        <div className="w-24 flex-shrink-0">
          {task.assignedTo ? (
            <div className="flex items-center gap-2" title={task.assignedTo.name}>
              {task.assignedTo.avatarUrl ? (
                <img
                  src={
                    task.assignedTo.avatarUrl.startsWith('http')
                      ? `${task.assignedTo.avatarUrl}?v=${task.assignedTo.updatedAt || Date.now()}`
                      : task.assignedTo.avatarUrl
                  }
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {(() => {
                      const names = (task.assignedTo.name || '').trim().split(' ').filter(n => n.length > 0);
                      if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                      return (names[0][0] + names[1][0]).toUpperCase();
                    })()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">-</span>
          )}
        </div>

        {/* Actions */}
        <div className="w-16 flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCompleted && (
            <button
              onClick={(e) => handleCompleteTask(task.id, e)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 rounded"
              title={t('buttons.complete')}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => handleDeleteTask(task.id, e)}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 rounded"
            title={t('buttons.delete')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // List View Group
  const ListGroup = ({ groupKey, groupTasks, config }) => {
    const isCollapsed = collapsedGroups[groupKey];
    const count = groupTasks?.length || 0;

    return (
      <div className="mb-1">
        {/* Group Header */}
        <div
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-800"
          onClick={() => toggleGroup(groupKey)}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
          <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-300">{t(config.titleKey)}</span>
          <span className="text-xs text-gray-400 ml-1">{count}</span>
        </div>

        {/* Group Tasks */}
        {!isCollapsed && count > 0 && (
          <div>
            {groupTasks.map(task => <TaskRow key={task.id} task={task} />)}
          </div>
        )}
      </div>
    );
  };

  // Filter tasks by status
  const filterTasksByStatus = (taskList) => {
    if (!taskList) return [];
    if (!filters.status) return taskList;

    if (filters.status === 'open') {
      return taskList.filter(t => t.status !== 'completed');
    } else if (filters.status === 'completed') {
      return taskList.filter(t => t.status === 'completed');
    }
    return taskList;
  };

  // Filter tasks by period (based on due_date or created_at)
  const filterTasksByPeriod = (taskList, isOverdueColumn = false) => {
    if (!taskList) return [];
    // Always show all tasks in overdue column
    if (isOverdueColumn) return taskList;
    // Show all if period filter is 'all'
    if (filters.period === 'all') return taskList;

    const now = new Date();
    const periodDays = { '7days': 7, '15days': 15, '30days': 30, '90days': 90 };
    const daysToFilter = periodDays[filters.period] || 30;
    const cutoffDate = new Date(now.getTime() - daysToFilter * 24 * 60 * 60 * 1000);

    return taskList.filter(task => {
      // Check due_date first, fallback to created_at
      const dateToCheck = task.dueDate || task.createdAt;
      if (!dateToCheck) return true; // No date? Include it
      const taskDate = new Date(dateToCheck);
      return taskDate >= cutoffDate;
    });
  };

  // Combined filter (status + period)
  const filterTasks = (taskList, columnKey) => {
    const isOverdue = columnKey === 'overdue';
    let filtered = filterTasksByPeriod(taskList, isOverdue);
    filtered = filterTasksByStatus(filtered);
    return filtered;
  };

  // Get columns based on groupBy
  const getColumns = () => {
    if (groupBy === 'due_date') {
      return [
        { key: 'overdue', config: COLUMN_CONFIG.overdue, tasks: filterTasks(tasks.overdue, 'overdue') },
        { key: 'today', config: COLUMN_CONFIG.today, tasks: filterTasks(tasks.today, 'today') },
        { key: 'tomorrow', config: COLUMN_CONFIG.tomorrow, tasks: filterTasks(tasks.tomorrow, 'tomorrow') },
        { key: 'this_week', config: COLUMN_CONFIG.this_week, tasks: filterTasks(tasks.this_week, 'this_week') },
        { key: 'next_week', config: COLUMN_CONFIG.next_week, tasks: filterTasks(tasks.next_week, 'next_week') },
        { key: 'later', config: COLUMN_CONFIG.later, tasks: filterTasks(tasks.later, 'later') },
        { key: 'no_date', config: COLUMN_CONFIG.no_date, tasks: filterTasks(tasks.no_date, 'no_date') }
      ];
    } else {
      return [
        { key: 'pending', config: STATUS_COLUMN_CONFIG.pending, tasks: filterTasks(tasks.pending, 'pending') },
        { key: 'in_progress', config: STATUS_COLUMN_CONFIG.in_progress, tasks: filterTasks(tasks.in_progress, 'in_progress') },
        { key: 'completed', config: STATUS_COLUMN_CONFIG.completed, tasks: filterTasks(tasks.completed, 'completed') }
      ];
    }
  };

  const columns = getColumns();

  if (loading && Object.keys(tasks).length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        {/* Filters and Controls Row */}
        <div className="flex items-center gap-2">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filters.status === '' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
              }`}
            >
              {t('filters.all')}
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'open' }))}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filters.status === 'open' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
              }`}
            >
              {t('filters.open')}
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'completed' }))}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filters.status === 'completed' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
              }`}
            >
              {t('filters.completed')}
            </button>
          </div>

          {/* Period Filter */}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <select
              value={filters.period}
              onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
              className="text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="7days">{t('periods.days7')}</option>
              <option value="15days">{t('periods.days15')}</option>
              <option value="30days">{t('periods.days30')}</option>
              <option value="90days">{t('periods.days90')}</option>
              <option value="all">{t('periods.all')}</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            <select
              value={filters.assigned_to}
              onChange={(e) => setFilters(prev => ({ ...prev, assigned_to: e.target.value }))}
              className="text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">{t('filters.allUsers')}</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Group By */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            <button
              onClick={() => setGroupBy('due_date')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                groupBy === 'due_date' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
              }`}
            >
              {t('groupBy.date')}
            </button>
            <button
              onClick={() => setGroupBy('status')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                groupBy === 'status' ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300'
              }`}
            >
              {t('groupBy.status')}
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300'}`}
              title={t('viewMode.list')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1 rounded ${viewMode === 'board' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300'}`}
              title={t('viewMode.board')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('buttons.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleCreateTask}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('buttons.newTask')}
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="mx-6 mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
              {selectedTaskIds.length === 1 ? t('bulk.selected', { count: selectedTaskIds.length }) : t('bulk.selectedPlural', { count: selectedTaskIds.length })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkComplete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {t('buttons.completeAll')}
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              {t('buttons.deleteAll')}
            </button>
            <button
              onClick={() => setSelectedTaskIds([])}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {t('buttons.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'board' ? (
          /* Board View */
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full px-6 py-4 overflow-auto">
              <div className="flex gap-4 h-full min-w-max">
                {columns.map(col => (
                  <BoardColumn
                    key={col.key}
                    columnKey={col.key}
                    columnTasks={col.tasks}
                    config={col.config}
                  />
                ))}
              </div>
            </div>
          </DragDropContext>
        ) : (
          /* List View */
          <div className="h-full overflow-y-auto">
            {/* List Header */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0">
              <div className="w-4" /> {/* Checkbox space */}
              <div className="w-4" /> {/* Icon space */}
              <div className="flex-1">{t('listHeaders.name')}</div>
              <div className="w-32">{t('listHeaders.lead')}</div>
              <div className="w-24">{t('listHeaders.dueDate')}</div>
              <div className="w-24">{t('listHeaders.completed')}</div>
              <div className="w-20">{t('listHeaders.priority')}</div>
              <div className="w-24">{t('listHeaders.assignee')}</div>
              <div className="w-16" /> {/* Actions space */}
            </div>

            {/* List Groups */}
            <div>
              {columns.map(col => (
                <ListGroup
                  key={col.key}
                  groupKey={col.key}
                  groupTasks={col.tasks}
                  config={col.config}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onSave={loadData}
      />
    </div>
  );
};

export default TasksPage;
