import React, { useState, useEffect, useRef } from 'react';
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
  UserCircle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import MentionTextarea from './MentionTextarea';

const LeadDetailModal = ({ lead, onClose, onNavigateToConversation }) => {
  const { t } = useTranslation('leads');
  const [activeTab, setActiveTab] = useState('details'); // details | contact | comments
  const [activeChannel, setActiveChannel] = useState(null);
  const [conversations, setConversations] = useState({});
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentMentions, setCommentMentions] = useState([]);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(lead?.status || 'leads');
  const messagesEndRef = useRef(null);

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
    }
  }, [lead]);

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
    setCurrentStatus(newStatus);
    setShowStatusDropdown(false);

    try {
      await api.updateLeadStatus(lead.id, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
      setCurrentStatus(lead.status);
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header - Purple gradient like the app */}
        <div className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
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
          <div className="w-[55%] border-r border-gray-200 flex flex-col">
            {/* Tabs */}
            <div className="flex-shrink-0 border-b border-gray-200 px-6">
              <div className="flex gap-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'details'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Detalhes
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'contact'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Contato
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'comments'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Comentários
                  {comments.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
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
                  {/* Status Section */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Target className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Status</p>
                        <div className="relative">
                          <button
                            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-${stage.color}-100 text-${stage.color}-700 hover:bg-${stage.color}-200 transition-colors`}
                          >
                            {stage.label}
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {showStatusDropdown && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                              {Object.entries(pipelineStages).map(([key, value]) => (
                                <button
                                  key={key}
                                  onClick={() => handleStatusChange(key)}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                                    currentStatus === key ? 'bg-gray-50' : ''
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full bg-${value.color}-500`} />
                                  {value.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Responsável */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Responsável</p>
                        <button className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600">
                          <span>Atribuir</span>
                        </button>
                      </div>
                    </div>

                    {/* Campanha */}
                    {lead.campaign_name && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Campanha</p>
                          <span className="px-2 py-1 bg-purple-50 text-purple-700 text-sm rounded-lg">
                            {lead.campaign_name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Data de criação */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Adicionado em</p>
                        <p className="text-sm text-gray-900">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>

                    {/* Conexões */}
                    {lead.connections_count > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Users className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Conexões</p>
                          <p className="text-sm text-gray-900">
                            {lead.connections_count.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Seguidores */}
                    {lead.follower_count > 0 && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <UserCheck className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Seguidores</p>
                          <p className="text-sm text-gray-900">
                            {lead.follower_count.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Email */}
                    {lead.email && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Email</p>
                          <a href={`mailto:${lead.email}`} className="text-sm text-purple-600 hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Telefone */}
                    {lead.phone && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Phone className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">Telefone</p>
                          <a href={`tel:${lead.phone}`} className="text-sm text-purple-600 hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      </div>
                    )}

                    {/* LinkedIn */}
                    {lead.public_identifier && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0A66C2]/10 flex items-center justify-center">
                          <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 mb-1">LinkedIn</p>
                          <a
                            href={`https://linkedin.com/in/${lead.public_identifier}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[#0A66C2] hover:underline flex items-center gap-1"
                          >
                            {lead.public_identifier}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Etiquetas */}
                    <div className="flex items-center gap-3 col-span-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Etiquetas</p>
                        {lead.tags && lead.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {lead.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full"
                              >
                                {tag.name || tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <button className="text-sm text-gray-400 hover:text-gray-600">
                            + Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-6 border-t border-gray-200" />

                  {/* About - Preview */}
                  {lead.about && (
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Sobre
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {lead.about}
                      </p>
                      <button
                        onClick={() => setActiveTab('contact')}
                        className="text-sm text-purple-600 hover:underline mt-2"
                      >
                        Ver contato completo →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'contact' && (
                <div className="p-6 space-y-6">
                  {/* Contact Info Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <UserCircle className="w-4 h-4 text-purple-600" />
                      Informações de Contato
                    </h3>
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      {lead.name && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Nome Completo</p>
                          <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                        </div>
                      )}
                      {lead.email && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Email</p>
                          <a href={`mailto:${lead.email}`} className="text-sm text-purple-600 hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      )}
                      {lead.phone && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Telefone</p>
                          <a href={`tel:${lead.phone}`} className="text-sm text-purple-600 hover:underline">
                            {lead.phone}
                          </a>
                        </div>
                      )}
                      {lead.title && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Cargo</p>
                          <p className="text-sm text-gray-900">{lead.title}</p>
                        </div>
                      )}
                      {lead.company && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Empresa</p>
                          <p className="text-sm text-gray-900">{lead.company}</p>
                        </div>
                      )}
                      {lead.location && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Localização</p>
                          <p className="text-sm text-gray-900">{lead.location}</p>
                        </div>
                      )}
                      {lead.industry && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Indústria</p>
                          <p className="text-sm text-gray-900">{lead.industry}</p>
                        </div>
                      )}
                      {lead.public_identifier && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">LinkedIn</p>
                          <a
                            href={`https://linkedin.com/in/${lead.public_identifier}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-600 hover:underline flex items-center gap-1"
                          >
                            {lead.public_identifier}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* About */}
                  {lead.about && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                        Sobre
                      </h3>
                      <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                        {lead.about}
                      </p>
                    </div>
                  )}

                  {/* Experience */}
                  {lead.experience && Array.isArray(lead.experience) && lead.experience.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-purple-600" />
                        Experiência
                      </h3>
                      <div className="space-y-3">
                        {lead.experience.map((exp, idx) => (
                          <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <Building className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{exp.title || exp.position}</p>
                              {exp.company && <p className="text-sm text-gray-600">{exp.company}</p>}
                              {(exp.start_date || exp.end_date) && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {exp.start_date} - {exp.end_date || 'Presente'}
                                </p>
                              )}
                              {exp.description && (
                                <p className="text-sm text-gray-600 mt-2">{exp.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {lead.education && Array.isArray(lead.education) && lead.education.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-purple-600" />
                        Educação
                      </h3>
                      <div className="space-y-3">
                        {lead.education.map((edu, idx) => (
                          <div key={idx} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{edu.school || edu.institution}</p>
                              {edu.degree && <p className="text-sm text-gray-600">{edu.degree}</p>}
                              {edu.field_of_study && <p className="text-sm text-gray-600">{edu.field_of_study}</p>}
                              {(edu.start_date || edu.end_date) && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {edu.start_date} - {edu.end_date}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {lead.skills && Array.isArray(lead.skills) && lead.skills.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        Habilidades
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {lead.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full"
                          >
                            {typeof skill === 'string' ? skill : skill.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {lead.certifications && Array.isArray(lead.certifications) && lead.certifications.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-purple-600" />
                        Certificações
                      </h3>
                      <div className="space-y-2">
                        {lead.certifications.map((cert, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{cert.name || cert.title}</p>
                            {cert.issuer && <p className="text-xs text-gray-600">{cert.issuer}</p>}
                            {cert.date && <p className="text-xs text-gray-400">{cert.date}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {lead.languages && Array.isArray(lead.languages) && lead.languages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Languages className="w-4 h-4 text-purple-600" />
                        Idiomas
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {lead.languages.map((lang, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full"
                          >
                            {typeof lang === 'string' ? lang : `${lang.name}${lang.proficiency ? ` (${lang.proficiency})` : ''}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Websites */}
                  {lead.websites && Array.isArray(lead.websites) && lead.websites.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-purple-600" />
                        Sites
                      </h3>
                      <div className="space-y-2">
                        {lead.websites.map((website, idx) => (
                          <a
                            key={idx}
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {website}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!lead.about && !lead.experience?.length && !lead.education?.length && !lead.skills?.length && (
                    <div className="text-center py-8 text-gray-400">
                      <UserCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhuma informação de perfil disponível</p>
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
                      <div className="text-center py-8 text-gray-400">
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
                                <span className="text-sm font-medium text-gray-900">
                                  {comment.user.name}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatTimestamp(comment.createdAt)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
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
                      </div>
                    )}
                  </div>

                  {/* Comment Input */}
                  <div className="flex-shrink-0 border-t border-gray-200 p-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                        V
                      </div>
                      <div className="flex-1">
                        <MentionTextarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onMentionsChange={setCommentMentions}
                          leadId={lead.id}
                          placeholder="Escreva um comentário... Use @ para mencionar"
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
          <div className="w-[45%] flex flex-col bg-gray-50">
            {/* Channel Tabs */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Conversas</h3>

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
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
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
                              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                          }`}
                        >
                          {message.subject && (
                            <p className={`text-xs font-medium mb-1 ${
                              message.type === 'outbound' ? 'text-white/70' : 'text-gray-500'
                            }`}>
                              {message.subject}
                            </p>
                          )}
                          <p className={`text-sm whitespace-pre-wrap break-words ${
                            message.type === 'outbound'
                              ? '[&_a]:text-white [&_a]:underline [&_a:hover]:text-blue-100'
                              : '[&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800'
                          }`}>
                            {linkifyText(message.content)}
                          </p>
                          <p className={`text-[10px] mt-1 ${
                            message.type === 'outbound' ? 'text-white/60' : 'text-gray-400'
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
              <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={`Enviar mensagem via ${channelConfig[activeChannel]?.label}...`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <span>Ver conversa completa</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailModal;
