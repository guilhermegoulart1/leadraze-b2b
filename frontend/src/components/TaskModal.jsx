import React, { useState, useEffect, useRef } from 'react';
import {
  X, Calendar, User, Flag, FileText, Link as LinkIcon, Loader,
  Phone, Video, Mail, MessageSquare, FileCheck, MoreHorizontal,
  Building, Clock, CheckCircle2, Send, AtSign, Smile, Trash2
} from 'lucide-react';
import api from '../services/api';
import MentionTextarea from './MentionTextarea';

const TASK_TYPES = [
  { value: 'call', label: 'Ligacao', icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { value: 'meeting', label: 'Reuniao', icon: Video, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  { value: 'follow_up', label: 'Follow-up', icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { value: 'proposal', label: 'Proposta', icon: FileCheck, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { value: 'other', label: 'Outro', icon: MoreHorizontal, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' }
];

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'medium', label: 'Media', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { value: 'high', label: 'Alta', color: 'text-orange-600', bg: 'bg-orange-50' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600', bg: 'bg-red-50' }
];

const STATUSES = [
  { value: 'pending', label: 'Pendente', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { value: 'in_progress', label: 'Em Andamento', color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'completed', label: 'Concluida', color: 'text-green-600', bg: 'bg-green-50' },
  { value: 'cancelled', label: 'Cancelada', color: 'text-gray-400', bg: 'bg-gray-50' }
];

const TaskModal = ({ isOpen, onClose, task = null, leadId = null, onSave, isNested = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    task_type: 'call',
    status: 'pending',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
    lead_id: leadId || ''
  });
  const [users, setUsers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [sendingComment, setSendingComment] = useState(false);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (!isNested) {
        loadData();
      }
      if (task) {
        setFormData({
          title: task.title || '',
          description: task.description || '',
          task_type: task.taskType || 'call',
          status: task.status || 'pending',
          priority: task.priority || 'medium',
          due_date: task.dueDate ? formatDateForInput(task.dueDate) : '',
          assigned_to: task.assignedTo?.id || '',
          lead_id: task.lead?.id || leadId || ''
        });
        // Load comments for existing task
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
          assigned_to: '',
          lead_id: leadId || ''
        });
        setComments([]);
      }
      setErrors({});
    }
  }, [isOpen, task, leadId, isNested]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().slice(0, 16);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResponse, leadsResponse] = await Promise.all([
        api.getAssignableUsers(),
        api.getLeads({ limit: 100 })
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
      if (response.success) {
        setComments(response.data?.comments || []);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, task_type: type }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Titulo e obrigatorio';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        task_type: formData.task_type,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        assigned_to: isNested ? null : (formData.assigned_to || null),
        lead_id: leadId || formData.lead_id || null
      };

      if (task) {
        await api.updateTask(task.id, payload);
      } else {
        await api.createTask(payload);
      }

      onSave?.();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      setErrors({ general: error.message || 'Erro ao salvar tarefa' });
    } finally {
      setSaving(false);
    }
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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  const selectedType = TASK_TYPES.find(t => t.value === formData.task_type) || TASK_TYPES[0];
  const TypeIcon = selectedType.icon;
  const selectedPriority = PRIORITIES.find(p => p.value === formData.priority) || PRIORITIES[1];
  const selectedStatus = STATUSES.find(s => s.value === formData.status) || STATUSES[0];

  // Simple modal for nested mode (inside LeadDetailModal)
  if (isNested) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
        onClick={handleBackdropClick}
      >
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
          onClick={handleModalClick}
        >
          {/* Simple Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {task ? 'Editar Tarefa' : 'Nova Tarefa'}
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Simple Form */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {errors.general}
              </div>
            )}

            {/* Task Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Atividade
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TASK_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.task_type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleTypeSelect(type.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `${type.bg} ${type.color} ${type.border}`
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder={`Ex: ${selectedType.label} com o lead`}
              />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
            </div>

            {/* Priority & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  {PRIORITIES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prazo</label>
                <input
                  type="datetime-local"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                {task ? 'Salvar' : 'Criar Tarefa'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Full-screen modal for standalone mode (similar to LeadDetailModal)
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden"
        onClick={handleModalClick}
      >
        {/* Header - Purple gradient */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Task Type Icon */}
                <div className={`w-12 h-12 rounded-xl ${selectedType.bg} flex items-center justify-center`}>
                  <TypeIcon className={`w-6 h-6 ${selectedType.color}`} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {task ? formData.title || 'Editar Tarefa' : 'Nova Tarefa'}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-purple-200">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${selectedType.bg}`} />
                      {selectedType.label}
                    </span>
                    {task?.lead && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        {task.lead.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Two columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Form */}
          <div className="w-[55%] border-r border-gray-200 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {errors.general}
                </div>
              )}

              {/* Task Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Atividade
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {TASK_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = formData.task_type === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleTypeSelect(type.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? `${type.bg} ${type.color} ${type.border}`
                            : 'border-gray-200 hover:border-gray-300 text-gray-600'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${
                    errors.title ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder={`Ex: ${selectedType.label} com o lead`}
                />
                {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Observacoes
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="Detalhes ou notas sobre a tarefa..."
                />
              </div>

              {/* Grid: Priority, Status, Due Date */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Flag className="w-4 h-4 inline mr-1" />
                    Prioridade
                  </label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {task && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={task ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Prazo
                  </label>
                  <input
                    type="datetime-local"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Lead & Assigned */}
              <div className="grid grid-cols-2 gap-4">
                {!leadId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <LinkIcon className="w-4 h-4 inline mr-1" />
                      Lead Vinculado
                    </label>
                    <select
                      name="lead_id"
                      value={formData.lead_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    >
                      <option value="">Nenhum lead</option>
                      {leads.map(lead => (
                        <option key={lead.id} value={lead.id}>
                          {lead.name} {lead.company ? `(${lead.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={leadId ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    Responsavel
                  </label>
                  <select
                    name="assigned_to"
                    value={formData.assigned_to}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    disabled={loading}
                  >
                    <option value="">Nenhum</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  {task ? 'Salvar Alteracoes' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Panel - Comments */}
          <div className="w-[45%] flex flex-col bg-gray-50">
            {/* Comments Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                Comentarios
                {comments.length > 0 && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded-full">
                    {comments.length}
                  </span>
                )}
              </h3>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4">
              {!task ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">Salve a tarefa primeiro</p>
                  <p className="text-xs mt-1">Comentarios podem ser adicionados apos criar a tarefa</p>
                </div>
              ) : loadingComments ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">Nenhum comentario</p>
                  <p className="text-xs mt-1">Seja o primeiro a comentar</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 group">
                      {comment.user?.avatar ? (
                        <img
                          src={comment.user.avatar}
                          alt={comment.user.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {comment.user?.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {comment.user?.name || 'Usuario'}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(comment.createdAt)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Excluir comentario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                        {comment.mentionedUserNames && comment.mentionedUserNames.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            <AtSign className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {comment.mentionedUserNames.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* Comment Input */}
            {task && (
              <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    U
                  </div>
                  <div className="flex-1">
                    <MentionTextarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onMentionsChange={setCommentMentions}
                      placeholder="Escreva um comentario... Use @ para mencionar"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded">
                          <Smile className="w-4 h-4" />
                        </button>
                      </div>
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim() || sendingComment}
                        className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {sendingComment && <Loader className="w-3 h-3 animate-spin" />}
                        Comentar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
