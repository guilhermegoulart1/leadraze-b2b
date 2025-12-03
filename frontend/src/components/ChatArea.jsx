// frontend/src/components/ChatArea.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Bot, User, Loader, AlertCircle, Linkedin, Mail,
  ToggleLeft, ToggleRight, SidebarOpen, SidebarClose, MoreVertical, CheckCircle, RotateCcw,
  Paperclip, X, FileText, Image, Film, Music, File, Download, Pencil, Check
} from 'lucide-react';
import api from '../services/api';
import { joinConversation, leaveConversation, onNewMessage } from '../services/socket';
import EmailComposer from './EmailComposer';
import EmailMessage from './EmailMessage';

const ChatArea = ({ conversationId, onToggleDetails, showDetailsPanel, onConversationRead, onConversationClosed, onConversationUpdated }) => {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDownloading, setIsDownloading] = useState({});
  // Estado para modal de visualização de imagem
  const [imageModal, setImageModal] = useState({ isOpen: false, url: '', name: '' });
  // Estado para edição de nome
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const optionsMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentConversationIdRef = useRef(null);
  const nameInputRef = useRef(null);

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

  // ✅ WebSocket: Entrar/sair da sala de conversa e escutar novas mensagens
  useEffect(() => {
    if (!conversationId) return;

    // Entrar na sala da conversa
    joinConversation(conversationId);

    // Escutar novas mensagens via WebSocket
    const unsubscribe = onNewMessage((data) => {
      // Só processar se for da conversa atual
      if (data.conversationId === conversationId || data.conversationId === parseInt(conversationId)) {
        console.log('ChatArea: Nova mensagem recebida via WebSocket', data);

        // Verificar se a mensagem já existe (evitar duplicatas)
        setMessages(prevMessages => {
          const messageExists = prevMessages.some(m =>
            m.id === data.message?.id ||
            m.unipile_message_id === data.message?.unipile_message_id
          );

          if (messageExists) {
            return prevMessages;
          }

          // Adicionar nova mensagem
          return [...prevMessages, data.message];
        });
      }
    });

    // Cleanup: sair da sala e remover listener
    return () => {
      leaveConversation(conversationId);
      unsubscribe();
    };
  }, [conversationId]);

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target)) {
        setShowOptionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        setError('Falha ao carregar mensagens');
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
        setShowOptionsMenu(false);
        // Notificar o componente pai para atualizar a lista
        if (onConversationClosed) {
          onConversationClosed(conversationId);
        }
      }
    } catch (error) {
      console.error('Erro ao fechar conversa:', error);
      setError('Falha ao fechar conversa');
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
        setShowOptionsMenu(false);
        // Notificar o componente pai para atualizar a lista
        if (onConversationClosed) {
          onConversationClosed(conversationId);
        }
      }
    } catch (error) {
      console.error('Erro ao reabrir conversa:', error);
      setError('Falha ao reabrir conversa');
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
      setError('Falha ao enviar mensagem');
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
      setError('Falha ao alternar modo IA');
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
      setError('Falha ao salvar nome');
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

    // Se for hoje, mostrar só horário
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    // Se foi ontem
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Ontem às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Se foi este ano, mostrar data sem ano
    if (date.getFullYear() === now.getFullYear()) {
      return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // Se foi ano passado, mostrar com ano
    return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
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
    setNewMessage(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
      setError('Máximo de 5 arquivos por mensagem');
      return;
    }

    // Verificar tamanho máximo (15MB cada)
    const maxSize = 15 * 1024 * 1024;
    const oversizedFiles = files.filter(f => f.size > maxSize);
    if (oversizedFiles.length > 0) {
      setError(`Arquivo(s) muito grande(s). Máximo: 15MB`);
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
      setError('Arquivo ainda sendo processado. Tente novamente em alguns segundos.');
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
      setError('Falha ao baixar arquivo');
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
    // IDs que contêm caracteres problemáticos para URL (como : ou /) não funcionam
    const hasInvalidChars = /[/:?#]/.test(String(attachment.id));
    if (hasInvalidChars) {
      return false;
    }
    return true;
  };

  // Verificar se é uma imagem que pode ser exibida inline
  const isDisplayableImage = (type) => {
    return type && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type);
  };

  // Verificar se é um áudio que pode ser reproduzido
  const isPlayableAudio = (type) => {
    return type && (
      type.startsWith('audio/') ||
      type === 'audio/ogg' ||
      type === 'audio/opus' ||
      type === 'audio/mpeg' ||
      type === 'audio/mp3' ||
      type === 'audio/wav' ||
      type === 'audio/webm' ||
      type === 'audio/aac' ||
      type === 'audio/m4a'
    );
  };

  // Empty State
  if (!conversationId) {
    return (
      <div className="flex-1 bg-white flex items-center justify-center">
        <div className="text-center">
          <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Selecione uma conversa</p>
          <p className="text-sm text-gray-500 mt-1">
            Escolha uma conversa da lista para começar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white flex flex-col h-full">
      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
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
                <div className="h-5 bg-gray-200 rounded animate-pulse w-32 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-48"></div>
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
                        className="font-semibold text-gray-900 border border-purple-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isSavingName}
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSavingName || !editedName.trim()}
                        className="p-1 text-green-600 hover:bg-green-100 rounded-full transition-colors disabled:opacity-50"
                        title="Salvar"
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
                        className="p-1 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 group">
                      <h2 className="font-semibold text-gray-900 truncate">
                        {/* Mostrar group_name para grupos, senão lead_name */}
                        {conversation?.is_group && conversation?.group_name
                          ? conversation.group_name
                          : (conversation?.lead_name || 'Carregando...')}
                      </h2>
                      {/* Botão de editar (visível em hover ou sempre para contatos orgânicos) */}
                      {!conversation?.is_group && (
                        <button
                          onClick={handleStartEditName}
                          className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          title="Editar nome"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                  {/* Badge de grupo */}
                  {conversation?.is_group && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex-shrink-0">
                      Grupo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  {conversation?.is_group ? (
                    <span className="truncate">
                      {conversation?.attendee_count || 2} participantes
                    </span>
                  ) : (
                    <>
                      {/* Mostrar telefone se for conversa orgânica */}
                      {conversation?.lead_phone && (
                        <span className="truncate text-purple-600">{conversation.lead_phone}</span>
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
          {/* AI Toggle */}
          <button
            onClick={handleToggleAI}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              conversation?.status === 'ai_active'
                ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            {conversation?.status === 'ai_active' ? (
              <>
                <ToggleRight className="w-4 h-4" />
                <span>IA Ativa</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>Manual</span>
              </>
            )}
          </button>

          {/* Channel Indicator */}
          {conversation?.channel === 'email' || conversation?.source === 'email' ? (
            <div
              className="p-2 text-blue-600 bg-blue-50 rounded-lg"
              title="Conversa por Email"
            >
              <Mail className="w-5 h-5" />
            </div>
          ) : conversation?.lead_profile_url ? (
            <a
              href={conversation.lead_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Ver perfil no LinkedIn"
            >
              <Linkedin className="w-5 h-5" />
            </a>
          ) : null}

          {/* Options Menu */}
          <div className="relative" ref={optionsMenuRef}>
            <button
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Mais opções"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showOptionsMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {conversation?.status === 'closed' ? (
                  <button
                    onClick={handleReopenConversation}
                    className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reabrir conversa
                  </button>
                ) : (
                  <button
                    onClick={handleCloseConversation}
                    className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-green-50 flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Fechar conversa
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Toggle Details Panel */}
          <button
            onClick={onToggleDetails}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={showDetailsPanel ? 'Esconder detalhes' : 'Mostrar detalhes'}
          >
            {showDetailsPanel ? (
              <SidebarClose className="w-5 h-5" />
            ) : (
              <SidebarOpen className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Carregando mensagens...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={loadMessages}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">Nenhuma mensagem ainda</p>
              <p className="text-sm text-gray-500 mt-1">
                Envie a primeira mensagem para iniciar a conversa
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
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
                    senderName={isUser ? 'Você' : (isAI ? 'IA' : conversation?.lead_name)}
                    senderType={isUser ? 'user' : (isAI ? 'ai' : 'lead')}
                    timestamp={message.sent_at || message.date}
                  />
                );
              }

              // Regular chat message rendering for non-email channels
              return (
                <div
                  key={message.id || index}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`flex items-start gap-2 max-w-lg ${
                      isUser ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isUser
                          ? 'bg-purple-600 text-white'
                          : isAI
                          ? 'bg-green-600 text-white'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isUser ? (
                        <User className="w-4 h-4" />
                      ) : isAI ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-semibold">
                          {conversation?.lead_name?.charAt(0) || 'L'}
                        </span>
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div>
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isUser
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-900'
                        }`}
                      >
                        {/* Texto da mensagem */}
                        {(message.content || message.text) && (
                          <p className={`text-sm whitespace-pre-wrap ${isUser ? '[&_a]:text-white [&_a]:underline [&_a:hover]:text-blue-100' : '[&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800'}`}>
                            {linkifyText(message.content || message.text)}
                          </p>
                        )}

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className={`${(message.content || message.text) ? 'mt-2 pt-2 border-t' : ''} ${isUser ? 'border-purple-500' : 'border-gray-200'} space-y-2`}>
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
                                          className={`absolute bottom-2 right-2 p-2 rounded-full ${isUser ? 'bg-purple-700 hover:bg-purple-800' : 'bg-gray-700 hover:bg-gray-800'} text-white transition-colors`}
                                          title="Baixar imagem"
                                        >
                                          {isDownloadingFile ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        </button>
                                      )}
                                    </div>
                                  );
                                }
                              }

                              // Verificar se é áudio que pode ser reproduzido
                              if (isPlayableAudio(att.type)) {
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

                                if (audioUrl) {
                                  return (
                                    <div key={att.id || attIdx} className={`p-3 rounded-lg ${isUser ? 'bg-purple-700' : 'bg-gray-100'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <Music className={`w-4 h-4 ${isUser ? 'text-purple-200' : 'text-gray-500'}`} />
                                        <span className={`text-xs truncate flex-1 ${isUser ? 'text-purple-200' : 'text-gray-600'}`}>
                                          {att.name}
                                        </span>
                                        {canDownload && (
                                          <button
                                            onClick={() => handleDownloadAttachment(att)}
                                            disabled={isDownloadingFile}
                                            className={`p-1 rounded-full ${isUser ? 'hover:bg-purple-600' : 'hover:bg-gray-200'} transition-colors`}
                                            title="Baixar áudio"
                                          >
                                            {isDownloadingFile ? (
                                              <Loader className={`w-4 h-4 animate-spin ${isUser ? 'text-white' : 'text-gray-600'}`} />
                                            ) : (
                                              <Download className={`w-4 h-4 ${isUser ? 'text-white' : 'text-gray-600'}`} />
                                            )}
                                          </button>
                                        )}
                                      </div>
                                      <audio
                                        controls
                                        className="w-full h-10"
                                        style={{
                                          filter: isUser ? 'invert(1) hue-rotate(180deg)' : 'none',
                                          maxWidth: '280px'
                                        }}
                                        preload="metadata"
                                      >
                                        <source src={audioUrl} type={att.type} />
                                        Seu navegador não suporta áudio.
                                      </audio>
                                    </div>
                                  );
                                }
                              }

                              // Arquivo genérico (não é imagem, áudio ou sem URL)
                              return (
                                <div
                                  key={att.id || attIdx}
                                  className={`flex items-center gap-2 p-2 rounded-lg ${isUser ? 'bg-purple-700' : 'bg-gray-100'}`}
                                >
                                  <FileIcon className={`w-5 h-5 ${isUser ? 'text-purple-200' : 'text-gray-500'}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate ${isUser ? 'text-white' : 'text-gray-900'}`}>
                                      {att.name}
                                    </p>
                                    {att.size > 0 && (
                                      <p className={`text-xs ${isUser ? 'text-purple-200' : 'text-gray-500'}`}>
                                        {formatFileSize(att.size)}
                                      </p>
                                    )}
                                  </div>
                                  {canDownload ? (
                                    <button
                                      onClick={() => handleDownloadAttachment(att)}
                                      disabled={isDownloadingFile}
                                      className={`p-2 rounded-full ${isUser ? 'hover:bg-purple-600' : 'hover:bg-gray-200'} transition-colors`}
                                      title="Baixar arquivo"
                                    >
                                      {isDownloadingFile ? (
                                        <Loader className={`w-4 h-4 animate-spin ${isUser ? 'text-white' : 'text-gray-600'}`} />
                                      ) : (
                                        <Download className={`w-4 h-4 ${isUser ? 'text-white' : 'text-gray-600'}`} />
                                      )}
                                    </button>
                                  ) : (
                                    <span className={`text-xs ${isUser ? 'text-purple-300' : 'text-gray-400'}`}>
                                      Enviado ✓
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 ${
                          isUser ? 'text-right text-gray-500' : 'text-left text-gray-500'
                        }`}
                      >
                        {formatMessageTime(message.sent_at || message.date)}
                      </p>
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
                  setError('Falha ao enviar email');
                } finally {
                  setIsSending(false);
                }
              }}
              disabled={isSending}
              placeholder="Escreva sua resposta..."
            />
          );
        }

        // Regular chat input for other channels
        return (
          <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
            {error && (
              <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
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
                      className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm"
                    >
                      <FileIcon className="w-4 h-4 text-gray-600" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <span className="text-gray-500 text-xs">({formatFileSize(file.size)})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

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
                className="p-3 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Anexar arquivo (máx. 5)"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={selectedFiles.length > 0 ? "Adicione uma mensagem (opcional)..." : "Digite sua mensagem... (Enter para enviar)"}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows="1"
                  style={{ maxHeight: '120px' }}
                  disabled={isSending}
                />
              </div>

              <button
                type="submit"
                disabled={(!newMessage.trim() && selectedFiles.length === 0) || isSending}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Enviar</span>
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-500 mt-2">
              {conversation?.status === 'ai_active'
                ? 'A IA está monitorando esta conversa e responderá automaticamente'
                : 'Você está no controle manual desta conversa'}
              {' • '}
              <span className="text-gray-400">Arquivos: imagens, PDF, documentos (máx. 15MB cada)</span>
            </p>
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
    </div>
  );
};

export default ChatArea;
