import React, { useState, useEffect, useRef } from 'react';
import {
  X, Calendar, User, Flag, FileText, Link as LinkIcon, Loader,
  Phone, Video, Mail, MessageSquare, FileCheck, MoreHorizontal,
  Building, Clock, CheckCircle2, Send, AtSign, Smile, Trash2, Search, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import MentionTextarea from './MentionTextarea';

const TASK_TYPES = [
  { value: 'call', label: 'Ligacao', icon: Phone },
  { value: 'meeting', label: 'Reuniao', icon: Video },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'follow_up', label: 'Follow-up', icon: MessageSquare },
  { value: 'proposal', label: 'Proposta', icon: FileCheck },
  { value: 'other', label: 'Outro', icon: MoreHorizontal }
];

const PRIORITIES = [
  { value: 'urgent', label: 'Urgente', color: 'text-red-600', bg: 'bg-red-50', icon: '🔴' },
  { value: 'high', label: 'Alta', color: 'text-orange-600', bg: 'bg-orange-50', icon: '🟠' },
  { value: 'medium', label: 'Normal', color: 'text-blue-600', bg: 'bg-blue-50', icon: '🔵' },
  { value: 'low', label: 'Baixa', color: 'text-gray-600', bg: 'bg-gray-50', icon: '⚪' }
];

const STATUSES = [
  { value: 'pending', label: 'Pendente', color: 'text-gray-600', bg: 'bg-gray-100' },
  { value: 'in_progress', label: 'Em Andamento', color: 'text-blue-600', bg: 'bg-blue-100' },
  { value: 'completed', label: 'Concluida', color: 'text-green-600', bg: 'bg-green-100' }
];

