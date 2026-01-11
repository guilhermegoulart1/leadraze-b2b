import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckSquare,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  User,
  Users,
  Loader,
  X,
  Phone,
  Video,
  Mail,
  MessageSquare,
  FileCheck,
  MoreHorizontal,
  Calendar,
  Check
} from 'lucide-react';
import api from '../services/api';

const TASK_TYPES = [
  { value: 'call', label: 'Ligação', icon: Phone, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
  { value: 'meeting', label: 'Reunião', icon: Video, color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' },
  { value: 'follow_up', label: 'Follow-up', icon: MessageSquare, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30' },
  { value: 'proposal', label: 'Proposta', icon: FileCheck, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' },
  { value: 'other', label: 'Outro', icon: MoreHorizontal, color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700' }
];

// Portal Dropdown component for proper z-index handling
const PortalDropdown = ({ isOpen, anchorRef, children, align = 'left', width = 140, onClose }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: align === 'right' ? rect.right - width : rect.left
      });
    }
  }, [isOpen, anchorRef, align, width]);

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Overlay to close dropdown when clicking outside */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose && onClose();
        }}
      />
      <div
        className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 py-1"
        style={{
          top: position.top,
          left: position.left,
          minWidth: width,
          zIndex: 9999
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

// Parse date string as local date (avoiding timezone issues)
const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  // If it's already a Date object, return it
  if (dateStr instanceof Date) return dateStr;
  // Parse YYYY-MM-DD as local date
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Format date for display
const formatDate = (date) => {
  if (!date) return null;
  const d = parseLocalDate(date);
  if (!d) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const itemDate = new Date(d);
  itemDate.setHours(0, 0, 0, 0);

  if (itemDate.getTime() === today.getTime()) return 'Hoje';
  if (itemDate.getTime() === tomorrow.getTime()) return 'Amanhã';
  if (itemDate < today) return `Atrasado (${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })})`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

// Get due date color class
const getDueDateColor = (date) => {
  if (!date) return 'text-gray-400 dark:text-gray-500';
  const d = parseLocalDate(date);
  if (!d) return 'text-gray-400 dark:text-gray-500';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDate = new Date(d);
  itemDate.setHours(0, 0, 0, 0);

  if (itemDate < today) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
  if (itemDate.getTime() === today.getTime()) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
  return 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700';
};

const LeadChecklists = ({ leadId, sectorId }) => {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedChecklists, setExpandedChecklists] = useState({});
  const [newChecklistName, setNewChecklistName] = useState('');
  const [showNewChecklist, setShowNewChecklist] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [activeAssignDropdown, setActiveAssignDropdown] = useState(null);
  const [activeDateDropdown, setActiveDateDropdown] = useState(null);
  const [savingItem, setSavingItem] = useState(null);

  // Editing checklist name
  const [editingChecklistId, setEditingChecklistId] = useState(null);
  const [editingChecklistName, setEditingChecklistName] = useState('');

  // New item form state per checklist
  const [newItemForms, setNewItemForms] = useState({});
  const [showTypeDropdown, setShowTypeDropdown] = useState(null);
  const [showNewItemUserDropdown, setShowNewItemUserDropdown] = useState(null);
  const [showNewItemDateDropdown, setShowNewItemDateDropdown] = useState(null);

  const newChecklistInputRef = useRef(null);
  const newItemInputRefs = useRef({});
  const editChecklistInputRef = useRef(null);

  // Refs for dropdown positioning (used by PortalDropdown)
  const typeButtonRefs = useRef({});
  const userButtonRefs = useRef({});
  const dateButtonRefs = useRef({});
  const assignButtonRefs = useRef({});
  const itemDateButtonRefs = useRef({});

  useEffect(() => {
    if (leadId) {
      loadChecklists();
      loadAssignableUsers();
    }
  }, [leadId]);

  useEffect(() => {
    if (showNewChecklist && newChecklistInputRef.current) {
      newChecklistInputRef.current.focus();
    }
  }, [showNewChecklist]);

  useEffect(() => {
    if (editingChecklistId && editChecklistInputRef.current) {
      editChecklistInputRef.current.focus();
      editChecklistInputRef.current.select();
    }
  }, [editingChecklistId]);

  // Helper to close all dropdowns
  const closeAllDropdowns = () => {
    setShowTypeDropdown(null);
    setShowNewItemUserDropdown(null);
    setActiveAssignDropdown(null);
    setShowNewItemDateDropdown(null);
    setActiveDateDropdown(null);
  };

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const response = await api.getLeadChecklists(leadId);
      if (response.success) {
        const lists = response.data.checklists || [];
        setChecklists(lists);
        const expanded = {};
        lists.forEach(c => { expanded[c.id] = true; });
        setExpandedChecklists(expanded);
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAssignableUsers = async () => {
    try {
      const response = await api.getAssignableUsers(sectorId);
      if (response.success) {
        setAssignableUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const getNewItemForm = (checklistId) => {
    return newItemForms[checklistId] || { title: '', taskType: 'call', assignees: [], dueDate: null };
  };

  const updateNewItemForm = (checklistId, updates) => {
    setNewItemForms(prev => ({
      ...prev,
      [checklistId]: { ...getNewItemForm(checklistId), ...updates }
    }));
  };

  const resetNewItemForm = (checklistId) => {
    setNewItemForms(prev => ({
      ...prev,
      [checklistId]: { title: '', taskType: 'call', assignees: [], dueDate: null }
    }));
  };

  const toggleNewItemAssignee = (checklistId, user) => {
    const form = getNewItemForm(checklistId);
    const assignees = form.assignees || [];
    const exists = assignees.some(a => a.id === user.id);
    if (exists) {
      updateNewItemForm(checklistId, { assignees: assignees.filter(a => a.id !== user.id) });
    } else {
      updateNewItemForm(checklistId, { assignees: [...assignees, user] });
    }
  };

  const handleCreateChecklist = async (e) => {
    e.preventDefault();
    if (!newChecklistName.trim()) return;

    try {
      const response = await api.createLeadChecklist(leadId, { name: newChecklistName.trim() });
      if (response.success) {
        setChecklists(prev => [...prev, response.data.checklist]);
        setExpandedChecklists(prev => ({ ...prev, [response.data.checklist.id]: true }));
        setNewChecklistName('');
        setShowNewChecklist(false);
      }
    } catch (error) {
      console.error('Error creating checklist:', error);
    }
  };

  const handleDeleteChecklist = async (checklistId) => {
    if (!confirm('Excluir esta checklist e todos os itens?')) return;

    try {
      await api.deleteChecklist(checklistId);
      setChecklists(prev => prev.filter(c => c.id !== checklistId));
    } catch (error) {
      console.error('Error deleting checklist:', error);
    }
  };

  const startEditingChecklist = (checklist) => {
    setEditingChecklistId(checklist.id);
    setEditingChecklistName(checklist.name);
  };

  const cancelEditingChecklist = () => {
    setEditingChecklistId(null);
    setEditingChecklistName('');
  };

  const handleRenameChecklist = async () => {
    if (!editingChecklistName.trim() || !editingChecklistId) {
      cancelEditingChecklist();
      return;
    }

    try {
      const response = await api.updateChecklist(editingChecklistId, { name: editingChecklistName.trim() });
      if (response.success) {
        setChecklists(prev => prev.map(c =>
          c.id === editingChecklistId ? { ...c, name: editingChecklistName.trim() } : c
        ));
      }
    } catch (error) {
      console.error('Error renaming checklist:', error);
    } finally {
      cancelEditingChecklist();
    }
  };

  const handleAddItem = async (checklistId) => {
    const form = getNewItemForm(checklistId);
    if (!form.title.trim()) return;

    try {
      setSavingItem(checklistId);
      const response = await api.createChecklistItem(checklistId, {
        title: form.title.trim(),
        task_type: form.taskType,
        assignees: form.assignees.map(a => a.id),
        due_date: form.dueDate
      });
      if (response.success) {
        setChecklists(prev => prev.map(c => {
          if (c.id === checklistId) {
            return {
              ...c,
              items: [...c.items, response.data.item],
              totalCount: c.totalCount + 1
            };
          }
          return c;
        }));
        resetNewItemForm(checklistId);
      }
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setSavingItem(null);
    }
  };

  const handleToggleItem = async (checklistId, itemId) => {
    try {
      const response = await api.toggleChecklistItem(itemId);
      if (response.success) {
        setChecklists(prev => prev.map(c => {
          if (c.id === checklistId) {
            const updatedItems = c.items.map(i =>
              i.id === itemId ? response.data.item : i
            );
            return {
              ...c,
              items: updatedItems,
              completedCount: updatedItems.filter(i => i.isCompleted).length
            };
          }
          return c;
        }));
      }
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  };

  const handleDeleteItem = async (checklistId, itemId) => {
    try {
      await api.deleteChecklistItem(itemId);
      setChecklists(prev => prev.map(c => {
        if (c.id === checklistId) {
          const updatedItems = c.items.filter(i => i.id !== itemId);
          return {
            ...c,
            items: updatedItems,
            totalCount: updatedItems.length,
            completedCount: updatedItems.filter(i => i.isCompleted).length
          };
        }
        return c;
      }));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleToggleItemAssignee = async (itemId, userId, checklistId) => {
    try {
      // Get current item
      const checklist = checklists.find(c => c.id === checklistId);
      const item = checklist?.items.find(i => i.id === itemId);
      if (!item) return;

      const currentAssignees = item.assignees || [];
      const exists = currentAssignees.some(a => a.id === userId);
      const newAssigneeIds = exists
        ? currentAssignees.filter(a => a.id !== userId).map(a => a.id)
        : [...currentAssignees.map(a => a.id), userId];

      const response = await api.updateChecklistItem(itemId, { assignees: newAssigneeIds });
      if (response.success) {
        setChecklists(prev => prev.map(c => {
          if (c.id === checklistId) {
            return {
              ...c,
              items: c.items.map(i => i.id === itemId ? response.data.item : i)
            };
          }
          return c;
        }));
      }
    } catch (error) {
      console.error('Error updating assignees:', error);
    }
  };

  const handleUpdateItemDueDate = async (itemId, dueDate, checklistId) => {
    try {
      const response = await api.updateChecklistItem(itemId, { due_date: dueDate });
      if (response.success) {
        setChecklists(prev => prev.map(c => {
          if (c.id === checklistId) {
            return {
              ...c,
              items: c.items.map(i => i.id === itemId ? response.data.item : i)
            };
          }
          return c;
        }));
      }
    } catch (error) {
      console.error('Error updating due date:', error);
    } finally {
      setActiveDateDropdown(null);
    }
  };

  const toggleExpanded = (checklistId) => {
    setExpandedChecklists(prev => ({
      ...prev,
      [checklistId]: !prev[checklistId]
    }));
  };

  const getTaskTypeInfo = (type) => {
    return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[5];
  };

  const renderUserAvatar = (user, size = 'sm') => {
    const sizeClasses = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-7 h-7 text-sm';
    if (user?.avatar_url || user?.avatarUrl) {
      return (
        <img
          src={user.avatar_url || user.avatarUrl}
          alt={user.name}
          className={`${sizeClasses} rounded-full object-cover`}
        />
      );
    }
    return (
      <div className={`${sizeClasses} rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium`}>
        {user?.name?.charAt(0) || '?'}
      </div>
    );
  };

  const renderAssigneesAvatars = (assignees = [], maxShow = 3) => {
    if (!assignees || assignees.length === 0) return null;
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
          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs text-gray-600 dark:text-gray-300 border-2 border-white dark:border-gray-800">
            +{remaining}
          </div>
        )}
      </div>
    );
  };

  // Format date to local YYYY-MM-DD (avoiding timezone issues)
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Quick date options
  const getQuickDates = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    return [
      { label: 'Hoje', value: toLocalDateString(today) },
      { label: 'Amanhã', value: toLocalDateString(tomorrow) },
      { label: 'Em 1 semana', value: toLocalDateString(nextWeek) }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-6 h-6 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <CheckSquare className="w-4 h-4" />
          <span>Tarefas</span>
          {checklists.length > 0 && (
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              {checklists.reduce((acc, c) => acc + c.completedCount, 0)}/
              {checklists.reduce((acc, c) => acc + c.totalCount, 0)}
            </span>
          )}
        </div>
      </div>

      {/* Checklists */}
      <div className="space-y-3">
        {checklists.map(checklist => (
          <div key={checklist.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
            {/* Checklist Header */}
            <div
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-150 dark:hover:bg-gray-700 group"
              onClick={() => {
                if (editingChecklistId !== checklist.id) {
                  toggleExpanded(checklist.id);
                }
              }}
            >
              {expandedChecklists[checklist.id] ? (
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}

              {/* Editable Name */}
              {editingChecklistId === checklist.id ? (
                <input
                  ref={editChecklistInputRef}
                  type="text"
                  value={editingChecklistName}
                  onChange={(e) => setEditingChecklistName(e.target.value)}
                  onBlur={handleRenameChecklist}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRenameChecklist();
                    } else if (e.key === 'Escape') {
                      cancelEditingChecklist();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-purple-400 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              ) : (
                <span
                  className="font-medium text-gray-700 dark:text-gray-200 flex-1 hover:text-purple-600 dark:hover:text-purple-400 cursor-text"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingChecklist(checklist);
                  }}
                  title="Clique para editar"
                >
                  {checklist.name}
                </span>
              )}

              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({checklist.completedCount}/{checklist.totalCount})
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChecklist(checklist.id);
                }}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Checklist Items */}
            {expandedChecklists[checklist.id] && (
              <div className="px-3 py-2 space-y-1">
                {checklist.items.map(item => {
                  const typeInfo = getTaskTypeInfo(item.taskType);
                  const TypeIcon = typeInfo.icon;
                  const assignees = item.assignees || [];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 py-1.5 group hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded px-2 -mx-2"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleItem(checklist.id, item.id)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          item.isCompleted
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                      >
                        {item.isCompleted && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Task Type Icon */}
                      <div className={`p-1 rounded ${typeInfo.color}`} title={typeInfo.label}>
                        <TypeIcon className="w-3 h-3" />
                      </div>

                      {/* Title */}
                      <span className={`flex-1 text-sm ${
                        item.isCompleted ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'
                      }`}>
                        {item.title}
                      </span>

                      {/* Due Date */}
                      <div className="relative">
                        {(() => {
                          if (!itemDateButtonRefs.current[item.id]) {
                            itemDateButtonRefs.current[item.id] = { current: null };
                          }
                          return (
                            <>
                              <button
                                ref={el => itemDateButtonRefs.current[item.id].current = el}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDateDropdown(activeDateDropdown === item.id ? null : item.id);
                                }}
                                className={`date-trigger px-1.5 py-0.5 rounded text-xs flex items-center gap-1 transition-all ${
                                  item.dueDate
                                    ? getDueDateColor(item.dueDate)
                                    : 'text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {item.dueDate ? formatDate(item.dueDate) : 'Prazo'}
                              </button>

                              <PortalDropdown
                                isOpen={activeDateDropdown === item.id}
                                anchorRef={itemDateButtonRefs.current[item.id]}
                                align="right"
                                width={200}
                                onClose={() => setActiveDateDropdown(null)}
                              >
                                <div className="p-2">
                                  {getQuickDates().map(opt => (
                                    <button
                                      key={opt.value}
                                      onClick={() => handleUpdateItemDueDate(item.id, opt.value, checklist.id)}
                                      className="w-full text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                  <div className="border-t my-1" />
                                  <input
                                    type="date"
                                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    onChange={(e) => handleUpdateItemDueDate(item.id, e.target.value, checklist.id)}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  {item.dueDate && (
                                    <>
                                      <div className="border-t my-1" />
                                      <button
                                        onClick={() => handleUpdateItemDueDate(item.id, null, checklist.id)}
                                        className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                                      >
                                        Remover prazo
                                      </button>
                                    </>
                                  )}
                                </div>
                              </PortalDropdown>
                            </>
                          );
                        })()}
                      </div>

                      {/* Assignees */}
                      <div className="relative">
                        {(() => {
                          if (!assignButtonRefs.current[item.id]) {
                            assignButtonRefs.current[item.id] = { current: null };
                          }
                          return (
                            <>
                              <button
                                ref={el => assignButtonRefs.current[item.id].current = el}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveAssignDropdown(activeAssignDropdown === item.id ? null : item.id);
                                }}
                                className={`user-trigger flex items-center transition-all ${
                                  assignees.length > 0
                                    ? ''
                                    : 'w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-500 opacity-0 group-hover:opacity-100 justify-center'
                                }`}
                              >
                                {assignees.length > 0 ? (
                                  renderAssigneesAvatars(assignees)
                                ) : (
                                  <Users className="w-3 h-3" />
                                )}
                              </button>

                              <PortalDropdown
                                isOpen={activeAssignDropdown === item.id}
                                anchorRef={assignButtonRefs.current[item.id]}
                                align="right"
                                width={220}
                                onClose={() => setActiveAssignDropdown(null)}
                              >
                                <div className="max-h-[250px] overflow-y-auto">
                                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                    Selecione os responsáveis
                                  </div>
                                  {assignableUsers.map(user => {
                                    const isSelected = assignees.some(a => a.id === user.id);
                                    return (
                                      <button
                                        key={user.id}
                                        onClick={() => handleToggleItemAssignee(item.id, user.id, checklist.id)}
                                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                          isSelected ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                                        }`}
                                      >
                                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                          isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300'
                                        }`}>
                                          {isSelected && <Check className="w-3 h-3" />}
                                        </div>
                                        {renderUserAvatar(user)}
                                        <span className="text-gray-700 dark:text-gray-200 flex-1 text-left">{user.name}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </PortalDropdown>
                            </>
                          );
                        })()}
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(checklist.id, item.id);
                        }}
                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Add New Item - Inline Form */}
                <div className="flex items-center gap-2 py-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                  {/* Task Type Selector */}
                  <div className="relative">
                    {(() => {
                      const form = getNewItemForm(checklist.id);
                      const selectedType = getTaskTypeInfo(form.taskType);
                      const SelectedIcon = selectedType.icon;
                      if (!typeButtonRefs.current[checklist.id]) {
                        typeButtonRefs.current[checklist.id] = { current: null };
                      }
                      return (
                        <>
                          <button
                            ref={el => typeButtonRefs.current[checklist.id].current = el}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTypeDropdown(showTypeDropdown === checklist.id ? null : checklist.id);
                            }}
                            className={`type-trigger p-1.5 rounded ${selectedType.color} hover:opacity-80 transition-opacity`}
                            title={selectedType.label}
                          >
                            <SelectedIcon className="w-4 h-4" />
                          </button>

                          <PortalDropdown
                            isOpen={showTypeDropdown === checklist.id}
                            anchorRef={typeButtonRefs.current[checklist.id]}
                            width={150}
                            onClose={() => setShowTypeDropdown(null)}
                          >
                            {TASK_TYPES.map(type => {
                              const Icon = type.icon;
                              return (
                                <button
                                  key={type.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateNewItemForm(checklist.id, { taskType: type.value });
                                    setShowTypeDropdown(null);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                    form.taskType === type.value ? 'bg-gray-50 dark:bg-gray-700' : ''
                                  }`}
                                >
                                  <div className={`p-1 rounded ${type.color}`}>
                                    <Icon className="w-3 h-3" />
                                  </div>
                                  <span className="text-gray-700 dark:text-gray-200">{type.label}</span>
                                </button>
                              );
                            })}
                          </PortalDropdown>
                        </>
                      );
                    })()}
                  </div>

                  {/* Title Input */}
                  <input
                    ref={el => newItemInputRefs.current[checklist.id] = el}
                    type="text"
                    value={getNewItemForm(checklist.id).title}
                    onChange={(e) => updateNewItemForm(checklist.id, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && getNewItemForm(checklist.id).title.trim()) {
                        e.preventDefault();
                        handleAddItem(checklist.id);
                      }
                    }}
                    placeholder="Descreva a tarefa..."
                    className="flex-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    disabled={savingItem === checklist.id}
                  />

                  {/* Due Date Selector */}
                  <div className="relative">
                    {(() => {
                      const form = getNewItemForm(checklist.id);
                      if (!dateButtonRefs.current[checklist.id]) {
                        dateButtonRefs.current[checklist.id] = { current: null };
                      }
                      return (
                        <>
                          <button
                            ref={el => dateButtonRefs.current[checklist.id].current = el}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowNewItemDateDropdown(showNewItemDateDropdown === checklist.id ? null : checklist.id);
                            }}
                            className={`date-trigger px-2 py-1 rounded transition-all flex items-center gap-1 text-xs ${
                              form.dueDate
                                ? getDueDateColor(form.dueDate)
                                : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={form.dueDate ? formatDate(form.dueDate) : 'Definir prazo'}
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            {form.dueDate && <span>{formatDate(form.dueDate)}</span>}
                          </button>

                          <PortalDropdown
                            isOpen={showNewItemDateDropdown === checklist.id}
                            anchorRef={dateButtonRefs.current[checklist.id]}
                            align="right"
                            width={200}
                            onClose={() => setShowNewItemDateDropdown(null)}
                          >
                            <div className="p-2">
                              {getQuickDates().map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateNewItemForm(checklist.id, { dueDate: opt.value });
                                    setShowNewItemDateDropdown(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                >
                                  {opt.label}
                                </button>
                              ))}
                              <div className="border-t my-1" />
                              <input
                                type="date"
                                className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                value={form.dueDate || ''}
                                onChange={(e) => {
                                  updateNewItemForm(checklist.id, { dueDate: e.target.value });
                                  setShowNewItemDateDropdown(null);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                              {form.dueDate && (
                                <>
                                  <div className="border-t my-1" />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateNewItemForm(checklist.id, { dueDate: null });
                                      setShowNewItemDateDropdown(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                                  >
                                    Remover prazo
                                  </button>
                                </>
                              )}
                            </div>
                          </PortalDropdown>
                        </>
                      );
                    })()}
                  </div>

                  {/* User Selector (Multiple) */}
                  <div className="relative">
                    {(() => {
                      const form = getNewItemForm(checklist.id);
                      const assignees = form.assignees || [];
                      if (!userButtonRefs.current[checklist.id]) {
                        userButtonRefs.current[checklist.id] = { current: null };
                      }
                      return (
                        <>
                          <button
                            ref={el => userButtonRefs.current[checklist.id].current = el}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowNewItemUserDropdown(showNewItemUserDropdown === checklist.id ? null : checklist.id);
                            }}
                            className={`user-trigger flex items-center transition-all ${
                              assignees.length > 0
                                ? ''
                                : 'w-7 h-7 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-purple-400 hover:text-purple-500 justify-center'
                            }`}
                            title={assignees.length > 0 ? assignees.map(a => a.name).join(', ') : 'Atribuir responsáveis'}
                          >
                            {assignees.length > 0 ? (
                              renderAssigneesAvatars(assignees, 2)
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </button>

                          <PortalDropdown
                            isOpen={showNewItemUserDropdown === checklist.id}
                            anchorRef={userButtonRefs.current[checklist.id]}
                            align="right"
                            width={220}
                            onClose={() => setShowNewItemUserDropdown(null)}
                          >
                            <div className="max-h-[250px] overflow-y-auto">
                              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                Selecione os responsáveis
                              </div>
                              {assignableUsers.map(user => {
                                const isSelected = assignees.some(a => a.id === user.id);
                                return (
                                  <button
                                    key={user.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNewItemAssignee(checklist.id, user);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                      isSelected ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                      isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300'
                                    }`}>
                                      {isSelected && <Check className="w-3 h-3" />}
                                    </div>
                                    {renderUserAvatar(user)}
                                    <span className="text-gray-700 dark:text-gray-200 flex-1 text-left">{user.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </PortalDropdown>
                        </>
                      );
                    })()}
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={() => handleAddItem(checklist.id)}
                    disabled={!getNewItemForm(checklist.id).title.trim() || savingItem === checklist.id}
                    className="p-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingItem === checklist.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Checklist */}
      {showNewChecklist ? (
        <form onSubmit={handleCreateChecklist} className="flex items-center gap-2">
          <input
            ref={newChecklistInputRef}
            type="text"
            value={newChecklistName}
            onChange={(e) => setNewChecklistName(e.target.value)}
            placeholder="Nome da checklist..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onBlur={() => {
              if (!newChecklistName.trim()) {
                setShowNewChecklist(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowNewChecklist(false);
                setNewChecklistName('');
              }
            }}
          />
          <button
            type="submit"
            disabled={!newChecklistName.trim()}
            className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            Criar
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewChecklist(false);
              setNewChecklistName('');
            }}
            className="px-3 py-2 text-gray-600 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowNewChecklist(true)}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors py-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar checklist
        </button>
      )}

      {/* Empty State */}
      {checklists.length === 0 && !showNewChecklist && (
        <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50/50 dark:bg-gray-800/30">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Nenhuma checklist ainda</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">Crie checklists para organizar as atividades</p>
          <button
            onClick={() => setShowNewChecklist(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar checklist
          </button>
        </div>
      )}
    </div>
  );
};

export default LeadChecklists;
