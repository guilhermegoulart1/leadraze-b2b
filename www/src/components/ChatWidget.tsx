import { useState, useRef, useEffect } from 'react';

// API_BASE should be the backend URL without /api (e.g., http://localhost:3001)
const API_BASE = (import.meta.env.PUBLIC_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');

// Unsplash avatar URLs for agents (Sarah = female, Alex = male)
const AGENT_AVATARS = {
  sales: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop&crop=face', // Professional woman
  support: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face' // Professional man
};

// Language configurations with flag images from flagcdn.com
const LANGUAGES = {
  en: { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
  'pt-BR': { code: 'pt-BR', name: 'Português', flagUrl: 'https://flagcdn.com/w40/br.png' },
  es: { code: 'es', name: 'Español', flagUrl: 'https://flagcdn.com/w40/es.png' }
};

const TRANSLATIONS = {
  en: {
    talkToSales: 'Talk to Sales',
    salesDesc: 'Learn about plans & features',
    getSupport: 'Get Support',
    supportDesc: 'Technical help & assistance',
    onlineNow: 'Online now',
    contactForm: 'Contact form',
    typeMessage: 'Type your message...',
    needHelp: 'Need human help? Contact us',
    poweredBy: 'Powered by GetRaze AI',
    name: 'Name',
    email: 'Email',
    company: 'Company',
    message: 'Message',
    sendMessage: 'Send Message',
    sending: 'Sending...',
    messageSent: 'Message sent!',
    wellGetBack: "We'll get back to you as soon as possible.",
    backToChat: 'Back to chat'
  },
  'pt-BR': {
    talkToSales: 'Falar com Vendas',
    salesDesc: 'Conheça planos e recursos',
    getSupport: 'Suporte Técnico',
    supportDesc: 'Ajuda técnica e assistência',
    onlineNow: 'Online agora',
    contactForm: 'Formulário de contato',
    typeMessage: 'Digite sua mensagem...',
    needHelp: 'Precisa de ajuda humana? Fale conosco',
    poweredBy: 'Powered by GetRaze AI',
    name: 'Nome',
    email: 'E-mail',
    company: 'Empresa',
    message: 'Mensagem',
    sendMessage: 'Enviar Mensagem',
    sending: 'Enviando...',
    messageSent: 'Mensagem enviada!',
    wellGetBack: 'Entraremos em contato o mais breve possível.',
    backToChat: 'Voltar ao chat'
  },
  es: {
    talkToSales: 'Hablar con Ventas',
    salesDesc: 'Conoce planes y funciones',
    getSupport: 'Soporte Técnico',
    supportDesc: 'Ayuda técnica y asistencia',
    onlineNow: 'En línea ahora',
    contactForm: 'Formulario de contacto',
    typeMessage: 'Escribe tu mensaje...',
    needHelp: '¿Necesitas ayuda humana? Contáctanos',
    poweredBy: 'Powered by GetRaze AI',
    name: 'Nombre',
    email: 'Correo',
    company: 'Empresa',
    message: 'Mensaje',
    sendMessage: 'Enviar Mensaje',
    sending: 'Enviando...',
    messageSent: '¡Mensaje enviado!',
    wellGetBack: 'Nos pondremos en contacto lo antes posible.',
    backToChat: 'Volver al chat'
  }
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  read: boolean;
}

interface Agent {
  agent_key: string;
  name: string;
  avatar_url: string | null;
  welcome_message: string;
  tone: string;
  language: string;
}

interface ContactFormData {
  name: string;
  email: string;
  company: string;
  message: string;
}

type WidgetState = 'closed' | 'selection' | 'chat' | 'contact' | 'minimized';

type LanguageCode = 'en' | 'pt-BR' | 'es';

export default function ChatWidget() {
  const [widgetState, setWidgetState] = useState<WidgetState>('closed');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [unreadCount, setUnreadCount] = useState(0);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormData>({
    name: '',
    email: '',
    company: '',
    message: ''
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current translations
  const t = TRANSLATIONS[language];

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Mark messages as read when chat is open
  useEffect(() => {
    if (widgetState === 'chat') {
      setMessages(prev => prev.map(m => ({ ...m, read: true })));
      setUnreadCount(0);
    }
  }, [widgetState]);

  // Listen for openSalesChat event from header button
  useEffect(() => {
    const handleOpenSalesChat = () => {
      // Find sales agent or use first agent
      const salesAgent = agents.find(a => a.agent_key === 'sales') || agents[0];
      if (salesAgent) {
        setSelectedAgent(salesAgent);
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: salesAgent.welcome_message,
            timestamp: new Date(),
            read: true
          }
        ]);
        setWidgetState('chat');
        setUnreadCount(0);
      }
    };

    window.addEventListener('openSalesChat', handleOpenSalesChat);
    return () => window.removeEventListener('openSalesChat', handleOpenSalesChat);
  }, [agents]);

  const fetchAgents = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/public/website-chat/agents`);
      const data = await response.json();
      if (data.success) {
        setAgents(data.data);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      // Set fallback agents if API fails
      setAgents([
        {
          agent_key: 'sales',
          name: 'Sarah Miller',
          avatar_url: AGENT_AVATARS.sales,
          welcome_message: "Hi! I'm Sarah, your sales specialist. I'm here to help you find the perfect solution for your business. What can I help you with today?",
          tone: 'professional',
          language: 'en'
        },
        {
          agent_key: 'support',
          name: 'Alex Chen',
          avatar_url: AGENT_AVATARS.support,
          welcome_message: "Hello! I'm Alex from technical support. I'm here to help you with any questions or issues you might have. How can I assist you?",
          tone: 'professional',
          language: 'en'
        }
      ]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getAgentAvatar = (agentKey: string) => {
    return AGENT_AVATARS[agentKey as keyof typeof AGENT_AVATARS] || AGENT_AVATARS.sales;
  };

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: agent.welcome_message,
        timestamp: new Date(),
        read: true
      }
    ]);
    setWidgetState('chat');
    setUnreadCount(0);
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      read: true
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageText = input.trim();
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/api/public/website-chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentKey: selectedAgent.agent_key,
          sessionId,
          message: messageText,
          history: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.data.message,
          timestamp: new Date(),
          read: widgetState === 'chat'
        };
        setMessages((prev) => [...prev, botMessage]);

        // Update unread count if minimized
        if (widgetState === 'minimized') {
          setUnreadCount(prev => prev + 1);
        }
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Would you like to fill out a contact form instead?",
        timestamp: new Date(),
        read: widgetState === 'chat'
      };
      setMessages((prev) => [...prev, errorMessage]);

      if (widgetState === 'minimized') {
        setUnreadCount(prev => prev + 1);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/public/website-chat/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          agentKey: selectedAgent?.agent_key || 'support',
          ...contactForm
        })
      });

      const data = await response.json();
      if (data.success) {
        setContactSuccess(true);
      }
    } catch (error) {
      console.error('Error submitting contact form:', error);
    } finally {
      setContactSubmitting(false);
    }
  };

  const toggleWidget = () => {
    if (widgetState === 'closed') {
      setWidgetState('selection');
    } else if (widgetState === 'minimized') {
      setWidgetState('chat');
      setUnreadCount(0);
    } else {
      setWidgetState('closed');
      setSelectedAgent(null);
      setMessages([]);
      setUnreadCount(0);
    }
  };

  const minimizeChat = () => {
    setWidgetState('minimized');
  };

  const goBack = () => {
    if (widgetState === 'contact') {
      setWidgetState('chat');
    } else if (widgetState === 'chat') {
      setWidgetState('selection');
      setSelectedAgent(null);
      setMessages([]);
    }
  };

  const closeChat = () => {
    setWidgetState('closed');
    setSelectedAgent(null);
    setMessages([]);
    setUnreadCount(0);
  };

  const showOverlay = widgetState === 'chat' || widgetState === 'contact';

  return (
    <>
      {/* Overlay Background */}
      {showOverlay && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={minimizeChat}
        />
      )}

      {/* Floating Button with Agent Avatars (Selection Mode) */}
      {widgetState === 'selection' && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 animate-in">
          {/* Close button */}
          <button
            onClick={closeChat}
            className="w-10 h-10 bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-700 transition-all"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Agent Selection Cards */}
          <div className="flex flex-col gap-3">
            {/* Sales Agent */}
            <button
              onClick={() => selectAgent(agents.find(a => a.agent_key === 'sales') || agents[0])}
              className="flex items-center gap-4 bg-white rounded-full pl-2 pr-6 py-2.5 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
            >
              <img
                src={getAgentAvatar('sales')}
                alt="Sales Agent"
                className="w-14 h-14 rounded-full object-cover border-2 border-green-400"
              />
              <div className="text-left">
                <p className="font-semibold text-gray-900">{t.talkToSales}</p>
                <p className="text-sm text-gray-500">{t.salesDesc}</p>
              </div>
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
            </button>

            {/* Support Agent */}
            <button
              onClick={() => selectAgent(agents.find(a => a.agent_key === 'support') || agents[1])}
              className="flex items-center gap-4 bg-white rounded-full pl-2 pr-6 py-2.5 shadow-xl hover:shadow-2xl transition-all hover:scale-105 group"
            >
              <img
                src={getAgentAvatar('support')}
                alt="Support Agent"
                className="w-14 h-14 rounded-full object-cover border-2 border-blue-400"
              />
              <div className="text-left">
                <p className="font-semibold text-gray-900">{t.getSupport}</p>
                <p className="text-sm text-gray-500">{t.supportDesc}</p>
              </div>
              <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Button (Closed or Minimized state) */}
      {(widgetState === 'closed' || widgetState === 'minimized') && (
        <button
          onClick={toggleWidget}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 hover:scale-110 hover:shadow-2xl group"
          aria-label="Open chat"
        >
          {widgetState === 'minimized' && selectedAgent ? (
            <div className="relative">
              <img
                src={getAgentAvatar(selectedAgent.agent_key)}
                alt={selectedAgent.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white"
              />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </div>
          ) : (
            <svg className="w-7 h-7 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </button>
      )}

      {/* Chat Modal (Centered) */}
      {(widgetState === 'chat' || widgetState === 'contact') && selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden pointer-events-auto animate-modal-in flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)', minHeight: '500px' }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                {widgetState === 'contact' && (
                  <button
                    onClick={goBack}
                    className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <div className="relative">
                  <img
                    src={getAgentAvatar(selectedAgent.agent_key)}
                    alt={selectedAgent.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/30"
                  />
                  <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-purple-600" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-xl">
                    {selectedAgent.agent_key === 'sales' ? 'Sarah Miller' : 'Alex Chen'}
                  </h3>
                  <p className="text-purple-200 text-sm flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-green-400 rounded-full" />
                    {widgetState === 'contact' ? t.contactForm : t.onlineNow}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Language Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="h-10 px-3 bg-white/20 rounded-full flex items-center gap-2 hover:bg-white/30 transition-colors text-white text-sm"
                  >
                    <img
                      src={LANGUAGES[language].flagUrl}
                      alt={LANGUAGES[language].name}
                      className="w-6 h-4 object-cover rounded-sm"
                    />
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showLangMenu && (
                    <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl py-2 min-w-[160px] z-10">
                      {Object.values(LANGUAGES).map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code as LanguageCode);
                            setShowLangMenu(false);
                          }}
                          className={`w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                            language === lang.code ? 'bg-purple-50 text-purple-600' : 'text-gray-700'
                          }`}
                        >
                          <img
                            src={lang.flagUrl}
                            alt={lang.name}
                            className="w-6 h-4 object-cover rounded-sm"
                          />
                          <span className="text-sm font-medium">{lang.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Minimize Button */}
                <button
                  onClick={minimizeChat}
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                  title="Minimize"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Close Button */}
                <button
                  onClick={closeChat}
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                  title="Close"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat Messages - LLM Style */}
            {widgetState === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gray-50 min-h-0" style={{ minHeight: '350px' }}>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      {/* Avatar */}
                      <div className="shrink-0">
                        {message.role === 'assistant' ? (
                          <img
                            src={getAgentAvatar(selectedAgent.agent_key)}
                            alt={selectedAgent.name}
                            className="w-11 h-11 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-purple-600 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 px-2">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Typing Indicator */}
                  {isTyping && (
                    <div className="flex gap-4">
                      <div className="shrink-0">
                        <img
                          src={getAgentAvatar(selectedAgent.agent_key)}
                          alt={selectedAgent.name}
                          className="w-11 h-11 rounded-full object-cover border border-gray-200"
                        />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 shadow-sm">
                        <div className="flex gap-2">
                          <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area - LLM Style */}
                <div className="p-5 border-t border-gray-200 bg-white shrink-0">
                  <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder={t.typeMessage}
                      rows={2}
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm resize-none max-h-32 py-2"
                      style={{ minHeight: '44px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isTyping}
                      className="w-11 h-11 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-4 px-2">
                    <button
                      onClick={() => setWidgetState('contact')}
                      className="text-sm text-gray-500 hover:text-purple-600 transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {t.needHelp}
                    </button>
                    <span className="text-xs text-gray-400">{t.poweredBy}</span>
                  </div>
                </div>
              </>
            )}

            {/* Contact Form */}
            {widgetState === 'contact' && (
              <div className="flex-1 overflow-y-auto p-8">
                {contactSuccess ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t.messageSent}</h3>
                    <p className="text-gray-600 mb-6">{t.wellGetBack}</p>
                    <button
                      onClick={() => {
                        setContactSuccess(false);
                        setContactForm({ name: '', email: '', company: '', message: '' });
                        setWidgetState('chat');
                      }}
                      className="text-purple-600 font-medium hover:underline"
                    >
                      {t.backToChat}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t.name} *</label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t.email} *</label>
                        <input
                          type="email"
                          required
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t.company}</label>
                      <input
                        type="text"
                        value={contactForm.company}
                        onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t.message} *</label>
                      <textarea
                        required
                        rows={4}
                        value={contactForm.message}
                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={contactSubmitting}
                      className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 transition-all hover:scale-[1.02] text-base"
                    >
                      {contactSubmitting ? t.sending : t.sendMessage}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes animate-in {
          from {
            opacity: 0;
            transform: translateY(1rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-in {
          animation: animate-in 0.3s ease-out;
        }

        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
