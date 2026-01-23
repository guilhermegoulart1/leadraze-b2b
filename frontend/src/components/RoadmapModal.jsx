// frontend/src/components/RoadmapModal.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Loader,
  Clock,
  User,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../services/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const TASK_TYPES = [
  { value: 'call', label: 'Ligação', color: 'blue' },
  { value: 'meeting', label: 'Reunião', color: 'purple' },
  { value: 'email', label: 'Email', color: 'green' },
  { value: 'follow_up', label: 'Follow-up', color: 'amber' },
  { value: 'proposal', label: 'Proposta', color: 'indigo' },
  { value: 'other', label: 'Outro', color: 'gray' }
];

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'gray' },
  { value: 'medium', label: 'Média', color: 'blue' },
  { value: 'high', label: 'Alta', color: 'amber' },
  { value: 'urgent', label: 'Urgente', color: 'red' }
];

const TIME_UNITS = [
  { value: 'minutes', label: 'Minutos', multiplier: 1/60 },
  { value: 'hours', label: 'Horas', multiplier: 1 },
  { value: 'days', label: 'Dias', multiplier: 24 }
];

// Convert hours to best display unit
const hoursToDisplayUnit = (hours) => {
  if (!hours) return { value: 1, unit: 'hours' };

  // Check if it's a clean number of days
  if (hours >= 24 && hours % 24 === 0) {
    return { value: hours / 24, unit: 'days' };
  }
  // Check if it's less than 1 hour (minutes)
  if (hours < 1) {
    return { value: Math.round(hours * 60), unit: 'minutes' };
  }
  // Default to hours
  return { value: hours, unit: 'hours' };
};

// Convert display value + unit back to hours
const displayToHours = (value, unit) => {
  const unitConfig = TIME_UNITS.find(u => u.value === unit);
  return value * (unitConfig?.multiplier || 1);
};

