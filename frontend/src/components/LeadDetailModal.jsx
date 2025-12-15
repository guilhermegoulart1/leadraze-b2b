import React, { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import {
  X,
  Building,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  MessageCircle,
  Send,
  Clock,
  Calendar,
  User,
  Users,
  UserCheck,
  Crown,
  Star,
  Tag,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  Languages,
  Globe,
  ExternalLink,
  ChevronDown,
  AtSign,
  Smile,
  ArrowRight,
  MessageSquare,
  Target,
  Zap,
  UserCircle,
  RefreshCw,
  UserPlus,
  CheckSquare,
  Plus,
  Check,
  Flag,
  Loader,
  List,
  Package,
  RotateCcw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import MentionTextarea from './MentionTextarea';
import TaskModal from './TaskModal';
import LeadChecklists from './LeadChecklists';
import LocationMiniMap from './LocationMiniMap';
import WinDealModal from './WinDealModal';
import DiscardLeadModal from './DiscardLeadModal';

// Helper functions for dynamic Tailwind classes
const getStageClasses = (color) => {
  const colorMap = {
    slate: 'bg-slate-100 dark:bg-slate-900/20 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900/30',
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30',
    amber: 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30',
    purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/30',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/30',
    red: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30'
  };
  return colorMap[color] || colorMap.slate;
};

const getStatusDotClasses = (color) => {
  const colorMap = {
    slate: 'w-2 h-2 rounded-full bg-slate-500',
    blue: 'w-2 h-2 rounded-full bg-blue-500',
    amber: 'w-2 h-2 rounded-full bg-amber-500',
    purple: 'w-2 h-2 rounded-full bg-purple-500',
    emerald: 'w-2 h-2 rounded-full bg-emerald-500',
    red: 'w-2 h-2 rounded-full bg-red-500'
  };
  return colorMap[color] || colorMap.slate;
};

const LeadDetailModal = ({ lead, onClose, onNavigateToConversation, onLeadUpdated, onViewContact }) => {
  const { t } = useTranslation(['leads', 'contacts']);
  const [activeTab, setActiveTab] = useState('details'); // details | contact | comments | tasks
  const [activeChannel, setActiveChannel] = useState(null);
  const [conversations, setConversations] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead?.status || 'leads');
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [currentSource, setCurrentSource] = useState(lead?.source || 'linkedin');
  const [showWinDealModal, setShowWinDealModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const messagesEndRef = useRef(null);

  // Sync currentStatus when lead prop changes
  useEffect(() => {
    setCurrentStatus(lead?.status || 'leads');
  }, [lead?.status]);

  // Sync currentSource when lead prop changes
  useEffect(() => {
    setCurrentSource(lead?.source || 'linkedin');
  }, [lead?.source]);

  // Responsible assignment states
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [currentResponsible, setCurrentResponsible] = useState({
    id: lead?.responsible_id || null,
    name: lead?.responsible_name || null,
    avatar: lead?.responsible_avatar || null
  });
  const [assigningUser, setAssigningUser] = useState(false);

  // Editable fields states
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(lead?.phone || '');
  const [savingPhone, setSavingPhone] = useState(false);

  // Tags states
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagColor, setNewTagColor] = useState('purple');
  const [leadTags, setLeadTags] = useState(lead?.tags || []);
  const tagsDropdownRef = useRef(null);

  // Tag color options
  const TAG_COLORS = [
    { value: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
    { value: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
    { value: 'green', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    { value: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
    { value: 'red', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
    { value: 'pink', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400' },
    { value: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
    { value: 'gray', bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-400' },
  ];

  // Sync currentResponsible when lead prop changes
  useEffect(() => {
    setCurrentResponsible({
      id: lead?.responsible_id || null,
      name: lead?.responsible_name || null,
      avatar: lead?.responsible_avatar || null
    });
  }, [lead?.responsible_id, lead?.responsible_name, lead?.responsible_avatar]);

  // Sync phone when lead prop changes
  useEffect(() => {
    setPhoneValue(lead?.phone || '');
  }, [lead?.phone]);

  // Sync tags when lead prop changes
  useEffect(() => {
    setLeadTags(lead?.tags || []);
  }, [lead?.tags]);

  // Load available tags when dropdown opens
  useEffect(() => {
    if (showTagsDropdown) {
      loadAvailableTags();
    }
  }, [showTagsDropdown]);

  // Close tags dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(event.target)) {
        setShowTagsDropdown(false);
        setNewTagInput('');
        setNewTagColor('purple');
      }
    };

    if (showTagsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showTagsDropdown]);

  // Pipeline stages
  const pipelineStages = {
    leads: { label: 'Prospecção', color: 'slate' },
    invite_sent: { label: 'Convite', color: 'blue' },
    qualifying: { label: 'Qualificação', color: 'amber' },
    accepted: { label: 'Em Andamento', color: 'purple' },
    qualified: { label: 'Ganho', color: 'emerald' },
    discarded: { label: 'Descartado', color: 'red' }
  };

  // Available channels - matching conversation colors
  const channelConfig = {
    linkedin: {
      icon: Linkedin,
      label: 'LinkedIn',
      color: 'text-[#0A66C2]',
      bg: 'bg-[#0A66C2]/10',
      activeBg: 'bg-[#0A66C2]/20',
      border: 'border-[#0A66C2]/30',
      messageBg: 'bg-[#0A66C2]'
    },
    whatsapp: {
      icon: MessageCircle,
      label: 'WhatsApp',
      color: 'text-[#25D366]',
      bg: 'bg-[#25D366]/10',
      activeBg: 'bg-[#25D366]/20',
      border: 'border-[#25D366]/30',
      messageBg: 'bg-[#25D366]'
    },
    email: {
      icon: Mail,
      label: 'Email',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      activeBg: 'bg-purple-100',
      border: 'border-purple-200',
      messageBg: 'bg-purple-600'
    }
  };

  useEffect(() => {
    if (lead) {
      loadConversations();
      loadComments();
      loadTasks();
      loadAssignableUsers();
    }
  }, [lead?.id]); // Only reload when lead ID changes, not when lead object reference changes

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target) && !event.target.closest('button[type="button"]')) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const loadAssignableUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.getAssignableUsers(lead.sector_id);
      if (response.success) {
        setAssignableUsers(response.data.users || []);
      }
    } catch (error) {
      console.error('Error loading assignable users:', error);
      setAssignableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAssignResponsible = async (userId) => {
    try {
      setAssigningUser(true);
      const response = await api.assignLead(lead.id, userId);
      if (response.success) {
        const responsible = response.data.responsible;
        setCurrentResponsible({
          id: responsible?.id || userId,
          name: responsible?.name || null,
          avatar: responsible?.avatar_url || null
        });
        setShowResponsibleDropdown(false);
        // Notify parent to refresh
        onLeadUpdated?.();
      }
    } catch (error) {
      console.error('Error assigning responsible:', error);
    } finally {
      setAssigningUser(false);
    }
  };

  const handleRemoveResponsible = async () => {
    try {
      setAssigningUser(true);
      const response = await api.assignLead(lead.id, null);
      if (response.success) {
        setCurrentResponsible({ id: null, name: null, avatar: null });
        setShowResponsibleDropdown(false);
        onLeadUpdated?.();
      }
    } catch (error) {
      console.error('Error removing responsible:', error);
    } finally {
      setAssigningUser(false);
    }
  };

  const handleAutoAssign = async () => {
    try {
      setAssigningUser(true);
      const response = await api.autoAssignLead(lead.id);
      if (response.success) {
        const responsible = response.data.responsible;
        setCurrentResponsible({
          id: responsible?.id,
          name: responsible?.name,
          avatar: responsible?.avatar_url
        });
        setShowResponsibleDropdown(false);
        onLeadUpdated?.();
      }
    } catch (error) {
      console.error('Error auto-assigning:', error);
      alert('Erro ao atribuir automaticamente. Round-robin pode não estar ativo neste setor.');
    } finally {
      setAssigningUser(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeChannel]);

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);

      // Load real conversations from API
      const response = await api.getConversations({ lead_id: lead.id });

      if (response.success) {
        // Group messages by channel
        const grouped = {
          linkedin: [],
          whatsapp: [],
          email: []
        };

        // For each conversation, load its messages
        const conversationsList = response.data.conversations || [];

        for (const conv of conversationsList) {
          try {
            // Get messages for this conversation
            const messagesResponse = await api.getMessages(conv.id, { limit: 100 });

            if (messagesResponse.success && messagesResponse.data) {
              const messages = messagesResponse.data.messages || messagesResponse.data;

              // Map messages to the format needed
              const formattedMessages = messages.map(msg => ({
                id: msg.id,
                type: msg.sender_type === 'user' ? 'outbound' : 'inbound',
                content: msg.content,
                timestamp: msg.created_at || msg.timestamp || msg.sent_at,
                status: 'sent'
              }));

              // Group by channel (for now, assuming LinkedIn)
              grouped.linkedin.push(...formattedMessages);
            }
          } catch (msgError) {
            console.error(`Error loading messages for conversation ${conv.id}:`, msgError);
          }
        }

        setConversations(grouped);

        // Set first available channel as active
        const channelsWithMessages = Object.entries(grouped)
          .filter(([_, msgs]) => msgs.length > 0)
          .map(([channel]) => channel);

        if (channelsWithMessages.length > 0) {
          setActiveChannel(channelsWithMessages[0]);
        }
      }

    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations({
        linkedin: [],
        whatsapp: [],
        email: []
      });
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const response = await api.getLeadComments(lead.id);
      if (response.success) {
        setComments(response.data.comments);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const loadTasks = async () => {
    try {
      setLoadingTasks(true);
      const response = await api.getLeadTasks(lead.id);
      if (response.success) {
        setTasks(response.data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await api.completeTask(taskId);
      if (response.success) {
        setTasks(prev => prev.map(task =>
          task.id === taskId
            ? { ...task, status: 'completed', completedAt: new Date().toISOString() }
            : task
        ));
      }
    } catch (error) {
      console.error('Error completing task:', error);
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

  const handleTaskSaved = () => {
    loadTasks();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'cancelled': return 'text-gray-400 bg-gray-50';
      default: return 'text-amber-600 bg-amber-50';
    }
  };

  const formatDueDate = (date) => {
    if (!date) return null;
    const dueDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDate < today) {
      return { label: 'Atrasada', color: 'text-red-600' };
    } else if (dueDate.toDateString() === today.toDateString()) {
      return { label: 'Hoje', color: 'text-amber-600' };
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      return { label: 'Amanhã', color: 'text-blue-600' };
    }
    return { label: dueDate.toLocaleDateString('pt-BR'), color: 'text-gray-600' };
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChannel) return;

    setConversations(prev => ({
      ...prev,
      [activeChannel]: [
        ...prev[activeChannel],
        {
          id: Date.now(),
          type: 'outbound',
          content: newMessage,
          timestamp: new Date(),
          status: 'sending'
        }
      ]
    }));

    setNewMessage('');
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await api.createLeadComment(lead.id, {
        content: newComment,
        mentions: commentMentions
      });

      if (response.success) {
        // Add new comment to the list
        setComments(prev => [response.data.comment, ...prev]);
        setNewComment('');
        setCommentMentions([]);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setShowStatusDropdown(false);

    // If moving to 'qualified' (won), show Win Deal modal
    if (newStatus === 'qualified' && currentStatus !== 'qualified') {
      setShowWinDealModal(true);
      return;
    }

    // If moving to 'discarded', show Discard modal
    if (newStatus === 'discarded' && currentStatus !== 'discarded') {
      setShowDiscardModal(true);
      return;
    }

    setCurrentStatus(newStatus);

    try {
      await api.updateLeadStatus(lead.id, newStatus);
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, status: newStatus });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setCurrentStatus(lead.status);
    }
  };

  const handleReactivate = async () => {
    if (reactivating) return;

    setReactivating(true);
    try {
      const response = await api.reactivateLead(lead.id);
      if (response.success) {
        const newStatus = response.data.status || 'leads';
        setCurrentStatus(newStatus);
        if (onLeadUpdated) {
          onLeadUpdated({ ...lead, status: newStatus });
        }
      }
    } catch (error) {
      console.error('Error reactivating lead:', error);
    } finally {
      setReactivating(false);
    }
  };

  const handleSourceChange = async (newSource) => {
    setCurrentSource(newSource);
    setShowSourceDropdown(false);

    try {
      await api.updateLead(lead.id, { source: newSource });
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, source: newSource });
      }
    } catch (error) {
      console.error('Error updating source:', error);
      setCurrentSource(lead.source);
    }
  };

  const handleSavePhone = async () => {
    if (!phoneValue.trim()) {
      setEditingPhone(false);
      return;
    }

    try {
      setSavingPhone(true);
      await api.updateLead(lead.id, { phone: phoneValue });

      // Update lead data
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, phone: phoneValue });
      }

      setEditingPhone(false);
    } catch (error) {
      console.error('Error updating phone:', error);
      setPhoneValue(lead.phone || '');
    } finally {
      setSavingPhone(false);
    }
  };

  const handlePhoneKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSavePhone();
    } else if (e.key === 'Escape') {
      setPhoneValue(lead.phone || '');
      setEditingPhone(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      setLoadingTags(true);
      const response = await api.getTags();
      if (response.success) {
        setAvailableTags(response.data.tags || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      setAvailableTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleAddTag = async (tag) => {
    try {
      // Check if tag already exists on lead
      const tagExists = leadTags.some(t => (t.name || t) === (tag.name || tag));
      if (tagExists) return;

      // Optimistic update - add tag immediately to UI
      const updatedTags = [...leadTags, tag];
      setLeadTags(updatedTags);

      // Update parent list without reloading modal
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, tags: updatedTags });
      }

      // Send to backend in background
      await api.addTagToLead(lead.id, tag.id || tag.name);
    } catch (error) {
      console.error('Error adding tag:', error);
      // Rollback on error
      setLeadTags(leadTags);
    }
  };

  const handleRemoveTag = async (tag) => {
    try {
      // Optimistic update - remove tag immediately from UI
      const updatedTags = leadTags.filter(t => t.id !== tag.id);
      setLeadTags(updatedTags);

      // Update parent list without reloading modal
      if (onLeadUpdated) {
        onLeadUpdated({ ...lead, tags: updatedTags });
      }

      // Send to backend in background
      await api.removeTagFromLead(lead.id, tag.id);
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const getTagColorClasses = (colorValue) => {
    const color = TAG_COLORS.find(c => c.value === colorValue) || TAG_COLORS[0];
    return { bg: color.bg, text: color.text };
  };

  const handleCreateAndAddTag = async () => {
    if (!newTagInput.trim()) return;

    try {
      // Create new tag with color
      const response = await api.createTag({
        name: newTagInput.trim(),
        color: newTagColor
      });

      if (response.success) {
        const newTag = response.data.tag;

        // Add to available tags
        setAvailableTags(prev => [...prev, newTag]);

        // Add to lead
        await handleAddTag(newTag);

        setNewTagInput('');
        setNewTagColor('purple');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleNewTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateAndAddTag();
    }
  };

  const formatTimestamp = (date) => {
    if (!date) return '';

    const timestamp = new Date(date);

    // Verificar se a data é válida
    if (isNaN(timestamp.getTime())) {
      return '';
    }

    const now = new Date();
    const diff = now - timestamp;
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
      return timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ontem';
    } else if (days < 7) {
      return `${days} dias atrás`;
    }
    return timestamp.toLocaleDateString('pt-BR');
  };

  const linkifyText = (text) => {
    if (!text) return text;

    // Regex mais abrangente para detectar URLs
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?)/gi;

    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex index
    urlRegex.lastIndex = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];

      // Verificar se não é parte de um email
      const textBefore = text.substring(Math.max(0, match.index - 1), match.index);
      if (textBefore === '@') {
        continue;
      }

      // Adicionar texto antes do link
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Determinar o href correto
      let href;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        href = url;
      } else if (url.startsWith('www.')) {
        href = `https://${url}`;
      } else {
        href = `https://${url}`;
      }

      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    // Adicionar o texto restante
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  if (!lead) return null;

  const stage = pipelineStages[currentStatus] || pipelineStages.leads;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl dark:shadow-gray-900/50 w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Purple like the app */}
        <div className="flex-shrink-0 bg-[#7229f7] text-white">
          <div className="px-6 py-4">
            <div className="flex items-start justify-between">
              {/* Lead Info */}
              <div className="flex items-start gap-4">
                {/* Avatar */}
                {lead.profile_picture ? (
                  <img
                    src={lead.profile_picture}
                    alt={lead.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-bold border-2 border-white/30">
                    {lead.name?.charAt(0) || '?'}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{lead.name}</h2>
                    {/* Badges */}
                    {lead.is_premium && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-400/20 border border-amber-400/40 rounded-full">
                        <Crown className="w-3 h-3 text-amber-300" />
                        <span className="text-amber-200 text-xs font-medium">Premium</span>
                      </div>
                    )}
                    {lead.is_creator && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-400/20 border border-blue-400/40 rounded-full">
                        <Star className="w-3 h-3 text-blue-300" />
                        <span className="text-blue-200 text-xs font-medium">Creator</span>
                      </div>
                    )}
                  </div>

                  {lead.title && (
                    <p className="text-sm text-purple-100 mt-0.5">{lead.title}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-sm text-purple-200">
                    {lead.company && (
                      <span className="flex items-center gap-1">
                        <Building className="w-3.5 h-3.5" />
                        {lead.company}
                      </span>
                    )}
                    {lead.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {lead.location}
                      </span>
                    )}
                  </div>

                  {/* Business Category and Rating */}
                  <div className="flex items-center gap-3 mt-2 text-sm text-purple-200">
                    {lead.business_category && (
                      <span className="flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        {lead.business_category}
                      </span>
                    )}
                    {(lead.rating || lead.review_count > 0) && (
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                        {lead.rating && <span>{lead.rating}</span>}
                        {lead.review_count > 0 && <span>({lead.review_count})</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Details/Profile/Comments */}
          <div className="w-[60%] border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-800">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'details'
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'contact'
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Contato
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'comments'
                      ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Comentários
                  {comments.length > 0 && (
                    <span className="text-gray-600 dark:text-gray-300 text-xs rounded-full">
                      {comments.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'details' && (
                <div className="p-6">
                  {/* Status Section - ClickUp Style */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 pb-5 border-b border-gray-200 dark:border-gray-700">
                    {/* Status */}
                    <div className="flex items-center gap-2.5">
                      <Target className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Status</span>
                      <div className="flex-1 relative">
                        <button
                          onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${getStageClasses(stage.color)}`}
                        >
                          {stage.label}
                          <ChevronDown className="w-3 h-3" />
                        </button>

                        {showStatusDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 py-1 z-10 min-w-[180px]">
                            {Object.entries(pipelineStages).map(([key, value]) => (
                              <button
                                key={key}
                                onClick={() => handleStatusChange(key)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                  currentStatus === key ? 'bg-gray-50 dark:bg-gray-700' : ''
                                }`}
                              >
                                <span className={getStatusDotClasses(value.color)} />
                                {value.label}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Botão Reativar quando status é discarded */}
                        {currentStatus === 'discarded' && (
                          <button
                            onClick={handleReactivate}
                            disabled={reactivating}
                            className="ml-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-50"
                            title={t('discard.reactivate', 'Reativar Lead')}
                          >
                            {reactivating ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            {t('discard.reactivate', 'Reativar')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Responsável */}
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Responsável</span>
                      <div className="flex-1 relative">
                        <button
                          onClick={() => setShowResponsibleDropdown(!showResponsibleDropdown)}
                          className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium"
                          disabled={assigningUser}
                        >
                          {currentResponsible.name ? (
                            <>
                              {currentResponsible.avatar ? (
                                <img
                                  src={
                                    currentResponsible.avatar.startsWith('http')
                                      ? `${currentResponsible.avatar}?v=${Date.now()}`
                                      : currentResponsible.avatar
                                  }
                                  alt={currentResponsible.name}
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                                    {(() => {
                                      const names = (currentResponsible.name || '').trim().split(' ').filter(n => n.length > 0);
                                      if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                                      return (names[0][0] + names[1][0]).toUpperCase();
                                    })()}
                                  </span>
                                </div>
                              )}
                              <span className="text-gray-900 dark:text-gray-100">
                                {(() => {
                                  const names = (currentResponsible.name || '').trim().split(' ').filter(n => n.length > 0);
                                  if (names.length === 1) return names[0];
                                  return `${names[0]} ${names[1][0]}.`;
                                })()}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Atribuir</span>
                          )}
                          <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500 ml-auto" />
                        </button>

                        {showResponsibleDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 z-20 w-64 max-h-64 overflow-y-auto">
                            <div className="p-2 space-y-1">
                              {/* Auto-assign option */}
                              <button
                                onClick={handleAutoAssign}
                                disabled={assigningUser}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm text-purple-600 dark:text-purple-400 transition-colors"
                              >
                                <RefreshCw className={`w-4 h-4 flex-shrink-0 ${assigningUser ? 'animate-spin' : ''}`} />
                                <span className="flex-1 text-left">Atribuir automaticamente</span>
                              </button>

                              {/* Remove assignment if has one */}
                              {currentResponsible.id && (
                                <button
                                  onClick={handleRemoveResponsible}
                                  disabled={assigningUser}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 transition-colors"
                                >
                                  <X className="w-4 h-4 flex-shrink-0" />
                                  <span className="flex-1 text-left">Remover atribuição</span>
                                </button>
                              )}

                              {(currentResponsible.id || !loadingUsers) && <div className="border-t border-gray-200 dark:border-gray-700 my-1" />}

                              {/* Users list */}
                              {loadingUsers ? (
                                <div className="flex items-center justify-center py-4">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                                </div>
                              ) : assignableUsers.length === 0 ? (
                                <div className="text-gray-500 dark:text-gray-400 text-center text-sm py-2">
                                  Nenhum usuário disponível
                                </div>
                              ) : (
                                assignableUsers.map((user) => {
                                  const isSelected = currentResponsible.id === (user.id || user.user_id);
                                  return (
                                    <button
                                      key={user.id || user.user_id}
                                      onClick={() => handleAssignResponsible(user.id || user.user_id)}
                                      disabled={assigningUser}
                                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                        isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                                      }`}
                                    >
                                      <div className="flex-shrink-0">
                                        {user.avatar_url ? (
                                          <img
                                            src={
                                              user.avatar_url.startsWith('http')
                                                ? `${user.avatar_url}?v=${user.updated_at || Date.now()}`
                                                : user.avatar_url
                                            }
                                            alt={user.name}
                                            className="w-6 h-6 rounded-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                              {(() => {
                                                const names = (user.name || '').trim().split(' ').filter(n => n.length > 0);
                                                if (names.length === 1) return names[0].substring(0, 2).toUpperCase();
                                                return names.length >= 2 ? (names[0][0] + names[1][0]).toUpperCase() : '?';
                                              })()}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 text-left">{user.name}</span>
                                      {isSelected && (
                                        <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Campanha */}
                    {lead.campaign_name && (
                      <div className="flex items-center gap-2.5">
                        <Zap className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Campanha</span>
                        <span className="flex-1 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-md">
                          {lead.campaign_name}
                        </span>
                      </div>
                    )}

                    {/* Data de criação */}
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Data</span>
                      <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                        {new Date(lead.created_at).toLocaleDateString('pt-BR')} às {new Date(lead.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Conexões */}
                    {lead.connections_count > 0 && (
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Conexões</span>
                        <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {lead.connections_count.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Seguidores */}
                    {lead.follower_count > 0 && (
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Seguidores</span>
                        <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {lead.follower_count.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Email */}
                    {lead.email && (
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Email</span>
                        <a href={`mailto:${lead.email}`} className="flex-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium truncate">
                          {lead.email}
                        </a>
                      </div>
                    )}

                    {/* Telefone */}
                    {lead.phone && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Telefone</span>
                        <a href={`tel:${lead.phone}`} className="flex-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium">
                          {lead.phone}
                        </a>
                      </div>
                    )}

                    {/* Source / Fonte */}
                    <div className="flex items-start gap-2.5">
                      <Flag className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide mt-0.5">Fonte</span>
                      <div className="flex-1 relative">
                        <button
                          onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                          className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700 px-2.5 py-1.5 rounded-md transition-colors text-xs font-medium text-gray-900 dark:text-gray-100 w-full"
                        >
                          {(() => {
                            const sourceConfig = {
                              linkedin: { icon: Linkedin, label: 'LinkedIn' },
                              google_maps: { icon: MapPin, label: 'Google Maps' },
                              list: { icon: List, label: 'Lista' },
                              paid_traffic: { icon: Zap, label: 'Tráfego Pago' },
                              other: { icon: Package, label: 'Outro' }
                            };
                            const config = sourceConfig[currentSource] || sourceConfig.linkedin;
                            const SourceIcon = config.icon;
                            return (
                              <>
                                <SourceIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="flex-1 text-left">{config.label}</span>
                                <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                              </>
                            );
                          })()}
                        </button>

                        {showSourceDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 py-1 z-10 min-w-[200px]">
                            {[
                              { value: 'linkedin', icon: Linkedin, label: 'LinkedIn' },
                              { value: 'google_maps', icon: MapPin, label: 'Google Maps' },
                              { value: 'list', icon: List, label: 'Lista' },
                              { value: 'paid_traffic', icon: Zap, label: 'Tráfego Pago' },
                              { value: 'other', icon: Package, label: 'Outro' }
                            ].map((source) => {
                              const SourceIcon = source.icon;
                              return (
                                <button
                                  key={source.value}
                                  onClick={() => handleSourceChange(source.value)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                    currentSource === source.value ? 'bg-gray-50 dark:bg-gray-700' : ''
                                  }`}
                                >
                                  <SourceIcon className="w-4 h-4" />
                                  <span className="flex-1 text-left">{source.label}</span>
                                  {currentSource === source.value && (
                                    <Check className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* LinkedIn */}
                    {lead.public_identifier && (
                      <div className="flex items-center gap-2.5">
                        <Linkedin className="w-4 h-4 text-[#0A66C2] flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">LinkedIn</span>
                        <a
                          href={`https://linkedin.com/in/${lead.public_identifier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-xs text-[#0A66C2] hover:underline font-medium flex items-center gap-1 truncate"
                        >
                          {lead.public_identifier}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                    )}

                    {/* Etiquetas */}
                    <div className="flex items-start gap-2.5">
                      <Tag className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide mt-0.5">Etiquetas</span>
                      <div className="flex-1 relative" ref={tagsDropdownRef}>
                        <div className="flex flex-wrap gap-1">
                          {leadTags.map((tag, idx) => {
                            const colorClasses = getTagColorClasses(tag.color || 'purple');
                            return (
                              <span
                                key={idx}
                                className={`px-1.5 py-0.5 ${colorClasses.bg} ${colorClasses.text} text-xs font-medium rounded flex items-center gap-1`}
                              >
                                {tag.name || tag}
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="hover:opacity-70"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                          <button
                            onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 font-medium"
                          >
                            + Adicionar
                          </button>
                        </div>

                        {/* Tags Dropdown */}
                        {showTagsDropdown && (
                          <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 z-50 max-h-64 overflow-y-auto">
                            {/* Input para criar nova tag */}
                            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                              <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={handleNewTagKeyDown}
                                placeholder="Pesquise ou adicione tags..."
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>

                            {/* Lista de tags disponíveis */}
                            {loadingTags ? (
                              <div className="p-3 text-center text-sm text-gray-500 dark:text-gray-400">
                                Carregando tags...
                              </div>
                            ) : (
                              <div className="py-1">
                                {availableTags
                                  .filter(tag => {
                                    // Filtrar por busca
                                    const searchMatch = !newTagInput ||
                                      (tag.name || '').toLowerCase().includes(newTagInput.toLowerCase());
                                    // Não mostrar tags já adicionadas
                                    const notAdded = !leadTags.some(t => (t.id || t.name) === (tag.id || tag.name));
                                    return searchMatch && notAdded;
                                  })
                                  .map((tag) => {
                                    const colorClasses = getTagColorClasses(tag.color || 'purple');
                                    return (
                                      <button
                                        key={tag.id}
                                        onClick={() => {
                                          handleAddTag(tag);
                                          setNewTagInput('');
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                      >
                                        <span className={`px-2 py-0.5 ${colorClasses.bg} ${colorClasses.text} text-[11px] font-medium rounded`}>
                                          {tag.name}
                                        </span>
                                      </button>
                                    );
                                  })}

                                {/* Criar nova tag */}
                                {newTagInput && !availableTags.some(t => t.name.toLowerCase() === newTagInput.toLowerCase()) && (
                                  <div className="border-t border-gray-200 dark:border-gray-700 p-2 space-y-2">
                                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                      Criar nova etiqueta "{newTagInput}"
                                    </div>
                                    <div className="grid grid-cols-4 gap-1">
                                      {TAG_COLORS.map((color) => {
                                        const colorClasses = getTagColorClasses(color.value);
                                        return (
                                          <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => setNewTagColor(color.value)}
                                            className={`p-1.5 rounded text-[10px] font-medium transition-all ${colorClasses.bg} ${colorClasses.text} ${
                                              newTagColor === color.value
                                                ? 'ring-2 ring-purple-500 ring-offset-1'
                                                : 'opacity-70 hover:opacity-100'
                                            }`}
                                          >
                                            {color.value}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button
                                      onClick={handleCreateAndAddTag}
                                      className="w-full px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                                    >
                                      Criar e Adicionar
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {lead.about && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sobre</h3>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed pl-6">
                        {lead.about}
                      </p>
                      <button
                        onClick={() => setActiveTab('contact')}
                        className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline mt-2 ml-6 inline-flex items-center gap-1 font-medium"
                      >
                        Ver mais
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Checklists */}
                  <div className="mt-5 pt-5">
                    <LeadChecklists leadId={lead?.id} sectorId={lead?.sector_id} />
                  </div>
                </div>
              )}

              {activeTab === 'contact' && (
                <div className="p-6">
                  {/* Contact Info Section - Compact Style */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 pb-5 border-b border-gray-200 dark:border-gray-700">
                    {lead.name && (
                      <div className="flex items-center gap-2.5">
                        <UserCircle className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Nome</span>
                        <span className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                          {lead.name}
                        </span>
                      </div>
                    )}

                    {lead.email && (
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Email</span>
                        <a href={`mailto:${lead.email}`} className="flex-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium truncate">
                          {lead.email}
                        </a>
                      </div>
                    )}

                    {(lead.phone || editingPhone) && (
                      <div className="flex items-center gap-2.5">
                        <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Telefone</span>
                        {editingPhone ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="tel"
                              value={phoneValue}
                              onChange={(e) => setPhoneValue(e.target.value)}
                              onKeyDown={handlePhoneKeyDown}
                              onBlur={handleSavePhone}
                              autoFocus
                              disabled={savingPhone}
                              className="flex-1 px-2 py-0.5 text-xs bg-white dark:bg-gray-700 border border-purple-300 dark:border-purple-600 rounded text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            {savingPhone && <Loader className="w-3 h-3 animate-spin text-purple-600" />}
                          </div>
                        ) : (
                          <span
                            onClick={() => setEditingPhone(true)}
                            className="flex-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium cursor-pointer"
                          >
                            {phoneValue || 'Adicionar telefone'}
                          </span>
                        )}
                      </div>
                    )}

                    {lead.title && (
                      <div className="flex items-center gap-2.5">
                        <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Cargo</span>
                        <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                          {lead.title}
                        </span>
                      </div>
                    )}

                    {lead.company && (
                      <div className="flex items-center gap-2.5">
                        <Building className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Empresa</span>
                        <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                          {lead.company}
                        </span>
                      </div>
                    )}

                    {/* Structured Address */}
                    {(lead.city || lead.state || lead.country || lead.postal_code) ? (
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide block mb-1">Localização</span>
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            {lead.city && (
                              <div><span className="text-gray-500 dark:text-gray-400">{t('contacts:city', 'Cidade')}:</span> <span className="text-gray-700 dark:text-gray-300">{lead.city}</span></div>
                            )}
                            {lead.state && (
                              <div><span className="text-gray-500 dark:text-gray-400">{t('contacts:state', 'Estado')}:</span> <span className="text-gray-700 dark:text-gray-300">{lead.state}</span></div>
                            )}
                            {lead.country && (
                              <div><span className="text-gray-500 dark:text-gray-400">{t('contacts:country', 'País')}:</span> <span className="text-gray-700 dark:text-gray-300">{lead.country}</span></div>
                            )}
                            {lead.postal_code && (
                              <div><span className="text-gray-500 dark:text-gray-400">{t('contacts:postalCode', 'CEP')}:</span> <span className="text-gray-700 dark:text-gray-300">{lead.postal_code}</span></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : lead.location && (
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Localização</span>
                        <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                          {lead.location}
                        </span>
                      </div>
                    )}

                    {/* Mini Map */}
                    {(lead.latitude && lead.longitude) && (
                      <div className="mt-3">
                        <LocationMiniMap
                          latitude={lead.latitude}
                          longitude={lead.longitude}
                          height={200}
                        />
                      </div>
                    )}

                    {/* Website Button */}
                    {lead.website && (
                      <div className="mt-3">
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {t('contacts:visitWebsite', 'Visitar Site')}
                        </a>
                      </div>
                    )}

                    {/* Opening Hours */}
                    {lead.opening_hours && (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            {t('contacts:openingHours', 'Horário de Funcionamento')}
                          </span>
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 pl-6">
                          {typeof lead.opening_hours === 'string'
                            ? lead.opening_hours
                            : Array.isArray(lead.opening_hours)
                              ? lead.opening_hours.join('\n')
                              : JSON.stringify(lead.opening_hours, null, 2)}
                        </div>
                      </div>
                    )}

                    {lead.industry && (
                      <div className="flex items-center gap-2.5">
                        <Building className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Indústria</span>
                        <span className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                          {lead.industry}
                        </span>
                      </div>
                    )}

                    {lead.public_identifier && (
                      <div className="flex items-center gap-2.5">
                        <Linkedin className="w-4 h-4 text-[#0A66C2] flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">LinkedIn</span>
                        <a
                          href={`https://linkedin.com/in/${lead.public_identifier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-xs text-[#0A66C2] hover:underline font-medium flex items-center gap-1 truncate"
                        >
                          {lead.public_identifier}
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>
                    )}

                    {lead.connections_count > 0 && (
                      <div className="flex items-center gap-2.5">
                        <Users className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Conexões</span>
                        <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {lead.connections_count.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {lead.follower_count > 0 && (
                      <div className="flex items-center gap-2.5">
                        <UserCheck className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 uppercase tracking-wide">Seguidores</span>
                        <span className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {lead.follower_count.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* About */}
                  {lead.about && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sobre</h3>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line leading-relaxed pl-6">
                        {lead.about}
                      </p>
                    </div>
                  )}

                  {/* Company Intelligence (GPT Analysis) */}
                  {(lead.company_description || lead.company_services || lead.pain_points) && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-4 h-4 text-purple-500" />
                        <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                          {t('modal.companyIntelligence')}
                        </h3>
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                          IA
                        </span>
                      </div>

                      {/* Company Description */}
                      {lead.company_description && (
                        <div className="pl-6 mb-4">
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                            {lead.company_description}
                          </p>
                        </div>
                      )}

                      {/* Services */}
                      {lead.company_services && Array.isArray(lead.company_services) && lead.company_services.length > 0 && (
                        <div className="pl-6 mb-4">
                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">{t('modal.services')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {lead.company_services.map((service, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full"
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pain Points */}
                      {lead.pain_points && Array.isArray(lead.pain_points) && lead.pain_points.length > 0 && (
                        <div className="pl-6">
                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {t('modal.painPoints')}
                          </p>
                          <div className="space-y-1.5">
                            {lead.pain_points.map((pain, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg"
                              >
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>{pain}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Team Members */}
                  {lead.team_members && Array.isArray(lead.team_members) && lead.team_members.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <h3 className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                          {t('contacts:team.title', 'Equipe')} ({lead.team_members.length})
                        </h3>
                      </div>
                      <div className="space-y-2 pl-6">
                        {lead.team_members.map((member, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
                              {member.role && (
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">{member.role}</div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {member.email && (
                                  <a href={`mailto:${member.email}`} className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline">
                                    {member.email}
                                  </a>
                                )}
                                {member.linkedin && (
                                  <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#0A66C2] hover:underline flex items-center gap-0.5">
                                    <Linkedin className="w-3 h-3" />
                                    LinkedIn
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Multiple Contacts Data (emails, phones, social links) */}
                  {(lead.contact_emails?.length > 0 || lead.contact_phones?.length > 0 || (lead.contact_social_links && Object.keys(lead.contact_social_links).length > 0)) && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                          {t('modal.contactChannels', 'Canais de Contato')}
                        </h3>
                      </div>

                      {/* Multiple Emails */}
                      {lead.contact_emails && Array.isArray(lead.contact_emails) && lead.contact_emails.length > 0 && (
                        <div className="pl-6 mb-4">
                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            Emails ({lead.contact_emails.length})
                          </p>
                          <div className="space-y-1.5">
                            {lead.contact_emails.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <a
                                  href={`mailto:${item.email}`}
                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {item.email}
                                </a>
                                {item.type && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    item.type === 'personal' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    item.type === 'commercial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                  }`}>
                                    {item.type}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Multiple Phones */}
                      {lead.contact_phones && Array.isArray(lead.contact_phones) && lead.contact_phones.length > 0 && (
                        <div className="pl-6 mb-4">
                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            Telefones ({lead.contact_phones.length})
                          </p>
                          <div className="space-y-1.5">
                            {lead.contact_phones.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <a
                                  href={`tel:${item.phone}`}
                                  className="text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600"
                                >
                                  {item.phone}
                                </a>
                                {item.type && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    item.type === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    item.type === 'mobile' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                  }`}>
                                    {item.type === 'whatsapp' ? 'WhatsApp' : item.type === 'mobile' ? 'Celular' : 'Fixo'}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Social Links */}
                      {lead.contact_social_links && Object.keys(lead.contact_social_links).length > 0 && (
                        <div className="pl-6">
                          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            Redes Sociais
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(lead.contact_social_links).map(([network, url]) => (
                              <a
                                key={network}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                  network === 'linkedin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  network === 'instagram' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                                  network === 'facebook' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                  network === 'youtube' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  network === 'twitter' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                <ExternalLink className="w-3 h-3" />
                                {network.charAt(0).toUpperCase() + network.slice(1)}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Experience */}
                  {lead.experience && Array.isArray(lead.experience) && lead.experience.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Experiência</h3>
                      </div>
                      <div className="space-y-3 pl-6">
                        {lead.experience.map((exp, idx) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Building className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{exp.title || exp.position}</p>
                                {exp.company && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{exp.company}</p>}
                                {(exp.start_date || exp.end_date) && (
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                    {exp.start_date} - {exp.end_date || 'Presente'}
                                  </p>
                                )}
                                {exp.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">{exp.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {lead.education && Array.isArray(lead.education) && lead.education.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <GraduationCap className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Educação</h3>
                      </div>
                      <div className="space-y-3 pl-6">
                        {lead.education.map((edu, idx) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <GraduationCap className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{edu.school || edu.institution}</p>
                                {edu.degree && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{edu.degree}</p>}
                                {edu.field_of_study && <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{edu.field_of_study}</p>}
                                {(edu.start_date || edu.end_date) && (
                                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                                    {edu.start_date} - {edu.end_date}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {lead.skills && Array.isArray(lead.skills) && lead.skills.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Award className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Habilidades</h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {lead.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-[11px] font-medium rounded-md"
                          >
                            {typeof skill === 'string' ? skill : skill.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {lead.certifications && Array.isArray(lead.certifications) && lead.certifications.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Award className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Certificações</h3>
                      </div>
                      <div className="space-y-2 pl-6">
                        {lead.certifications.map((cert, idx) => (
                          <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5">
                            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{cert.name || cert.title}</p>
                            {cert.issuer && <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">{cert.issuer}</p>}
                            {cert.date && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{cert.date}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {lead.languages && Array.isArray(lead.languages) && lead.languages.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Languages className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Idiomas</h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {lead.languages.map((lang, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[11px] font-medium rounded-md"
                          >
                            {typeof lang === 'string' ? lang : `${lang.name}${lang.proficiency ? ` (${lang.proficiency})` : ''}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Websites */}
                  {lead.websites && Array.isArray(lead.websites) && lead.websites.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Sites</h3>
                      </div>
                      <div className="space-y-2 pl-6">
                        {lead.websites.map((website, idx) => (
                          <a
                            key={idx}
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {website}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!lead.about && !lead.experience?.length && !lead.education?.length && !lead.skills?.length && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                        <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhuma informação de perfil disponível</p>
                      </div>
                    </div>
                  )}

                  {/* Ver todos os dados - Link to full contact modal */}
                  {lead.contact_id && onViewContact && (
                    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          onClose();
                          onViewContact(lead.contact_id);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {t('contacts:viewFullDetails', 'Ver dados completos')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="flex flex-col h-full">
                  {/* Comments List */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {loadingComments ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">Nenhum comentário ainda</p>
                        <p className="text-xs mt-1">Seja o primeiro a comentar</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            {comment.user.avatar ? (
                              <img
                                src={comment.user.avatar}
                                alt={comment.user.name}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                {comment.user.name?.charAt(0) || '?'}
                              </div>
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {comment.user.name}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatTimestamp(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                                {comment.content}
                              </p>
                              {comment.mentionedUserNames && comment.mentionedUserNames.length > 0 && (
                                <div className="flex items-center gap-1 mt-1">
                                  <AtSign className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {comment.mentionedUserNames.join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        V
                      </div>
                      <div className="flex-1">
                        <div className="relative">
                          <MentionTextarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onMentionsChange={setCommentMentions}
                            leadId={lead.id}
                            placeholder="Escreva um comentário... Use @ para mencionar"
                            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent p-2.5 pr-9"
                            rows={2}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment();
                              }
                            }}
                          />
                          {/* Emoji Button - Inside textarea */}
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="absolute bottom-2 right-2 p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                            type="button"
                          >
                            <Smile className="w-4 h-4" />
                          </button>

                          {/* Emoji Picker */}
                          {showEmojiPicker && (
                            <div
                              ref={emojiPickerRef}
                              className="absolute bottom-full right-0 mb-2 z-50"
                            >
                              <style>{`
                                .EmojiPickerReact .epr-search-container {
                                  padding: 4px 8px !important;
                                }
                                .EmojiPickerReact .epr-search {
                                  height: 28px !important;
                                  font-size: 12px !important;
                                  padding: 4px 8px !important;
                                }
                                .EmojiPickerReact .epr-category-nav {
                                  padding: 4px 8px !important;
                                  gap: 4px !important;
                                }
                                .EmojiPickerReact button.epr-cat-btn {
                                  width: 20px !important;
                                  height: 20px !important;
                                  padding: 2px !important;
                                }
                                .EmojiPickerReact button.epr-cat-btn svg {
                                  width: 16px !important;
                                  height: 16px !important;
                                }
                                .EmojiPickerReact .epr-emoji-category-label {
                                  font-size: 11px !important;
                                  padding: 4px 8px !important;
                                  margin-top: 4px !important;
                                }
                              `}</style>
                              <EmojiPicker
                                onEmojiClick={(emojiData) => {
                                  setNewComment(prev => prev + emojiData.emoji);
                                  setShowEmojiPicker(false);
                                }}
                                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                width={350}
                                height={280}
                                emojiStyle="native"
                                searchPlaceHolder="Buscar..."
                                searchDisabled={false}
                                previewConfig={{
                                  showPreview: false
                                }}
                                emojiVersion="11.0"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-end mt-2">
                          <button
                            onClick={handleAddComment}
                            disabled={!newComment.trim()}
                            className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Comentar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Conversations */}
          <div className="w-[40%] flex flex-col bg-gray-50 dark:bg-gray-900">
            {/* Channel Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Conversas</h3>

                {/* Channel Switcher */}
                <div className="flex items-center gap-1">
                  {Object.entries(channelConfig).map(([channel, config]) => {
                    const hasMessages = conversations[channel]?.length > 0;
                    const Icon = config.icon;
                    const isActive = activeChannel === channel;

                    return (
                      <button
                        key={channel}
                        onClick={() => hasMessages && setActiveChannel(channel)}
                        disabled={!hasMessages}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? `${config.activeBg} ${config.color} border ${config.border}`
                            : hasMessages
                              ? `${config.bg} ${config.color} hover:${config.activeBg}`
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {config.label}
                        {hasMessages && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            isActive ? 'bg-white/50' : 'bg-white'
                          }`}>
                            {conversations[channel].length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingConversations ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                </div>
              ) : !activeChannel || !conversations[activeChannel]?.length ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                  <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">Nenhuma conversa</p>
                  <p className="text-xs mt-1 text-center">
                    Inicie uma conversa com este lead<br />pelo canal de sua preferência
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations[activeChannel].map((message) => {
                    const config = channelConfig[activeChannel];
                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.type === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                            message.type === 'outbound'
                              ? `${config.messageBg} text-white rounded-br-md`
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md'
                          }`}
                        >
                          {message.subject && (
                            <p className={`text-xs font-medium mb-1 ${
                              message.type === 'outbound' ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {message.subject}
                            </p>
                          )}
                          <p className={`text-sm whitespace-pre-wrap break-words ${
                            message.type === 'outbound'
                              ? '[&_a]:text-white [&_a]:underline [&_a:hover]:text-blue-100'
                              : '[&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-800 dark:[&_a:hover]:text-blue-300'
                          }`}>
                            {linkifyText(message.content)}
                          </p>
                          <p className={`text-[10px] mt-1 ${
                            message.type === 'outbound' ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {formatTimestamp(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            {activeChannel && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Enviar mensagem via ${channelConfig[activeChannel]?.label}...`}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Go to full conversation */}
                <button
                  onClick={() => onNavigateToConversation?.(lead.id, activeChannel)}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                >
                  <span>Ver conversa completa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        leadId={lead?.id}
        onSave={handleTaskSaved}
        isNested={true}
      />

      {/* Win Deal Modal */}
      <WinDealModal
        isOpen={showWinDealModal}
        onClose={() => setShowWinDealModal(false)}
        lead={lead}
        onSuccess={() => {
          setShowWinDealModal(false);
          setCurrentStatus('qualified');
          if (onLeadUpdated) {
            onLeadUpdated({ ...lead, status: 'qualified' });
          }
        }}
      />

      {/* Discard Lead Modal */}
      <DiscardLeadModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        lead={lead}
        onSuccess={() => {
          setShowDiscardModal(false);
          setCurrentStatus('discarded');
          if (onLeadUpdated) {
            onLeadUpdated({ ...lead, status: 'discarded' });
          }
        }}
      />
    </div>
  );
};

export default LeadDetailModal;
