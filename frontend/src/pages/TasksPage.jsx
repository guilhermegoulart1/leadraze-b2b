import React, { useState, useEffect } from 'react';
import {
  Plus, RefreshCw, Calendar, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ChevronRight, Filter, User, MoreHorizontal, Check, X, Link as LinkIcon,
  Loader, LayoutGrid, List, Phone, Video, Mail, MessageSquare, FileCheck
} from 'lucide-react';
import api from '../services/api';
import TaskModal from '../components/TaskModal';
import { useAuth } from '../contexts/AuthContext';

const TASK_TYPES = {
  call: { icon: Phone, label: 'Ligacao' },
  meeting: { icon: Video, label: 'Reuniao' },
  email: { icon: Mail, label: 'Email' },
  follow_up: { icon: MessageSquare, label: 'Follow-up' },
  proposal: { icon: FileCheck, label: 'Proposta' },
  other: { icon: MoreHorizontal, label: 'Outro' }
};

const PRIORITY_CONFIG = {
  low: { label: 'Baixa', color: 'text-gray-500' },
  medium: { label: 'Media', color: 'text-gray-600' },
  high: { label: 'Alta', color: 'text-orange-500' },
  urgent: { label: 'Urgente', color: 'text-red-500' }
};

const COLUMN_CONFIG = {
  overdue: { title: 'Atrasadas', color: 'text-red-500', dotColor: 'bg-red-500' },
  today: { title: 'Hoje', color: 'text-blue-500', dotColor: 'bg-blue-500' },
  tomorrow: { title: 'Amanha', color: 'text-purple-500', dotColor: 'bg-purple-500' },
  this_week: { title: 'Esta Semana', color: 'text-indigo-500', dotColor: 'bg-indigo-500' },
  next_week: { title: 'Proxima Semana', color: 'text-cyan-500', dotColor: 'bg-cyan-500' },
  later: { title: 'Futuras', color: 'text-gray-500', dotColor: 'bg-gray-400' },
  no_date: { title: 'Sem Data', color: 'text-gray-400', dotColor: 'bg-gray-300' }
};

const STATUS_COLUMN_CONFIG = {
  pending: { title: 'Pendentes', color: 'text-amber-500', dotColor: 'bg-amber-500' },
  in_progress: { title: 'Em Andamento', color: 'text-blue-500', dotColor: 'bg-blue-500' },
  completed: { title: 'Concluidas', color: 'text-green-500', dotColor: 'bg-green-500' }
};