const RoadmapModal = ({ roadmap, onSave, onClose, isAdmin }) => {
  const { t } = useTranslation('settings');
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortcut: '',
    is_global: false,
    default_assignees: []
  });
  const [tasks, setTasks] = useState([]);
  const [expandedTask, setExpandedTask] = useState(null);

  useEffect(() => {
    loadUsers();
    if (roadmap) {
      setFormData({
        name: roadmap.name || '',
        description: roadmap.description || '',
        shortcut: roadmap.shortcut || '',
        is_global: roadmap.is_global || false,
        default_assignees: roadmap.default_assignees || []
      });
      setTasks(roadmap.tasks || []);
    }
  }, [roadmap]);

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      if (response.success) {
        // Handle both { data: [...] } and { data: { users: [...] } } structures
        const usersArray = Array.isArray(response.data)
          ? response.data
          : (response.data?.users || response.data?.data || []);
        setUsers(usersArray);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]); // Ensure users is always an array
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSaving(true);

      // If editing, update tasks separately
      if (roadmap) {
        // First update the roadmap info
        await onSave(formData);

        // Then sync tasks (add, update, delete)
        const existingTaskIds = (roadmap.tasks || []).map(t => t.id);
        const currentTaskIds = tasks.filter(t => t.id && !t.id.startsWith('new-')).map(t => t.id);

        // Delete removed tasks
        for (const taskId of existingTaskIds) {
          if (!currentTaskIds.includes(taskId)) {
            await api.deleteRoadmapTask(roadmap.id, taskId);
          }
        }

        // Add or update tasks
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const taskData = {
            title: task.title,
            description: task.description,
            task_type: task.task_type,
            priority: task.priority,
            relative_due_hours: task.relative_due_hours,
            relative_due_from: task.relative_due_from,
            default_assignee_id: task.default_assignee_id || null
          };

          if (task.id && !task.id.startsWith('new-')) {
            // Update existing
            await api.updateRoadmapTask(roadmap.id, task.id, taskData);
          } else {
            // Create new
            await api.addRoadmapTask(roadmap.id, taskData);
          }
        }

        // Reorder tasks
        if (tasks.length > 0) {
          const response = await api.getRoadmap(roadmap.id);
          if (response.success && response.data.tasks) {
            const orderedTasks = response.data.tasks.map((t, i) => ({
              id: t.id,
              position: i
            }));
            await api.reorderRoadmapTasks(roadmap.id, { tasks: orderedTasks });
          }
        }
      } else {
        // Creating new roadmap with tasks
        await onSave({
          ...formData,
          tasks: tasks.map((task, index) => ({
            title: task.title,
            description: task.description,
            task_type: task.task_type,
            priority: task.priority,
            relative_due_hours: task.relative_due_hours,
            relative_due_from: task.relative_due_from,
            default_assignee_id: task.default_assignee_id || null,
            position: index
          }))
        });
      }
    } catch (error) {
      console.error('Error saving roadmap:', error);
    } finally {
      setSaving(false);
    }
  };

  const addTask = () => {
    const newTask = {
      id: `new-${Date.now()}`,
      title: '',
      description: '',
      task_type: 'other',
      priority: 'medium',
      relative_due_hours: 24,
      relative_due_from: 'roadmap_start',
      default_assignee_id: null
    };
    setTasks([...tasks, newTask]);
    setExpandedTask(newTask.id);
  };

  const updateTask = (taskId, field, value) => {
    setTasks(tasks.map(t =>
      t.id === taskId ? { ...t, [field]: value } : t
    ));
  };

  const removeTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    if (expandedTask === taskId) {
      setExpandedTask(null);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(tasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTasks(items);
  };

  const formatDuration = (hours) => {
    if (!hours) return '';
    // Less than 1 hour - show minutes
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} min`;
    }
    // Less than 24 hours - show hours
    if (hours < 24) {
      return `${hours}h`;
    }
    // 24+ hours - show days
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) return `${days}d`;
    return `${days}d ${remainingHours}h`;
  };

  const totalDuration = tasks.reduce((sum, t) => sum + (t.relative_due_hours || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {roadmap ? t('roadmaps.edit', 'Editar Roadmap') : t('roadmaps.newRoadmap', 'Novo Roadmap')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('roadmaps.nameLabel', 'Nome')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('roadmaps.namePlaceholder', 'Ex: Onboarding de Cliente')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('roadmaps.descriptionLabel', 'Descrição')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('roadmaps.descriptionPlaceholder', 'Descreva o objetivo deste roadmap...')}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('roadmaps.shortcutLabel', 'Atalho')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">/</span>
                    <input
                      type="text"
                      value={formData.shortcut}
                      onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                      placeholder="onboarding"
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('roadmaps.shortcutHelp', 'Use no chat digitando /')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('roadmaps.totalDuration', 'Duração Total')}
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {formatDuration(totalDuration) || '-'}
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_global"
                    checked={formData.is_global}
                    onChange={(e) => setFormData({ ...formData, is_global: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <label htmlFor="is_global" className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">{t('roadmaps.globalLabel', 'Roadmap Global')}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      - {t('roadmaps.globalDescription', 'Disponível para toda a equipe')}
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Tasks Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('roadmaps.tasksSection', 'Tarefas')} ({tasks.length})
                </h4>
                <button
                  type="button"
                  onClick={addTask}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('roadmaps.addTask', 'Adicionar Tarefa')}
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('roadmaps.noTasks', 'Nenhuma tarefa adicionada')}
                  </p>
                  <button
                    type="button"
                    onClick={addTask}
                    className="mt-2 text-sm text-purple-600 hover:text-purple-700"
                  >
                    {t('roadmaps.addFirstTask', 'Adicionar primeira tarefa')}
                  </button>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="tasks">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {tasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`border rounded-lg ${
                                  snapshot.isDragging
                                    ? 'border-purple-400 shadow-lg'
                                    : 'border-gray-200 dark:border-gray-700'
                                } bg-white dark:bg-gray-800`}
                              >
                                {/* Task Header */}
                                <div className="flex items-center gap-2 p-3">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="text-gray-400 hover:text-gray-600 cursor-grab"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <span className="text-xs text-gray-400 w-5">{index + 1}.</span>
                                  <input
                                    type="text"
                                    value={task.title}
                                    onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                                    placeholder={t('roadmaps.taskTitlePlaceholder', 'Título da tarefa')}
                                    className="flex-1 px-2 py-1 border-0 focus:ring-0 bg-transparent text-gray-900 dark:text-gray-100 text-sm"
                                  />
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(task.relative_due_hours)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                  >
                                    {expandedTask === task.id ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeTask(task.id)}
                                    className="p-1 text-gray-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Task Details (Expanded) */}
                                {expandedTask === task.id && (
                                  <div className="px-3 pb-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700 mt-1">
                                    <div className="grid grid-cols-2 gap-3 pt-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          {t('roadmaps.taskType', 'Tipo')}
                                        </label>
                                        <select
                                          value={task.task_type}
                                          onChange={(e) => updateTask(task.id, 'task_type', e.target.value)}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        >
                                          {TASK_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>
                                              {type.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          {t('roadmaps.priority', 'Prioridade')}
                                        </label>
                                        <select
                                          value={task.priority}
                                          onChange={(e) => updateTask(task.id, 'priority', e.target.value)}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        >
                                          {PRIORITIES.map(p => (
                                            <option key={p.value} value={p.value}>
                                              {p.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          {t('roadmaps.deadline', 'Prazo')}
                                        </label>
                                        <div className="flex gap-2">
                                          <input
                                            type="number"
                                            min="1"
                                            value={hoursToDisplayUnit(task.relative_due_hours).value}
                                            onChange={(e) => {
                                              const displayUnit = hoursToDisplayUnit(task.relative_due_hours).unit;
                                              const newHours = displayToHours(parseInt(e.target.value) || 1, displayUnit);
                                              updateTask(task.id, 'relative_due_hours', newHours);
                                            }}
                                            className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                          />
                                          <select
                                            value={hoursToDisplayUnit(task.relative_due_hours).unit}
                                            onChange={(e) => {
                                              const currentDisplay = hoursToDisplayUnit(task.relative_due_hours);
                                              const newHours = displayToHours(currentDisplay.value, e.target.value);
                                              updateTask(task.id, 'relative_due_hours', newHours);
                                            }}
                                            className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                          >
                                            {TIME_UNITS.map(unit => (
                                              <option key={unit.value} value={unit.value}>
                                                {t(`roadmaps.timeUnits.${unit.value}`, unit.label)}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                          {t('roadmaps.dueFrom', 'A partir de')}
                                        </label>
                                        <select
                                          value={task.relative_due_from}
                                          onChange={(e) => updateTask(task.id, 'relative_due_from', e.target.value)}
                                          className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                        >
                                          <option value="roadmap_start">{t('roadmaps.fromStart', 'Início do roadmap')}</option>
                                          <option value="previous_task">{t('roadmaps.fromPrevious', 'Tarefa anterior')}</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        {t('roadmaps.defaultAssignee', 'Responsável padrão')}
                                      </label>
                                      <select
                                        value={task.default_assignee_id || ''}
                                        onChange={(e) => updateTask(task.id, 'default_assignee_id', e.target.value || null)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                      >
                                        <option value="">{t('roadmaps.noAssignee', 'Sem responsável definido')}</option>
                                        {users.map(u => (
                                          <option key={u.id} value={u.id}>
                                            {u.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                        {t('roadmaps.taskDescription', 'Descrição')}
                                      </label>
                                      <textarea
                                        value={task.description || ''}
                                        onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                                        placeholder={t('roadmaps.taskDescriptionPlaceholder', 'Detalhes da tarefa...')}
                                        rows={2}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('roadmaps.cancel', 'Cancelar')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.name.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader className="w-4 h-4 animate-spin" />}
            {t('roadmaps.save', 'Salvar')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoadmapModal;
