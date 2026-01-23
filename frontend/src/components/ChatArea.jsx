// frontend/src/components/ChatArea.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Send, Bot, User, Loader, AlertCircle, Linkedin, Mail,
  ToggleLeft, ToggleRight, SidebarOpen, SidebarClose, CheckCircle, RotateCcw,
  Paperclip, X, FileText, Image, Film, Music, File, Download, Pencil, Check,
  Play, Pause, Sparkles, Copy, Forward, Mic, Square, Trash2, Map, MessageSquare
} from 'lucide-react';
import api from '../services/api';
import { joinConversation, leaveConversation, onNewMessage } from '../services/ably';
import EmailComposer from './EmailComposer';
import EmailMessage from './EmailMessage';
import SecretAgentModal from './SecretAgentModal';
import ConversationInviteModal from './ConversationInviteModal';
import { UserPlus, Hourglass, Eye } from 'lucide-react';
import UnifiedContactModal from './UnifiedContactModal';
import RoadmapSelector from './RoadmapSelector';
import { useAuth } from '../contexts/AuthContext';

const ChatArea = ({ conversationId, onToggleDetails, showDetailsPanel, onConversationRead, onConversationClosed, onConversationUpdated }) => {
  const { t, i18n } = useTranslation('conversations');
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDownloading, setIsDownloading] = useState({});
  // Estado para modal de visualização de imagem
  const [imageModal, setImageModal] = useState({ isOpen: false, url: '', name: '' });
  // Estado para edição de nome
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  // Estado para players de áudio customizados
  const [audioStates, setAudioStates] = useState({}); // { [audioId]: { playing: bool, currentTime: num, duration: num } }
  const audioRefs = useRef({}); // Refs para os elementos audio
  // Secret Agent Modal
  const [showSecretAgentModal, setShowSecretAgentModal] = useState(false);
  // Invite Modal (para não-conexões)
  const [showInviteModal, setShowInviteModal] = useState(false);
  // Contact Details Modal
  const [showContactModal, setShowContactModal] = useState(false);
  // Message context menu
  const [messageMenu, setMessageMenu] = useState({ isOpen: false, messageId: null, x: 0, y: 0 });
  const [copySuccess, setCopySuccess] = useState(null);
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);
  // Quick replies state
  const [quickReplies, setQuickReplies] = useState([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplyFilter, setQuickReplyFilter] = useState('');
  const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);
  const quickRepliesRef = useRef(null);
  // Roadmaps state
  const [roadmaps, setRoadmaps] = useState([]);
  const [showRoadmapSelector, setShowRoadmapSelector] = useState(false);
  const [selectedRoadmapForExecution, setSelectedRoadmapForExecution] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentConversationIdRef = useRef(null);
  const nameInputRef = useRef(null);

  // Helper to get locale for date formatting
  const getLocale = () => i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';

  useEffect(() => {
    if (conversationId) {
      // Atualizar ref para rastrear qual conversa deve ser exibida
      currentConversationIdRef.current = conversationId;

      // Limpar estado anterior ao trocar de conversa
      setConversation(null);
      setMessages([]);
      setError(null);
      setLoadingConversation(true);

      loadConversation(conversationId);
      loadMessages(conversationId);
      markAsRead(); // Marcar como lida ao abrir
    } else {
      currentConversationIdRef.current = null;
      setConversation(null);
      setMessages([]);
      setLoadingConversation(false);
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ✅ Realtime: Entrar/sair da sala de conversa e escutar novas mensagens via Ably
  useEffect(() => {
    if (!conversationId) return;

    // Handler para processar novas mensagens
    const handleNewMessage = (data, source) => {
      // Só processar se for da conversa atual
      if (data.conversationId === conversationId || data.conversationId === parseInt(conversationId)) {
        console.log(`ChatArea: Nova mensagem recebida via ${source}`, data);

        // Verificar se a mensagem já existe (evitar duplicatas)
        setMessages(prevMessages => {
          const newMsg = data.message;
          if (!newMsg) return prevMessages;

          // Deduplicação por ID ou unipile_message_id
          const existsById = prevMessages.some(m =>
            m.id === newMsg.id ||
            (m.unipile_message_id && m.unipile_message_id === newMsg.unipile_message_id)
          );

          if (existsById) {
            console.log('ChatArea: Mensagem duplicada detectada por ID, ignorando');
            return prevMessages;
          }

          // Deduplicação extra para mensagens próprias enviadas pela plataforma
          // Verifica se existe mensagem recente (últimos 10s) com mesmo conteúdo e sender_type='user'
          if (newMsg.sender_type === 'user' || data.isOwnMessage) {
            const tenSecondsAgo = Date.now() - 10000;
            const existsByContent = prevMessages.some(m => {
              if (m.sender_type !== 'user') return false;
              const msgTime = new Date(m.sent_at).getTime();
              if (msgTime < tenSecondsAgo) return false;
              // Comparar conteúdo (normalizado)
              const existingContent = (m.content || '').trim().toLowerCase();
              const newContent = (newMsg.content || '').trim().toLowerCase();
              return existingContent === newContent && existingContent.length > 0;
            });

            if (existsByContent) {
              console.log('ChatArea: Mensagem duplicada detectada por conteúdo, ignorando');
              return prevMessages;
            }
          }

          // Adicionar nova mensagem
          return [...prevMessages, newMsg];
        });
      }
    };

    // Entrar na sala da conversa (Ably)
    joinConversation(conversationId);

    // Escutar novas mensagens via Ably
    const unsubscribe = onNewMessage((data) => handleNewMessage(data, 'Ably'));

    // Cleanup: sair da sala e remover listener
    return () => {
      leaveConversation(conversationId);
      unsubscribe();
    };
  }, [conversationId]);

  // Close quick replies dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(event.target) &&
          textareaRef.current && !textareaRef.current.contains(event.target)) {
        setShowQuickReplies(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load quick replies on mount
  useEffect(() => {
    const loadQuickReplies = async () => {
      try {
        const response = await api.getQuickReplies();
        if (response.success) {
          setQuickReplies(response.data || []);
        }
      } catch (error) {
        console.error('Error loading quick replies:', error);
      }
    };
    loadQuickReplies();
  }, []);

  // Load roadmaps on mount
  useEffect(() => {
    const loadRoadmaps = async () => {
      try {
        const response = await api.getRoadmaps();
        if (response.success) {
          // Filter only active roadmaps
          setRoadmaps((response.data || []).filter(r => r.is_active));
        }
      } catch (error) {
        console.error('Error loading roadmaps:', error);
      }
    };
    loadRoadmaps();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle message context menu
  const handleMessageContextMenu = (e, messageId) => {
    e.preventDefault();
    setMessageMenu({
      isOpen: true,
      messageId,
      x: e.clientX,
      y: e.clientY
    });
  };

  const closeMessageMenu = () => {
    setMessageMenu({ isOpen: false, messageId: null, x: 0, y: 0 });
  };

  // Close message menu on click outside
  useEffect(() => {
    const handleClick = () => closeMessageMenu();
    if (messageMenu.isOpen) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [messageMenu.isOpen]);

  // Copy message content
  const handleCopyMessage = async (message) => {
    const text = message.content || message.text || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(message.id);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    closeMessageMenu();
  };

  // Check if channel supports forwarding (only WhatsApp)
  const canForwardMessage = () => {
    const channel = conversation?.channel || conversation?.source || '';
    return channel.toLowerCase().includes('whatsapp');
  };

  // Audio Recording Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(t('chatArea.microphoneError', 'Erro ao acessar microfone'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      const stream = mediaRecorderRef.current.stream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const sendAudioMessage = async () => {
    if (!audioBlob) return;

    try {
      setIsSending(true);
      setError(null);

      // Create a File object from the blob
      const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
        type: 'audio/webm'
      });

      const response = await api.sendMessage(conversationId, '', [audioFile]);

      if (response.success) {
        const sentMessage = {
          id: response.data.id || Date.now(),
          content: '',
          sender_type: 'user',
          sent_at: new Date().toISOString(),
          attachments: [{
            id: 'audio-' + Date.now(),
            name: audioFile.name,
            type: 'audio/webm',
            url: audioUrl
          }]
        };
        setMessages(prev => [...prev, sentMessage]);
        cancelRecording();
      }
    } catch (err) {
      console.error('Error sending audio:', err);
      setError(t('chatArea.failedSendMessage'));
    } finally {
      setIsSending(false);
    }
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const loadConversation = async (id) => {
    try {
      const response = await api.getConversation(id);

      // ✅ Só aplicar resultado se ainda for a conversa selecionada
      if (response.success && currentConversationIdRef.current === id) {
        setConversation(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
    } finally {
      // ✅ Só desativar loading se ainda for a conversa selecionada
      if (currentConversationIdRef.current === id) {
        setLoadingConversation(false);
      }
    }
  };

  const loadMessages = async (id) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.getMessages(id, { limit: 100 });

      // ✅ Só aplicar resultado se ainda for a conversa selecionada
      if (response.success && currentConversationIdRef.current === id) {
        // Backend agora busca da Unipile API e retorna já ordenado corretamente
        // (mais antiga primeiro, mais recente embaixo)
        const messagesData = response.data.messages || [];

        // 🔍 DEBUG: Verificar sender_type das mensagens recebidas
        const userMsgs = messagesData.filter(m => m.sender_type === 'user').length;
        const leadMsgs = messagesData.filter(m => m.sender_type === 'lead').length;
        const otherMsgs = messagesData.filter(m => m.sender_type !== 'user' && m.sender_type !== 'lead').length;
        console.log(`📊 FRONTEND - Mensagens recebidas: total=${messagesData.length} | user=${userMsgs} | lead=${leadMsgs} | other=${otherMsgs}`);

        // Log primeiras 3 mensagens de cada tipo
        messagesData.filter(m => m.sender_type === 'lead').slice(0, 3).forEach((m, i) => {
          console.log(`   Lead[${i}]: sender_type=${m.sender_type}, type=${m.type}, content="${(m.content || '').substring(0, 40)}"`);
        });

        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      // ✅ Só mostrar erro se ainda for a conversa selecionada
      if (currentConversationIdRef.current === id) {
        setError(t('chatArea.failedLoadMessages'));
      }
    } finally {
      // ✅ Só desativar loading se ainda for a conversa selecionada
      if (currentConversationIdRef.current === id) {
        setIsLoading(false);
      }
    }
  };

  const markAsRead = async () => {
    try {
      await api.markAsRead(conversationId);

      // ✅ NÃO atualizar conversation local aqui para evitar race condition
      // O loadConversation já traz os dados atualizados
      // E o onConversationRead notifica o pai para atualizar a lista

      // Notificar o componente pai para atualizar a lista
      if (onConversationRead) {
        onConversationRead(conversationId);
      }
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
      // Não mostrar erro ao usuário, apenas logar
    }
  };

  const handleCloseConversation = async () => {
    try {
      const response = await api.closeConversation(conversationId);
      if (response.success) {
        // ✅ Atualizar apenas se ainda for a conversa selecionada
        if (currentConversationIdRef.current === conversationId && conversation) {
          setConversation({ ...conversation, status: 'closed', closed_at: new Date().toISOString() });
        }
        // Notificar o componente pai para atualizar a lista
        if (onConversationClosed) {
          onConversationClosed(conversationId);
        }
      }
    } catch (error) {
      console.error('Erro ao fechar conversa:', error);
      setError(t('chatArea.failedCloseConversation'));
    }
  };

  const handleReopenConversation = async () => {
    try {
      const response = await api.reopenConversation(conversationId, 'ai_active');
      if (response.success) {
        // ✅ Atualizar apenas se ainda for a conversa selecionada
        if (currentConversationIdRef.current === conversationId && conversation) {
          setConversation({ ...conversation, status: 'ai_active', closed_at: null });
        }
        // Notificar o componente pai para atualizar a lista
        if (onConversationClosed) {
          onConversationClosed(conversationId);
        }
      }
    } catch (error) {
      console.error('Erro ao reabrir conversa:', error);
      setError(t('chatArea.failedReopenConversation'));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    // Precisa ter texto OU arquivos
    if (!newMessage.trim() && selectedFiles.length === 0) return;

    try {
      setIsSending(true);
      setError(null);

      const response = await api.sendMessage(conversationId, newMessage.trim(), selectedFiles);

      if (response.success) {
        // Criar preview dos attachments para exibição local
        const attachmentPreviews = selectedFiles.map((file, idx) => ({
          id: `local-${Date.now()}-${idx}`,
          name: file.name,
          type: file.type,
          size: file.size
        }));

        // Add message optimistically to local state
        const sentMessage = {
          id: response.data.id || Date.now(),
          content: newMessage.trim(),
          sender_type: 'user',
          sent_at: new Date().toISOString(),
          attachments: attachmentPreviews,
          ...response.data
        };

        setMessages([...messages, sentMessage]);
        setNewMessage('');
        setSelectedFiles([]);

        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError(t('chatArea.failedSendMessage'));
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleAI = async () => {
    if (!conversation) return;

    try {
      const newStatus = conversation.status === 'ai_active' ? 'manual' : 'ai_active';
      await api.updateConversationStatus(conversationId, newStatus);

      // ✅ Atualizar apenas se ainda for a conversa selecionada
      if (currentConversationIdRef.current === conversationId && conversation) {
        setConversation({ ...conversation, status: newStatus });
      }

      // ✅ Atualizar lista de conversas na sidebar
      if (onConversationUpdated) {
        onConversationUpdated();
      }
    } catch (error) {
      console.error('Erro ao alternar modo IA:', error);
      setError(t('chatArea.failedToggleAI'));
    }
  };

  // Handler para iniciar edição do nome
  const handleStartEditName = () => {
    const currentName = conversation?.is_group && conversation?.group_name
      ? conversation.group_name
      : (conversation?.lead_name || '');
    setEditedName(currentName);
    setIsEditingName(true);
    // Focar no input após render
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  // Handler para salvar o nome editado
  const handleSaveName = async () => {
    if (!editedName.trim() || !conversationId) return;

    setIsSavingName(true);
    try {
      await api.updateContactName(conversationId, editedName.trim());

      // Atualizar estado local
      setConversation(prev => ({
        ...prev,
        lead_name: editedName.trim()
      }));

      setIsEditingName(false);

      // Atualizar lista de conversas
      if (onConversationUpdated) {
        onConversationUpdated();
      }
    } catch (error) {
      console.error('Erro ao salvar nome:', error);
      setError(t('chatArea.failedSaveName'));
    } finally {
      setIsSavingName(false);
    }
  };

  // Handler para cancelar edição
  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  // Handler para tecla Enter no input de nome
  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);

    // Verificar se a data é válida
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', timestamp);
      return '';
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const locale = getLocale();

    // Se for hoje, mostrar só horário
    if (isToday) {
      return date.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Se foi ontem
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `${t('chatArea.yesterdayAt')} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Se foi este ano, mostrar data sem ano
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.toLocaleDateString(locale, { day: '2-digit', month: 'short' })} ${t('chatArea.at')} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Se foi ano passado, mostrar com ano
    return `${date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })} ${t('chatArea.at')} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  };

  const linkifyText = (text) => {
    if (!text) return text;

    // Regex mais abrangente para detectar URLs:
    // - https://... ou http://...
    // - www....
    // - dominio.com/caminho (sem protocolo)
    // Captura caracteres especiais válidos em URLs: _ - ~ : / ? # [ ] @ ! $ & ' ( ) * + , ; = %
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?)/gi;

    const parts = [];
    let lastIndex = 0;
    let match;

    // Reset regex index
    urlRegex.lastIndex = 0;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];

      // Verificar se não é parte de um email (evitar false positives)
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
        // Domínio sem protocolo (ex: app.onstrider.com/r/arthur_2v3cde)
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

  const handleTextareaChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);

    // Quick replies trigger: detect "/" at beginning
    if (value.startsWith('/')) {
      const filter = value.slice(1).toLowerCase(); // Remove "/" and get filter text
      setQuickReplyFilter(filter);
      setShowQuickReplies(true);
      setSelectedQuickReplyIndex(0);
    } else {
      setShowQuickReplies(false);
      setQuickReplyFilter('');
    }

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  // Filter quick replies based on search
  const filteredQuickReplies = quickReplies.filter(reply => {
    if (!quickReplyFilter) return true;
    const searchTerm = quickReplyFilter.toLowerCase();
    return (
      reply.title.toLowerCase().includes(searchTerm) ||
      reply.content.toLowerCase().includes(searchTerm) ||
      (reply.shortcut && reply.shortcut.toLowerCase().includes(searchTerm))
    );
  });

  // Filter roadmaps based on search
  const filteredRoadmaps = roadmaps.filter(roadmap => {
    if (!quickReplyFilter) return true;
    const searchTerm = quickReplyFilter.toLowerCase();
    return (
      roadmap.name.toLowerCase().includes(searchTerm) ||
      (roadmap.description && roadmap.description.toLowerCase().includes(searchTerm)) ||
      (roadmap.shortcut && roadmap.shortcut.toLowerCase().includes(searchTerm))
    );
  });

  // Combined list with section headers (Slack-style)
  const dropdownSections = [
    {
      id: 'quickReplies',
      title: t('chatArea.quickRepliesSection', 'RESPOSTAS RÁPIDAS'),
      items: filteredQuickReplies.map(r => ({ ...r, _type: 'quickReply' }))
    },
    {
      id: 'roadmaps',
      title: t('chatArea.roadmapsSection', 'ROADMAPS'),
      items: filteredRoadmaps.map(r => ({ ...r, _type: 'roadmap' }))
    }
  ].filter(section => section.items.length > 0);

  // Flat list of all items for keyboard navigation
  const allDropdownItems = dropdownSections.flatMap(section => section.items);

  // Insert quick reply content into textarea or open roadmap selector
  const insertQuickReply = (item) => {
    if (item._type === 'roadmap') {
      // Open roadmap selector modal
      setSelectedRoadmapForExecution(item);
      setShowRoadmapSelector(true);
      setShowQuickReplies(false);
      setQuickReplyFilter('');
      setNewMessage('');
      return;
    }
    // Quick reply: insert content
    setNewMessage(item.content);
    setShowQuickReplies(false);
    setQuickReplyFilter('');
    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleKeyDown = (e) => {
    // Handle quick replies/roadmaps navigation (Slack-style unified list)
    if (showQuickReplies) {
      if (allDropdownItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedQuickReplyIndex(prev =>
            prev < allDropdownItems.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedQuickReplyIndex(prev =>
            prev > 0 ? prev - 1 : allDropdownItems.length - 1
          );
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          insertQuickReply(allDropdownItems[selectedQuickReplyIndex]);
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowQuickReplies(false);
          setNewMessage('');
          return;
        } else if (e.key === 'Tab') {
          e.preventDefault();
          // Tab also selects (like Slack)
          insertQuickReply(allDropdownItems[selectedQuickReplyIndex]);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowQuickReplies(false);
        setNewMessage('');
        return;
      }
    }

    // Normal send on Shift+Enter
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // ================================
  // FUNÇÕES DE ARQUIVO/ATTACHMENT
  // ================================

  // Determinar ícone baseado no tipo de arquivo
  const getFileIcon = (type) => {
    if (!type) return File;
    if (type.startsWith('image/')) return Image;
    if (type.startsWith('video/')) return Film;
    if (type.startsWith('audio/')) return Music;
    if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText;
    return File;
  };

  // Formatar tamanho de arquivo
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Handler para seleção de arquivos
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Verificar limite de 5 arquivos
    if (selectedFiles.length + files.length > 5) {
      setError(t('chatArea.maxFilesPerMessage'));
      return;
    }

    // Verificar tamanho máximo (15MB cada)
    const maxSize = 15 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      setError(t('chatArea.fileTooLarge'));
      return;
    }

    setSelectedFiles([...selectedFiles, ...files]);
    setError(null);

    // Limpar input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover arquivo selecionado
  const handleRemoveFile = (index) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  // Download de attachment
  const handleDownloadAttachment = async (attachment) => {
    // Verificar se é um attachment local (ainda não sincronizado)
    if (!attachment.message_id || !attachment.id ||
        String(attachment.id).startsWith('local-') ||
        attachment.message_id === 'undefined') {
      setError(t('chatArea.fileStillProcessing'));
      return;
    }

    const key = `${attachment.message_id}-${attachment.id}`;
    setIsDownloading(prev => ({ ...prev, [key]: true }));

    try {
      await api.downloadAttachment(
        attachment.conversation_id,
        attachment.message_id,
        attachment.id,
        attachment.name
      );
    } catch (err) {
      console.error('Erro ao baixar arquivo:', err);
      setError(t('chatArea.failedDownload'));
    } finally {
      setIsDownloading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Verificar se attachment pode ser baixado via proxy do backend
  const canDownloadAttachment = (attachment) => {
    // Precisa ter todos os IDs necessários
    if (!attachment.conversation_id || !attachment.message_id || !attachment.id) {
      return false;
    }
    // IDs locais não podem ser baixados
    if (String(attachment.id).startsWith('local-')) {
      return false;
    }
    // Permitir todos os outros IDs (caracteres especiais serão encoded na URL)
    return true;
  };

  // Verificar se é uma imagem que pode ser exibida inline
  const isDisplayableImage = (type) => {
    return type && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type);
  };

  // Verificar se é um áudio que pode ser reproduzido
  const isPlayableAudio = (type, filename) => {
    // Verificar pelo MIME type
    if (type && (
      type.startsWith('audio/') ||
      type === 'audio/ogg' ||
      type === 'audio/opus' ||
      type === 'audio/mpeg' ||
      type === 'audio/mp3' ||
      type === 'audio/wav' ||
      type === 'audio/webm' ||
      type === 'audio/aac' ||
      type === 'audio/m4a'
    )) {
      return true;
    }
    // Verificar pela extensão do arquivo (fallback quando type não está definido)
    if (filename) {
      const ext = filename.toLowerCase().split('.').pop();
      return ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'aac', 'webm', 'wma', 'flac', 'aiff'].includes(ext);
    }
    return false;
  };

  // Funções para player de áudio customizado
  const formatAudioTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleAudioPlay = (audioId) => {
    const audio = audioRefs.current[audioId];
    if (!audio) return;

    // Pausar outros áudios
    Object.keys(audioRefs.current).forEach(id => {
      if (id !== audioId && audioRefs.current[id]) {
        audioRefs.current[id].pause();
        setAudioStates(prev => ({ ...prev, [id]: { ...prev[id], playing: false } }));
      }
    });

    if (audio.paused) {
      audio.play();
      setAudioStates(prev => ({ ...prev, [audioId]: { ...prev[audioId], playing: true } }));
    } else {
      audio.pause();
      setAudioStates(prev => ({ ...prev, [audioId]: { ...prev[audioId], playing: false } }));
    }
  };

  const handleAudioTimeUpdate = (audioId, audio) => {
    setAudioStates(prev => ({
      ...prev,
      [audioId]: {
        ...prev[audioId],
        currentTime: audio.currentTime,
        duration: audio.duration || 0
      }
    }));
  };

  const handleAudioSeek = (audioId, e) => {
    const audio = audioRefs.current[audioId];
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * audio.duration;
  };

  // Empty State
  if (!conversationId) {
    return (
      <div className="flex-1 bg-white dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">{t('chatArea.selectConversation')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('chatArea.selectConversationHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-800 flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar - só usar se for URL HTTP válida */}
          {conversation?.lead_picture && conversation.lead_picture.startsWith('http') ? (
            <img
              src={conversation.lead_picture}
              alt={conversation.lead_name}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold">
                {conversation?.lead_name?.charAt(0) || '?'}
              </span>
            </div>
          )}

          {/* Info */}
          <div className="min-w-0 flex-1">
            {loadingConversation ? (
              <>
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32 mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-48"></div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  {/* Nome editável */}
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        className="font-semibold text-gray-900 dark:text-gray-100 border border-purple-300 dark:border-purple-600 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700"
                        disabled={isSavingName}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName || !editedName.trim()}
                        className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-colors disabled:opacity-50"
                        title={t('chatArea.save')}
                      >
                        {isSavingName ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEditName}
                        disabled={isSavingName}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title={t('chatArea.cancel')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {/* Mostrar group_name para grupos, senão lead_name */}
                        {conversation?.is_group && conversation?.group_name
                          ? conversation.group_name
                          : (conversation?.lead_name || t('chatArea.loading'))}
                      </h2>
                      {/* Botão de editar (visível em hover ou sempre para contatos orgânicos) */}
                      {!conversation?.is_group && (
                        <button
                          onClick={handleStartEditName}
                          className="p-1 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          title={t('chatArea.editName')}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {/* Badge de grupo */}
                  {conversation?.is_group && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex-shrink-0">
                      {t('sidebar.group')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  {conversation?.is_group ? (
                    <span className="truncate">
                      {conversation?.attendee_count || 2} {t('chatArea.participants')}
                    </span>
                  ) : (
                    <>
                      {/* Mostrar telefone se for conversa orgânica */}
                      {conversation?.lead_phone && (
                        <span className="truncate text-purple-600 dark:text-purple-400">{conversation.lead_phone}</span>
                      )}
                      {conversation?.lead_phone && conversation?.lead_title && <span>•</span>}
                      <span className="truncate">{conversation?.lead_title}</span>
                      {conversation?.lead_company && (
                        <>
                          <span>•</span>
                          <span className="truncate">{conversation?.lead_company}</span>
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* AI Toggle Switch */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium transition-colors ${
              conversation?.status === 'ai_active'
                ? 'text-gray-400 dark:text-gray-500'
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              {t('chatArea.manual')}
            </span>
            <button
              onClick={handleToggleAI}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                conversation?.status === 'ai_active'
                  ? 'bg-purple-600 focus:ring-purple-500'
                  : 'bg-orange-500 focus:ring-orange-500'
              }`}
              title={conversation?.status === 'ai_active' ? t('chatArea.disableAI') : t('chatArea.enableAI')}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  conversation?.status === 'ai_active' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-xs font-medium transition-colors flex items-center gap-1 ${
              conversation?.status === 'ai_active'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}>
              <Bot className="w-3.5 h-3.5" />
              {t('chatArea.ai')}
            </span>
          </div>

          {/* Secret Agent Button */}
          <button
            onClick={() => setShowSecretAgentModal(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('chatArea.secretAgent', 'Agente Secreto')}
          >
            <Sparkles className="w-5 h-5" />
          </button>

          {/* Send Invite Button - só aparece para não-conexões do LinkedIn (após dados carregados) */}
          {conversation?.channel !== 'email' &&
           conversation?.source !== 'email' &&
           conversation?.contact_linkedin_profile_id &&
           conversation?.contact_network_distance !== 'FIRST_DEGREE' && (
            conversation?.has_pending_invitation ? (
              <div
                className="p-2 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg cursor-default"
                title="Convite enviado - aguardando aceitação"
              >
                <Hourglass className="w-5 h-5" />
              </div>
            ) : (
              <button
                onClick={() => setShowInviteModal(true)}
                className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                title="Enviar convite de conexão"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            )
          )}

          {/* Channel Indicator */}
          {conversation?.channel === 'email' || conversation?.source === 'email' ? (
            <div
              className="p-2 text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg"
              title={t('chatArea.emailConversation')}
            >
              <Mail className="w-5 h-5" />
            </div>
          ) : conversation?.lead_profile_url ? (
            <a
              href={conversation.lead_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('chatArea.viewLinkedInProfile')}
            >
              <Linkedin className="w-5 h-5" />
            </a>
          ) : null}

          {/* View Contact Details Button */}
          <button
            onClick={() => setShowContactModal(true)}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Ver detalhes do contato"
          >
            <Eye className="w-5 h-5" />
          </button>

          {/* Close/Reopen Conversation Button */}
          {conversation?.status === 'closed' ? (
            <button
              onClick={handleReopenConversation}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('chatArea.reopenConversation')}
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleCloseConversation}
              className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('chatArea.closeConversation')}
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          )}

          {/* Toggle Details Panel */}
          <button
            onClick={onToggleDetails}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={showDetailsPanel ? t('chatArea.hideDetails') : t('chatArea.showDetails')}
          >
            {showDetailsPanel ? (
              <SidebarOpen className="w-5 h-5" />
            ) : (
              <SidebarClose className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('chatArea.loadingMessages')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
              <button
                onClick={loadMessages}
                className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                {t('chatArea.tryAgain')}
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">{t('chatArea.noMessages')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('chatArea.sendFirstMessage')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {messages.map((message, index) => {
              // ✅ FIX: Usar apenas sender_type para determinar lado da mensagem
              // Antes também checava message.type === 'outgoing' que vinha da Unipile
              const isUser = message.sender_type === 'user';
              const isAI = message.sender_type === 'ai';
              const isEmailChannel = conversation?.channel === 'email' ||
                                     conversation?.source === 'email' ||
                                     message.channel === 'email';

              // Use EmailMessage component for email channels
              if (isEmailChannel) {
                return (
                  <EmailMessage
                    key={message.id || index}
                    message={message}
                    isOutgoing={isUser}
                    senderName={isUser ? t('chatArea.you') : (isAI ? t('chatArea.ai') : conversation?.lead_name)}
                    senderType={isUser ? 'user' : (isAI ? 'ai' : 'lead')}
                    timestamp={message.sent_at || message.date}
                  />
                );
              }

              // Regular chat message rendering for non-email channels
              return (
                <div
                  key={message.id || index}
                  className="flex w-full px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div
                    className={`flex items-start gap-3 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    onContextMenu={(e) => handleMessageContextMenu(e, message.id)}
                  >
                    {/* Avatar com foto */}
                    {(() => {
                      const photoUrl = isUser
                        ? (currentUser?.profile_picture || currentUser?.avatar_url)
                        : conversation?.lead_picture;
                      const name = isUser ? currentUser?.name : (isAI ? 'IA' : conversation?.lead_name);
                      const bgColor = isUser ? 'bg-purple-600' : isAI ? 'bg-green-600' : 'bg-blue-600';

                      return (
                        <div className="relative w-10 h-10 flex-shrink-0">
                          {photoUrl && (
                            <img
                              src={photoUrl}
                              alt={name || 'Avatar'}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.classList.remove('hidden'); }}
                            />
                          )}
                          <div className={`${photoUrl ? 'hidden' : ''} w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
                            {isAI ? (
                              <Bot className="w-5 h-5 text-white" />
                            ) : (
                              <span className="text-white text-sm font-semibold">
                                {name?.charAt(0)?.toUpperCase() || (isUser ? 'U' : 'L')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Message Content - RocketChat Style */}
                    <div className="flex-1 min-w-0">
                      {/* Header: Nome + Timestamp */}
                      <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className={`text-sm font-semibold ${
                          isUser
                            ? 'text-purple-600 dark:text-purple-400'
                            : isAI
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {isUser ? t('chatArea.you') : (isAI ? t('chatArea.ai') : conversation?.lead_name)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatMessageTime(message.sent_at || message.date)}
                        </span>
                        {/* LinkedIn Badge: InMail ou Sponsored */}
                        {message.linkedin_category && !isUser && (
                          <span className={`text-xs flex items-center gap-1 ${
                            message.linkedin_category === 'inmail'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            <span>{message.linkedin_category === 'inmail' ? '📧' : '📢'}</span>
                            <span className="font-medium">
                              {message.linkedin_category === 'inmail' ? 'InMail' : 'Sponsored'}
                            </span>
                          </span>
                        )}
                        {/* Copy button on hover */}
                        <button
                          onClick={() => handleCopyMessage(message)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                          title={t('chatArea.copyMessage')}
                        >
                          {copySuccess === message.id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-400" />
                          )}
                        </button>
                      </div>

                      {/* Message Content */}
                      <div className={`${isUser ? 'text-right' : 'text-left'}`}>
                        {/* Texto da mensagem */}
                        {/* Esconder mensagem da Unipile quando há attachments de mídia */}
                        {(() => {
                          const messageText = message.content || message.text;
                          const isUnipileUnsupportedMessage = messageText &&
                            messageText.includes('Unipile cannot display this type of message');
                          const hasMediaAttachments = message.attachments &&
                            message.attachments.some(att =>
                              att.type && (att.type.startsWith('image/') || att.type.startsWith('video/'))
                            );

                          // Não mostrar texto se é mensagem da Unipile e há mídia
                          if (isUnipileUnsupportedMessage && hasMediaAttachments) {
                            return null;
                          }

                          if (messageText) {
                            return (
                              <p className="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100 [&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-800 dark:[&_a:hover]:text-blue-300">
                                {linkifyText(messageText)}
                              </p>
                            );
                          }
                          return null;
                        })()}

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className={`${(() => {
                            const messageText = message.content || message.text;
                            const isUnipileMsg = messageText && messageText.includes('Unipile cannot display this type of message');
                            const hasMedia = message.attachments.some(att => att.type && (att.type.startsWith('image/') || att.type.startsWith('video/')));
                            // Só adiciona borda se há texto visível (não é mensagem Unipile escondida)
                            return messageText && !(isUnipileMsg && hasMedia) ? 'mt-2 pt-2 border-t border-gray-200 dark:border-gray-700' : '';
                          })()} space-y-2`}>
                            {message.attachments.map((att, attIdx) => {
                              const FileIcon = getFileIcon(att.type);
                              const downloadKey = `${att.message_id}-${att.id}`;
                              const isDownloadingFile = isDownloading[downloadKey];
                              const canDownload = canDownloadAttachment(att);

                              // Verificar se é imagem que pode ser exibida inline
                              if (isDisplayableImage(att.type)) {
                                // Determinar URL para exibição da imagem
                                // Se tem URL HTTP válida, usar diretamente
                                // Caso contrário, usar proxy via backend
                                let imageUrl = null;
                                if (att.url && att.url.startsWith('http')) {
                                  imageUrl = att.url;
                                } else if (canDownload) {
                                  // Usar proxy inline do backend
                                  imageUrl = api.getAttachmentInlineUrl(
                                    att.conversation_id,
                                    att.message_id,
                                    att.id
                                  );
                                }

                                if (imageUrl) {
                                  return (
                                    <div key={att.id || attIdx} className="relative">
                                      <img
                                        src={imageUrl}
                                        alt={att.name}
                                        crossOrigin="anonymous"
                                        className="max-w-full max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => setImageModal({ isOpen: true, url: imageUrl, name: att.name || 'Imagem' })}
                                        onError={(e) => {
                                          // Se falhar ao carregar, esconder a imagem
                                          e.target.style.display = 'none';
                                        }}
                                      />
                                      {canDownload && (
                                        <button
                                          onClick={() => handleDownloadAttachment(att)}
                                          disabled={isDownloadingFile}
                                          className="absolute bottom-2 right-2 p-2 rounded-full bg-gray-700 hover:bg-gray-800 text-white transition-colors"
                                          title={t('chatArea.downloadImage')}
                                        >
                                          {isDownloadingFile ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        </button>
                                      )}
                                    </div>
                                  );
                                }
                              }

                              // Verificar se é áudio que pode ser reproduzido
                              if (isPlayableAudio(att.type, att.name)) {
                                let audioUrl = null;
                                if (att.url && att.url.startsWith('http')) {
                                  audioUrl = att.url;
                                } else if (canDownload) {
                                  // Usar proxy inline do backend
                                  audioUrl = api.getAttachmentInlineUrl(
                                    att.conversation_id,
                                    att.message_id,
                                    att.id
                                  );
                                }

                                // Sempre mostrar player de áudio, mesmo sem URL válida
                                if (true) {
                                  return (
                                    <div key={att.id || attIdx} className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700" style={{ minWidth: '240px', maxWidth: '300px' }}>
                                      {audioUrl ? (
                                        <>
                                          {/* Player de áudio customizado */}
                                          <div className="flex items-center gap-3">
                                            {/* Botão Play/Pause */}
                                            <button
                                              onClick={() => toggleAudioPlay(att.id)}
                                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-blue-500 hover:bg-blue-600 text-white"
                                            >
                                              {audioStates[att.id]?.playing ? (
                                                <Pause className="w-5 h-5" />
                                              ) : (
                                                <Play className="w-5 h-5 ml-0.5" />
                                              )}
                                            </button>

                                            {/* Barra de progresso e tempo */}
                                            <div className="flex-1 min-w-0">
                                              {/* Barra de progresso clicável */}
                                              <div
                                                className="h-1.5 rounded-full cursor-pointer bg-gray-300 dark:bg-gray-500"
                                                onClick={(e) => handleAudioSeek(att.id, e)}
                                              >
                                                <div
                                                  className="h-full rounded-full transition-all bg-blue-500"
                                                  style={{
                                                    width: `${audioStates[att.id]?.duration ? (audioStates[att.id]?.currentTime / audioStates[att.id]?.duration) * 100 : 0}%`
                                                  }}
                                                />
                                              </div>
                                              {/* Tempo */}
                                              <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span>{formatAudioTime(audioStates[att.id]?.currentTime || 0)}</span>
                                                <span>{formatAudioTime(audioStates[att.id]?.duration || 0)}</span>
                                              </div>
                                            </div>

                                            {/* Botão Download */}
                                            {canDownload && (
                                              <button
                                                onClick={() => handleDownloadAttachment(att)}
                                                disabled={isDownloadingFile}
                                                className="p-2 rounded-full flex-shrink-0 transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400"
                                                title={t('chatArea.downloadAudio')}
                                              >
                                                {isDownloadingFile ? (
                                                  <Loader className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <Download className="w-4 h-4" />
                                                )}
                                              </button>
                                            )}
                                          </div>

                                          {/* Elemento audio oculto */}
                                          <audio
                                            ref={el => { if (el) audioRefs.current[att.id] = el; }}
                                            src={audioUrl}
                                            preload="metadata"
                                            onTimeUpdate={(e) => handleAudioTimeUpdate(att.id, e.target)}
                                            onLoadedMetadata={(e) => handleAudioTimeUpdate(att.id, e.target)}
                                            onEnded={() => setAudioStates(prev => ({ ...prev, [att.id]: { ...prev[att.id], playing: false, currentTime: 0 } }))}
                                            className="hidden"
                                          />
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-300 dark:bg-gray-600">
                                            <Music className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                          </div>
                                          <span className="text-xs flex-1 text-gray-500 dark:text-gray-400">
                                            {t('chatArea.audioNotAvailable', 'Áudio não disponível')}
                                          </span>
                                          {canDownload && (
                                            <button
                                              onClick={() => handleDownloadAttachment(att)}
                                              disabled={isDownloadingFile}
                                              className="px-3 py-1.5 text-xs rounded-full transition-colors bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-white"
                                            >
                                              {isDownloadingFile ? t('chatArea.downloading', 'Baixando...') : t('chatArea.download', 'Baixar')}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }
                              }

                              // Arquivo genérico (não é imagem, áudio ou sem URL)
                              return (
                                <div
                                  key={att.id || attIdx}
                                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
                                >
                                  <FileIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate text-gray-900 dark:text-gray-100">
                                      {att.name}
                                    </p>
                                    {att.size > 0 && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(att.size)}
                                      </p>
                                    )}
                                  </div>
                                  {canDownload ? (
                                    <button
                                      onClick={() => handleDownloadAttachment(att)}
                                      disabled={isDownloadingFile}
                                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                      title={t('chatArea.downloadFile')}
                                    >
                                      {isDownloadingFile ? (
                                        <Loader className="w-4 h-4 animate-spin text-gray-600 dark:text-gray-400" />
                                      ) : (
                                        <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {t('chatArea.sent')}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      {(() => {
        const isEmailChannel = conversation?.channel === 'email' ||
                               conversation?.source === 'email';

        // Email Composer for email channels
        if (isEmailChannel) {
          return (
            <EmailComposer
              onSend={async (emailData) => {
                try {
                  setIsSending(true);
                  setError(null);

                  const response = await api.sendMessage(conversationId, emailData.text_content || emailData.html_content, {
                    html_content: emailData.html_content,
                    subject: emailData.subject,
                    attachments: emailData.attachments
                  });

                  if (response.success) {
                    const sentMessage = {
                      id: response.data.id || Date.now(),
                      content: emailData.text_content,
                      html_content: emailData.html_content,
                      sender_type: 'user',
                      sent_at: new Date().toISOString(),
                      channel: 'email',
                      ...response.data
                    };
                    setMessages([...messages, sentMessage]);
                  }
                } catch (err) {
                  console.error('Erro ao enviar email:', err);
                  setError(t('chatArea.failedSendEmail'));
                } finally {
                  setIsSending(false);
                }
              }}
              disabled={isSending}
              placeholder={t('chatArea.writeReply')}
            />
          );
        }

        // Regular chat input for other channels
        return (
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
            {error && (
              <div className="mb-3 px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Preview de arquivos selecionados */}
            {selectedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {selectedFiles.map((file, index) => {
                  const FileIcon = getFileIcon(file.type);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                    >
                      <FileIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="max-w-[150px] truncate text-gray-900 dark:text-gray-100">{file.name}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Audio Recording UI */}
            {(isRecording || audioBlob) ? (
              <div className="flex items-center gap-3">
                {isRecording ? (
                  // Recording in progress
                  <>
                    <div className="flex items-center gap-3 flex-1 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                        {t('chatArea.recording')} {formatRecordingTime(recordingTime)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title={t('chatArea.cancelRecording')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex items-center gap-2 text-sm"
                    >
                      <Square className="w-4 h-4" />
                      <span>{t('chatArea.stopRecording')}</span>
                    </button>
                  </>
                ) : (
                  // Audio preview (after recording stopped)
                  <>
                    <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <Music className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <audio src={audioUrl} controls className="h-8 flex-1" />
                    </div>
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title={t('chatArea.cancelRecording')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={sendAudioMessage}
                      disabled={isSending}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 font-medium flex items-center gap-2 text-sm"
                    >
                      {isSending ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                      <span>{t('chatArea.sendAudio')}</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              // Normal message input
              <form onSubmit={handleSendMessage} className="flex items-end gap-3">
                {/* Input de arquivo oculto */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                />

                {/* Botão de anexar arquivo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || selectedFiles.length >= 5}
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('chatArea.attachFile')}
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Botão de gravar áudio */}
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isSending}
                  className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('chatArea.recordAudio')}
                >
                  <Mic className="w-5 h-5" />
                </button>

                <div className="flex-1 relative">
                  {/* Quick Replies + Roadmaps Dropdown (Slack-style with sections) */}
                  {showQuickReplies && (quickReplies.length > 0 || roadmaps.length > 0) && (
                    <div
                      ref={quickRepliesRef}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-80 overflow-hidden flex flex-col"
                    >
                      {/* Search hint header */}
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/90 rounded-t-xl flex-shrink-0">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {t('chatArea.slackStyleHint', '↑↓ navegar • Enter ou Tab selecionar • Esc fechar')}
                        </p>
                      </div>

                      {/* Scrollable sections list */}
                      <div className="overflow-y-auto flex-1">
                        {allDropdownItems.length > 0 ? (
                          <>
                            {dropdownSections.map((section, sectionIndex) => {
                              // Calculate the starting index for this section's items in the flat list
                              const startIndex = dropdownSections
                                .slice(0, sectionIndex)
                                .reduce((sum, s) => sum + s.items.length, 0);

                              return (
                                <div key={section.id}>
                                  {/* Section Header */}
                                  <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                      {section.title}
                                    </span>
                                  </div>

                                  {/* Section Items */}
                                  {section.items.map((item, itemIndex) => {
                                    const globalIndex = startIndex + itemIndex;
                                    const isSelected = globalIndex === selectedQuickReplyIndex;

                                    return (
                                      <button
                                        key={`${item._type}-${item.id}`}
                                        type="button"
                                        onClick={() => insertQuickReply(item)}
                                        className={`w-full text-left px-3 py-2 transition-all duration-100 ${
                                          isSelected
                                            ? 'bg-purple-50 dark:bg-purple-900/20'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {/* Icon */}
                                          {item._type === 'roadmap' ? (
                                            <Map className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                                          ) : (
                                            <MessageSquare className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                          )}

                                          {/* Title */}
                                          <span className={`font-medium text-sm flex-1 truncate ${
                                            isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'
                                          }`}>
                                            {item._type === 'roadmap' ? item.name : item.title}
                                          </span>

                                          {/* Shortcut badge */}
                                          {item.shortcut && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded font-mono flex-shrink-0">
                                              /{item.shortcut}
                                            </span>
                                          )}
                                        </div>

                                        {/* Description - only show if exists and item is selected */}
                                        {(item._type === 'roadmap' ? item.description : item.content) && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-6 truncate">
                                            {item._type === 'roadmap'
                                              ? (item.description || `${item.task_count || 0} ${t('chatArea.tasks', 'tarefas')}`)
                                              : item.content
                                            }
                                          </p>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {t('chatArea.noItemsFound', 'Nenhum item encontrado para')} "<span className="font-medium text-gray-700 dark:text-gray-300">{quickReplyFilter}</span>"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Empty state when no quick replies AND no roadmaps configured */}
                  {showQuickReplies && quickReplies.length === 0 && roadmaps.length === 0 && (
                    <div
                      ref={quickRepliesRef}
                      className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                      <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          {t('chatArea.noItemsConfigured', 'Você ainda não tem respostas rápidas ou roadmaps configurados')}
                        </p>
                        <div className="flex justify-center gap-4">
                          <button
                            type="button"
                            onClick={() => navigate('/config?tab=quick-replies')}
                            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium hover:underline"
                          >
                            {t('chatArea.configureQuickReplies', 'Configurar respostas rápidas →')}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/config?tab=roadmaps')}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium hover:underline"
                          >
                            {t('chatArea.configureRoadmaps', 'Configurar roadmaps →')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedFiles.length > 0 ? t('chatArea.addMessageOptional') : t('chatArea.typeMessage')}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 leading-normal"
                    rows="1"
                    style={{ maxHeight: '120px' }}
                    disabled={isSending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 text-sm"
                >
                  {isSending ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      <span>{t('chatArea.sending')}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>{t('chatArea.send')}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        );
      })()}

      {/* Modal de Visualização de Imagem */}
      {imageModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setImageModal({ isOpen: false, url: '', name: '' })}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            {/* Botão fechar */}
            <button
              onClick={() => setImageModal({ isOpen: false, url: '', name: '' })}
              className="absolute -top-10 right-0 p-2 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Imagem */}
            <img
              src={imageModal.url}
              alt={imageModal.name}
              crossOrigin="anonymous"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Nome do arquivo */}
            <p className="text-white text-center mt-3 text-sm opacity-75">
              {imageModal.name}
            </p>
          </div>
        </div>
      )}

      {/* Secret Agent Modal */}
      <SecretAgentModal
        isOpen={showSecretAgentModal}
        onClose={() => setShowSecretAgentModal(false)}
        conversationId={conversationId}
        onSuccess={() => {
          setShowSecretAgentModal(false);
        }}
      />

      {/* Conversation Invite Modal */}
      <ConversationInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        linkedinAccountId={conversation?.linkedin_account_id}
        contact={{
          name: conversation?.lead_name || conversation?.contact?.name,
          provider_id: conversation?.contact_linkedin_profile_id || conversation?.contact?.linkedin_profile_id,
          profile_picture: conversation?.lead_profile_picture || conversation?.contact?.profile_picture,
          headline: conversation?.contact?.headline || conversation?.contact_title,
          company: conversation?.contact?.company || conversation?.contact_company,
          title: conversation?.contact?.title || conversation?.contact_title
        }}
        onSuccess={() => {
          // Atualizar estado da conversa para mostrar convite pendente
          setConversation(prev => ({ ...prev, has_pending_invitation: true }));
          setShowInviteModal(false);
        }}
      />

      {/* Contact Details Modal */}
      <UnifiedContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        contactId={conversation?.contact_id}
      />

      {/* Roadmap Selector Modal */}
      <RoadmapSelector
        isOpen={showRoadmapSelector}
        onClose={() => {
          setShowRoadmapSelector(false);
          setSelectedRoadmapForExecution(null);
        }}
        roadmap={selectedRoadmapForExecution}
        contactId={conversation?.contact_id}
        conversationId={conversationId}
        onSuccess={() => {
          setShowRoadmapSelector(false);
          setSelectedRoadmapForExecution(null);
          // Dispatch event to notify DetailsPanel to reload roadmaps
          window.dispatchEvent(new CustomEvent('roadmap-executed', {
            detail: { contactId: conversation?.contact_id }
          }));
        }}
      />

      {/* Message Context Menu */}
      {messageMenu.isOpen && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
          style={{
            left: `${messageMenu.x}px`,
            top: `${messageMenu.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const message = messages.find(m => m.id === messageMenu.messageId);
              if (message) handleCopyMessage(message);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Copy className="w-4 h-4" />
            {t('chatArea.copyMessage')}
          </button>
          {canForwardMessage() && (
            <button
              onClick={() => {
                // TODO: Implement forward functionality via Unipile API
                closeMessageMenu();
                alert('Forward functionality coming soon');
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Forward className="w-4 h-4" />
              {t('chatArea.forwardMessage')}
            </button>
          )}
        </div>
      )}

      {/* Copy Success Toast */}
      {copySuccess && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {t('chatArea.messageCopied')}
        </div>
      )}
    </div>
  );
};

export default ChatArea;