const TaskModal = ({ isOpen, onClose, task = null, leadId = null, onSave, isNested = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'call',
    status: 'pending',
    priority: 'medium',
    due_date: '',
    assignees: [],
    lead_id: leadId || ''
  });
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const saveTimeoutRef = useRef(null);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (task) {
        // Parse assignees - could be array of objects or array of IDs
        let assignees = [];
        if (task.assignees && Array.isArray(task.assignees)) {
          assignees = task.assignees;
        } else if (task.assignedTo) {
          assignees = [task.assignedTo];
        }

        setFormData({
          title: task.title || '',
          description: task.description || '',
          task_type: task.taskType || 'call',
          status: task.status || 'pending',
          priority: task.priority || 'medium',
          due_date: task.dueDate ? formatDateForInput(task.dueDate) : '',
          assignees: assignees,
          lead_id: task.lead?.id || leadId || ''
        });
        loadComments(task.id);
      } else {
        const today = new Date();
        today.setHours(18, 0, 0, 0);
        setFormData({
          title: '',
          description: '',
          task_type: 'call',
          status: 'pending',
          priority: 'medium',
          due_date: formatDateForInput(today),
          assignees: [],
          lead_id: leadId || ''
        });
      }
    }
  }, [isOpen, task, leadId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showAssigneeDropdown && !e.target.closest('.relative')) {
        setShowAssigneeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAssigneeDropdown]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResponse, leadsResponse] = await Promise.all([
        api.getAssignableUsers(),
        leadId ? Promise.resolve({ data: { leads: [] } }) : api.getLeads({ page: 1, limit: 100 })
      ]);
      setUsers(usersResponse.data?.users || []);
      setLeads(leadsResponse.data?.leads || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (taskId) => {
    if (!taskId) return;
    setLoadingComments(true);
    try {
      const response = await api.getTaskComments(taskId);
      setComments(response.data?.comments || []);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Auto-save function
  const autoSaveTask = async (updatedData) => {
    if (!task) return; // Only auto-save for existing tasks

    setAutoSaving(true);
    try {
      const payload = {
        title: updatedData.title.trim() || 'Sem titulo',
        description: updatedData.description.trim() || null,
        task_type: updatedData.task_type,
        status: updatedData.status,
        priority: updatedData.priority,
        due_date: updatedData.due_date || null,
        assignees: updatedData.assignees.map(a => a.id || a),
        lead_id: (leadId || updatedData.lead_id) || null
      };

      await api.updateTask(task.id, payload);
      onSave?.();
    } catch (error) {
      console.error('Error auto-saving task:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  // Debounced auto-save
  const handleFieldChange = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only auto-save for existing tasks and after 500ms of inactivity
    if (task) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSaveTask(updatedData);
      }, 500);
    }
  };

  const handleCreateTask = async () => {
    if (!formData.title.trim()) {
      alert('Título é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        task_type: formData.task_type,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        assignees: formData.assignees.map(a => a.id || a),
        lead_id: (leadId || formData.lead_id) || null
      };

      await api.createTask(payload);
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Erro ao criar tarefa');
    } finally {
      setLoading(false);
    }
  };

  // Toggle assignee
  const toggleAssignee = (user) => {
    const assignees = formData.assignees || [];
    const exists = assignees.some(a => (a.id || a) === user.id);

    const newAssignees = exists
      ? assignees.filter(a => (a.id || a) !== user.id)
      : [...assignees, user];

    handleFieldChange('assignees', newAssignees);
  };

  // Render avatar
  const renderUserAvatar = (user) => {
    if (!user) return null;

    // Check both camelCase and snake_case for compatibility
    const avatarUrl = user.avatarUrl || user.avatar_url;

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={user.name}
          className="w-6 h-6 rounded-full object-cover border-2 border-white dark:border-gray-800"
        />
      );
    }

    const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
    return (
      <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-medium flex items-center justify-center border-2 border-white dark:border-gray-800">
        {initials}
      </div>
    );
  };

  // Render assignees avatars
  const renderAssigneesAvatars = (assignees = [], maxShow = 3) => {
    if (!assignees || assignees.length === 0) {
      return (
        <span className="text-sm text-gray-500 dark:text-gray-400">Nenhum</span>
      );
    }

    const shown = assignees.slice(0, maxShow);
    const remaining = assignees.length - maxShow;

    return (
      <div className="flex -space-x-1">
        {shown.map((user, idx) => (
          <div key={user.id} className="relative" style={{ zIndex: maxShow - idx }} title={user.name}>
            {renderUserAvatar(user)}
          </div>
        ))}
        {remaining > 0 && (
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 border-2 border-white dark:border-gray-800">
            +{remaining}
          </div>
        )}
      </div>
    );
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task?.id) return;

    setSendingComment(true);
    try {
      const response = await api.createTaskComment(task.id, {
        content: newComment,
        mentions: commentMentions
      });

      if (response.success) {
        setComments(prev => [...prev, response.data.comment]);
        setNewComment('');
        setCommentMentions([]);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!task?.id) return;
    try {
      await api.deleteTaskComment(task.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const formatTimestamp = (date) => {
    if (!date) return '';
    const timestamp = new Date(date);
    if (isNaN(timestamp.getTime())) return '';

    const now = new Date();
    const diff = now - timestamp;
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
      return timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ontem';
    } else if (days < 7) {
      return `${days} dias atras`;
    }
    return timestamp.toLocaleDateString('pt-BR');
  };

  if (!isOpen) return null;

  const selectedType = TASK_TYPES.find(t => t.value === formData.task_type) || TASK_TYPES[0];
  const TypeIcon = selectedType.icon;
  const selectedPriority = PRIORITIES.find(p => p.value === formData.priority) || PRIORITIES[2];
  const selectedStatus = STATUSES.find(s => s.value === formData.status) || STATUSES[0];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TypeIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Nome da tarefa"
              className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            {autoSaving && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Loader className="w-3 h-3 animate-spin" />
                Salvando...
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Details */}
          <div className="flex-1 p-6 space-y-4 flex flex-col">
            {/* Properties in line - ClickUp style */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              {/* Column 1 - Task Type */}
              <div className="flex items-center gap-2">
                <TypeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20">Tipo</span>
                <select
                  value={formData.task_type}
                  onChange={(e) => handleFieldChange('task_type', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-transparent border-none rounded text-gray-900 dark:text-gray-100 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                >
                  {TASK_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Column 2 - Assignee */}
              <div className="relative flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20">Responsavel</span>
                <div
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="flex-1 flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {renderAssigneesAvatars(formData.assignees)}
                  <ChevronDown className="w-3 h-3 text-gray-400 ml-auto" />
                </div>

                {/* Dropdown */}
                {showAssigneeDropdown && (
                  <div className="absolute top-full mt-1 left-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {users.map(user => {
                        const isSelected = formData.assignees.some(a => (a.id || a) === user.id);
                        return (
                          <button
                            key={user.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAssignee(user);
                            }}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                              isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {renderUserAvatar(user)}
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 text-left">{user.name}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-purple-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 1 - Status */}
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20">Status</span>
                <select
                  value={formData.status}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-transparent border-none rounded text-gray-900 dark:text-gray-100 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Column 2 - Priority */}
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20">Prioridade</span>
                <select
                  value={formData.priority}
                  onChange={(e) => handleFieldChange('priority', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-transparent border-none rounded text-gray-900 dark:text-gray-100 font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                  ))}
                </select>
              </div>

              {/* Column 1 - Due Date */}
              <div className="flex items-center gap-2 col-span-2">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 dark:text-gray-400 w-20">Prazo</span>
                <input
                  type="datetime-local"
                  value={formData.due_date}
                  onChange={(e) => handleFieldChange('due_date', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-transparent border-none rounded text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Description - Large space */}
            <div className="flex-1 min-h-0">
              <textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Adicione uma descricao detalhada da tarefa..."
                className="w-full h-full px-0 py-0 text-sm bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 resize-none overflow-auto"
              />
            </div>

            {/* Create button for new tasks */}
            {!task && (
              <button
                onClick={handleCreateTask}
                disabled={loading || !formData.title.trim()}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                Criar Tarefa
              </button>
            )}
          </div>

          {/* Right Panel - Comments (only for existing tasks) */}
          {task && (
            <div className="w-80 border-l border-gray-200 dark:border-gray-700 flex flex-col">
              {/* Comments Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Comentarios</h3>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingComments ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum comentario ainda</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="group">
                      <div className="flex items-start gap-2">
                        {comment.user?.avatarUrl ? (
                          <img
                            src={comment.user.avatarUrl}
                            alt={comment.user.name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                              {comment.user?.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                              {comment.user?.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <div ref={commentsEndRef} />
              </div>

              {/* Add Comment */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                    placeholder="Adicionar comentario..."
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-gray-400"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || sendingComment}
                    className="self-end p-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingComment ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