const TasksPage = () => {
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

  useEffect(() => {
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
      setError('Erro ao carregar tarefas');
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
      await api.completeTask(taskId);
      loadData();
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    e?.stopPropagation();
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
      await api.deleteTask(taskId);
      loadData();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // Board View Card (styled like LeadCard)
  const TaskCard = ({ task }) => {
    const isCompleted = task.status === 'completed';
    const taskType = TASK_TYPES[task.taskType] || TASK_TYPES.other;
    const TaskTypeIcon = taskType.icon;
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

    return (
      <div
        className={`bg-white rounded-lg border p-3 cursor-pointer group shadow-sm hover:shadow-md transition-all ${
          isCompleted ? 'opacity-50 border-gray-200' : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={() => handleEditTask(task)}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={(e) => handleCompleteTask(task.id, e)}
            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border ${
              isCompleted
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-purple-400'
            } flex items-center justify-center transition-colors`}
          >
            {isCompleted && <Check className="w-3 h-3" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title with Type Icon */}
            <div className="flex items-start gap-2">
              <TaskTypeIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <h4 className={`text-sm font-medium text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
                {task.title}
              </h4>
            </div>

            {/* Lead */}
            {task.lead && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 ml-6">
                <LinkIcon className="w-3 h-3 text-gray-400" />
                <span className="truncate">{task.lead.name}</span>
              </p>
            )}

            {/* Footer: Priority & Assignee */}
            <div className="flex items-center justify-between mt-2 ml-6">
              <span className={`text-xs font-medium ${priority.color}`}>
                {priority.label}
              </span>

              <div className="flex items-center gap-2">
                {/* Due Date */}
                {task.dueDate && (
                  <span className="text-[10px] text-gray-400">
                    {formatDate(task.dueDate)}
                  </span>
                )}

                {/* Assignee */}
                {task.assignedTo && (
                  <div className="flex items-center" title={task.assignedTo.name}>
                    {task.assignedTo.avatarUrl ? (
                      <img src={task.assignedTo.avatarUrl} alt="" className="w-5 h-5 rounded-full border border-gray-100" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-purple-600">{task.assignedTo.name?.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delete button on hover */}
          <button
            onClick={(e) => handleDeleteTask(task.id, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded flex-shrink-0"
            title="Excluir"
          >
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
    );
  };

  // Board Column (styled like LeadsPage pipeline)
  const BoardColumn = ({ columnKey, columnTasks, config }) => {
    const count = columnTasks?.length || 0;

    return (
      <div className="flex-1 min-w-[280px] max-w-[320px] flex flex-col">
        {/* Column Header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
            <h3 className="font-semibold text-sm text-gray-700">{config.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600`}>
              {count}
            </span>
          </div>
          <button
            onClick={handleCreateTask}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Column Content */}
        <div
          className="flex-1 rounded-lg bg-gray-50 p-2 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 220px)', minHeight: '400px' }}
        >
          {count === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
              Nenhuma tarefa
            </div>
          ) : (
            <div className="space-y-2">
              {columnTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </div>
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
        className={`flex items-center gap-4 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 cursor-pointer group ${
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
              : 'border-gray-300 hover:border-gray-400'
          } flex items-center justify-center`}
        >
          {isCompleted && <Check className="w-3 h-3" />}
        </button>

        {/* Task Type Icon */}
        <TaskTypeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
            {task.title}
          </span>
        </div>

        {/* Lead/Lista */}
        <div className="w-32 flex-shrink-0">
          {task.lead ? (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded truncate block">
              {task.lead.name}
            </span>
          ) : (
            <span className="text-xs text-gray-300">-</span>
          )}
        </div>

        {/* Due Date (Previsto) */}
        <div className="w-24 flex-shrink-0 text-xs text-gray-500">
          {formatDate(task.dueDate)}
        </div>

        {/* Completed Date (Conclusao) */}
        <div className="w-24 flex-shrink-0 text-xs text-gray-500">
          {task.completedAt ? formatDate(task.completedAt) : '-'}
        </div>

        {/* Priority */}
        <div className="w-20 flex-shrink-0">
          <span className={`text-xs ${priority.color}`}>
            {priority.label}
          </span>
        </div>

        {/* Assignee */}
        <div className="w-24 flex-shrink-0">
          {task.assignedTo ? (
            <div className="flex items-center gap-2" title={task.assignedTo.name}>
              {task.assignedTo.avatarUrl ? (
                <img src={task.assignedTo.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-600">{task.assignedTo.name?.charAt(0)}</span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-300">-</span>
          )}
        </div>

        {/* Actions */}
        <div className="w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => handleDeleteTask(task.id, e)}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
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
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100"
          onClick={() => toggleGroup(groupKey)}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
          <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
          <span className="font-medium text-sm text-gray-700">{config.title}</span>
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
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Tarefas</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="Lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`p-1.5 rounded ${viewMode === 'board' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                title="Kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleCreateTask}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Tarefa
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-4 mt-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.status === '' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'open' }))}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.status === 'open' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Em Aberto
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'completed' }))}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filters.status === 'completed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Concluidas
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={filters.period}
              onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="7days">Ultimos 7 dias</option>
              <option value="15days">Ultimos 15 dias</option>
              <option value="30days">Ultimos 30 dias</option>
              <option value="90days">Ultimos 90 dias</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {/* Assignee Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filters.assigned_to}
              onChange={(e) => setFilters(prev => ({ ...prev, assigned_to: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">Todos</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {/* Group By */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setGroupBy('due_date')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                groupBy === 'due_date' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Por Data
            </button>
            <button
              onClick={() => setGroupBy('status')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                groupBy === 'status' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Por Status
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'board' ? (
          /* Board View */
          <div className="h-full px-6 py-4 overflow-x-auto">
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
        ) : (
          /* List View */
          <div className="h-full overflow-y-auto">
            {/* List Header */}
            <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0">
              <div className="w-4" /> {/* Checkbox space */}
              <div className="w-4" /> {/* Icon space */}
              <div className="flex-1">Nome</div>
              <div className="w-32">Lead</div>
              <div className="w-24">Previsto</div>
              <div className="w-24">Conclusao</div>
              <div className="w-20">Prioridade</div>
              <div className="w-24">Responsavel</div>
              <div className="w-8" /> {/* Actions space */}
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
