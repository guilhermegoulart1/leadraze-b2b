import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X, Building2, User, TrendingUp, Link2,
  Send, Loader2, ChevronRight, Linkedin, CheckCircle2
} from 'lucide-react';
import api from '../../services/api';

// Agent avatar - Director Morgan (the one who briefs you)
const AGENT_AVATAR = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face';
const AGENT_NAME = 'Director Morgan';
const AGENT_ROLE = 'Diretor de Operações';

const INVESTIGATION_TYPES = [
  { id: 'company', icon: Building2, color: 'from-blue-500 to-blue-700' },
  { id: 'person', icon: User, color: 'from-pink-500 to-pink-700' },
  { id: 'niche', icon: TrendingUp, color: 'from-green-500 to-green-700' },
  { id: 'connection', icon: Link2, color: 'from-purple-500 to-purple-700' }
];

// Typewriter text component - faster speed (12ms per char)
const TypewriterText = React.memo(({ text, speed = 12, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref updated without causing re-render
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!text) return;

    let index = 0;
    setDisplayedText('');
    setIsComplete(false);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        setIsComplete(true);
        onCompleteRef.current?.();
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]); // Removed onComplete from deps - using ref instead

  return (
    <span>
      {displayedText}
      {!isComplete && <span className="animate-pulse">▊</span>}
    </span>
  );
});

// Chat message component - memoized to prevent re-renders
const ChatMessage = React.memo(({ message, isAgent, avatar, useTypewriter, messageIndex, onTypewriterComplete }) => (
  <div className={`flex gap-3 ${isAgent ? '' : 'flex-row-reverse'}`}>
    {isAgent && (
      <div className="flex-shrink-0">
        <img
          src={avatar || AGENT_AVATAR}
          alt="Agent"
          className="w-10 h-10 rounded-full border-2 border-purple-500/50 object-cover"
        />
      </div>
    )}
    <div
      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
        isAgent
          ? 'bg-gray-800/80 text-gray-200 rounded-tl-sm'
          : 'bg-purple-600 text-white rounded-tr-sm'
      }`}
    >
      {useTypewriter ? (
        <p className="text-sm leading-relaxed whitespace-pre-line">
          <TypewriterText
            text={message}
            speed={12}
            onComplete={() => onTypewriterComplete(messageIndex)}
          />
        </p>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-line">{message}</p>
      )}
    </div>
  </div>
));

// Quick reply button
const QuickReply = ({ children, onClick, icon: Icon, color, selected = false }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium
      ${selected
        ? 'bg-purple-600 border-purple-500 text-white'
        : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-purple-500/50 hover:bg-gray-800'
      }
      hover:scale-105 active:scale-95
    `}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
  </button>
);

/**
 * Start Investigation Modal - Conversational FBI-themed experience
 */
const StartInvestigationModal = ({ onClose, onStart }) => {
  const { t } = useTranslation('secretAgent');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [currentTypingIndex, setCurrentTypingIndex] = useState(-1);
  const [userInput, setUserInput] = useState('');
  const [inputEnabled, setInputEnabled] = useState(false);
  const messagesEndRef = useRef(null);
  const initialized = useRef(false);
  const [linkedInAccounts, setLinkedInAccounts] = useState([]);
  const [hasLinkedIn, setHasLinkedIn] = useState(false);

  const [formData, setFormData] = useState({
    targetType: null,
    targetName: '',
    objective: '',
    cnpj: '',
    domain: '',
    // Enhanced fields per type
    industry: '',           // company: sector/industry
    companySize: '',        // company: size (small/medium/large)
    departments: '',        // company: departments of interest
    knownContacts: '',      // company/person: known contacts
    relationship: '',       // company: existing relationship
    currentCompany: '',     // person: their current company
    currentRole: '',        // person: their role/title
    connectionReason: '',   // person/connection: why connect
    linkedinUrl: '',        // person/connection: LinkedIn profile URL
    region: '',             // niche: geographic region
    targetSize: '',         // niche: target company size
    productService: '',     // niche: what you sell
    mutualContext: '',      // connection: events, groups, etc.
    useLinkedIn: false      // whether to use LinkedIn API
  });

  // Check for LinkedIn accounts on mount
  useEffect(() => {
    const checkLinkedIn = async () => {
      try {
        const response = await api.getLinkedInAccounts();
        if (response.success && response.data?.length > 0) {
          setLinkedInAccounts(response.data.filter(acc => acc.status === 'active'));
          setHasLinkedIn(response.data.some(acc => acc.status === 'active'));
        }
      } catch (error) {
        console.log('LinkedIn check skipped:', error.message);
      }
    };
    checkLinkedIn();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTypingIndex]);

  // Handle typewriter complete - mark message as done
  const handleTypewriterComplete = useCallback((messageIndex) => {
    setMessages(prev => prev.map((msg, i) =>
      i === messageIndex ? { ...msg, typingComplete: true } : msg
    ));
  }, []);

  // Add agent message with typewriter
  const addAgentMessage = useCallback((text, nextStep = null) => {
    setInputEnabled(false);
    const newIndex = messages.length;
    setMessages(prev => [...prev, { text, isAgent: true, useTypewriter: true }]);
    setCurrentTypingIndex(newIndex);

    if (nextStep !== null) {
      // We'll set step after typewriter completes (12ms per char + buffer)
      const textLength = text.length;
      const duration = textLength * 12 + 100;
      setTimeout(() => {
        setStep(nextStep);
      }, duration);
    }
  }, [messages.length]);

  // Queue multiple agent messages
  const queueAgentMessages = useCallback(async (messageList) => {
    setInputEnabled(false);

    for (let i = 0; i < messageList.length; i++) {
      const { text, nextStep } = messageList[i];
      const msgId = Date.now() + i; // Unique ID for each message

      // Add message and set typing index
      setMessages(prev => {
        const newIndex = prev.length;
        setCurrentTypingIndex(newIndex);
        return [...prev, { text, isAgent: true, useTypewriter: true, id: msgId }];
      });

      // Wait for typewriter to finish (12ms per char + 250ms buffer for safety)
      const duration = text.length * 12 + 250;
      await new Promise(resolve => setTimeout(resolve, duration));

      // Mark as complete manually (in case onComplete didn't fire)
      setMessages(prev => prev.map(msg =>
        msg.id === msgId ? { ...msg, typingComplete: true } : msg
      ));

      if (nextStep !== null) {
        setStep(nextStep);
      }
    }

    setInputEnabled(true);
  }, []);

  // Initial greeting - only run once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const greeting = t('conversation.greeting', {
      defaultValue: `Olá, agente. Sou ${AGENT_NAME}, ${AGENT_ROLE} da Central de Inteligência GetRaze.`
    });

    const intro = t('conversation.intro', {
      defaultValue: 'Minha equipe está pronta para iniciar uma investigação de inteligência completa. Temos 5 especialistas que vão coletar dados em tempo real de múltiplas fontes.'
    });

    const askType = t('conversation.askType', {
      defaultValue: 'Para começar, me diga: qual é o tipo de investigação que você precisa?'
    });

    queueAgentMessages([
      { text: greeting, nextStep: null },
      { text: intro, nextStep: null },
      { text: askType, nextStep: 1 }
    ]);
  }, [t, queueAgentMessages]);

  // Handle type selection
  const handleTypeSelect = async (type) => {
    setFormData(prev => ({ ...prev, targetType: type }));
    setMessages(prev => [...prev, { text: t(`types.${type}`), isAgent: false, id: Date.now() }]);
    setInputEnabled(false);

    const typeMessages = {
      company: t('conversation.companySelected', { defaultValue: 'Excelente escolha. Investigações de empresas são nossa especialidade. Vamos descobrir tudo: dados cadastrais, decisores, notícias, conexões...' }),
      person: t('conversation.personSelected', { defaultValue: 'Certo. Vamos investigar essa pessoa a fundo: histórico profissional, presença digital, conexões, menções na mídia...' }),
      niche: t('conversation.nicheSelected', { defaultValue: 'Interessante. Uma análise de mercado completa: players principais, tendências, oportunidades, tamanho do mercado...' }),
      connection: t('conversation.connectionSelected', { defaultValue: 'Entendido. Vamos mapear os caminhos para você se conectar: conexões em comum, eventos, empresas, pessoas-ponte...' })
    };

    const askName = {
      company: t('conversation.askCompanyName', { defaultValue: 'Qual é o nome da empresa que você quer investigar?' }),
      person: t('conversation.askPersonName', { defaultValue: 'Qual é o nome da pessoa que você quer investigar?' }),
      niche: t('conversation.askNicheName', { defaultValue: 'Qual nicho ou segmento de mercado você quer analisar?' }),
      connection: t('conversation.askConnectionName', { defaultValue: 'Com quem você quer se conectar? (nome da pessoa ou empresa)' })
    };

    const detailHint = {
      company: t('conversation.companyHint', { defaultValue: 'Vou precisar de alguns detalhes para direcionar melhor minha equipe.' }),
      person: t('conversation.personHint', { defaultValue: 'Quanto mais informações você me der, mais precisa será a investigação.' }),
      niche: t('conversation.nicheHint', { defaultValue: 'Vou coletar informações estratégicas sobre esse mercado para você.' }),
      connection: t('conversation.connectionHint', { defaultValue: 'Vou mapear todos os caminhos possíveis para essa conexão.' })
    };

    await queueAgentMessages([
      { text: typeMessages[type], nextStep: null },
      { text: detailHint[type], nextStep: null },
      { text: askName[type], nextStep: 2 }
    ]);
  };

  // Handle user text input
  const handleSendMessage = async () => {
    if (!userInput.trim() || !inputEnabled) return;

    const input = userInput.trim();
    setUserInput('');
    setMessages(prev => [...prev, { text: input, isAgent: false, id: Date.now() }]);
    setInputEnabled(false);

    const { targetType } = formData;

    // Step 2: Target name received - ask first detail question
    if (step === 2) {
      setFormData(prev => ({ ...prev, targetName: input }));

      const confirmTarget = t('conversation.confirmTarget', {
        target: input,
        defaultValue: `"${input}" - registrado. Vou mobilizar a equipe para investigar.`
      });

      // First detail question varies by type
      let detailQuestion;
      if (targetType === 'company') {
        detailQuestion = t('conversation.askIndustry', {
          defaultValue: 'Qual é o setor ou indústria dessa empresa? (ex: tecnologia, saúde, varejo, indústria...)'
        });
      } else if (targetType === 'person') {
        detailQuestion = t('conversation.askPersonCompany', {
          defaultValue: 'Em qual empresa essa pessoa trabalha atualmente? (se souber)'
        });
      } else if (targetType === 'niche') {
        detailQuestion = t('conversation.askNicheRegion', {
          defaultValue: 'Qual região geográfica te interessa? (ex: Brasil, América Latina, Global...)'
        });
      } else { // connection
        detailQuestion = t('conversation.askConnectionReason', {
          defaultValue: 'Por que você quer se conectar com essa pessoa? (ex: vender, parceria, networking, contratação...)'
        });
      }

      await queueAgentMessages([
        { text: confirmTarget, nextStep: null },
        { text: detailQuestion, nextStep: 3 }
      ]);

    // Step 3: First detail received - ask second detail
    } else if (step === 3) {
      // Save first detail per type
      if (targetType === 'company') {
        setFormData(prev => ({ ...prev, industry: input }));
      } else if (targetType === 'person') {
        setFormData(prev => ({ ...prev, currentCompany: input }));
      } else if (targetType === 'niche') {
        setFormData(prev => ({ ...prev, region: input }));
      } else {
        setFormData(prev => ({ ...prev, connectionReason: input }));
      }

      // Second detail question
      let detailQuestion2;
      if (targetType === 'company') {
        detailQuestion2 = t('conversation.askCompanySize', {
          defaultValue: 'Você sabe o porte da empresa? (pequena, média, grande, ou não sei)'
        });
      } else if (targetType === 'person') {
        detailQuestion2 = t('conversation.askPersonRole', {
          defaultValue: 'Qual é o cargo ou função dessa pessoa? (se souber)'
        });
      } else if (targetType === 'niche') {
        detailQuestion2 = t('conversation.askNicheTargetSize', {
          defaultValue: 'Qual o porte das empresas que você quer atingir nesse nicho? (startups, PMEs, grandes empresas, todas...)'
        });
      } else { // connection
        detailQuestion2 = t('conversation.askMutualContext', {
          defaultValue: 'Vocês têm algo em comum? (eventos, grupos, empresas anteriores, conhecidos...)'
        });
      }

      await queueAgentMessages([
        { text: t('conversation.detailReceived', { defaultValue: 'Anotado.' }), nextStep: null },
        { text: detailQuestion2, nextStep: 4 }
      ]);

    // Step 4: Second detail received - ask objective
    } else if (step === 4) {
      // Save second detail per type
      if (targetType === 'company') {
        setFormData(prev => ({ ...prev, companySize: input }));
      } else if (targetType === 'person') {
        setFormData(prev => ({ ...prev, currentRole: input }));
      } else if (targetType === 'niche') {
        setFormData(prev => ({ ...prev, targetSize: input }));
      } else {
        setFormData(prev => ({ ...prev, mutualContext: input }));
      }

      const askObjective = t('conversation.askObjective', {
        defaultValue: 'Qual é o seu objetivo principal com essa investigação? (ex: vender para eles, se conectar, entender o mercado...)'
      });

      await queueAgentMessages([
        { text: t('conversation.detailReceived', { defaultValue: 'Entendido.' }), nextStep: null },
        { text: askObjective, nextStep: 5 }
      ]);

    // Step 5: Objective received - ask additional info or LinkedIn
    } else if (step === 5) {
      setFormData(prev => ({ ...prev, objective: input }));

      const objectiveReceived = t('conversation.objectiveReceived', {
        defaultValue: 'Perfeito, agora tenho uma boa visão do que você precisa.'
      });

      // For company: ask CNPJ/domain
      if (targetType === 'company') {
        const askCnpj = t('conversation.askCnpj', {
          defaultValue: 'Se você tiver o CNPJ ou website da empresa, isso acelera a investigação. Caso contrário, podemos seguir.'
        });

        await queueAgentMessages([
          { text: objectiveReceived, nextStep: null },
          { text: askCnpj, nextStep: 6 }
        ]);
      }
      // For person/connection: ask LinkedIn URL
      else if (targetType === 'person' || targetType === 'connection') {
        const askLinkedIn = t('conversation.askLinkedInUrl', {
          defaultValue: 'Você tem o link do perfil LinkedIn dessa pessoa? (opcional, mas ajuda muito na investigação)'
        });

        await queueAgentMessages([
          { text: objectiveReceived, nextStep: null },
          { text: askLinkedIn, nextStep: 6 }
        ]);
      }
      // For niche: ask what you sell
      else if (targetType === 'niche') {
        const askProduct = t('conversation.askProductService', {
          defaultValue: 'O que você vende ou oferece para esse nicho? (produto, serviço, solução...)'
        });

        await queueAgentMessages([
          { text: objectiveReceived, nextStep: null },
          { text: askProduct, nextStep: 6 }
        ]);
      }

    // Step 6: Additional data received - check LinkedIn or go to confirm
    } else if (step === 6) {
      // Save additional data per type
      if (targetType === 'company') {
        if (input.includes('/') || /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(input.replace(/\D/g, ''))) {
          setFormData(prev => ({ ...prev, cnpj: input }));
        } else if (input.includes('.')) {
          setFormData(prev => ({ ...prev, domain: input }));
        }
      } else if (targetType === 'person' || targetType === 'connection') {
        if (input.includes('linkedin.com') || input.startsWith('http')) {
          setFormData(prev => ({ ...prev, linkedinUrl: input }));
        }
      } else if (targetType === 'niche') {
        setFormData(prev => ({ ...prev, productService: input }));
      }

      // Check if we have LinkedIn and should offer it
      if (hasLinkedIn && (targetType === 'company' || targetType === 'person' || targetType === 'connection')) {
        const askUseLinkedIn = t('conversation.askUseLinkedIn', {
          defaultValue: '🔗 Detectei que você tem uma conta LinkedIn conectada! Posso usar ela para buscar informações mais detalhadas como funcionários, conexões e perfis. Deseja ativar essa busca avançada?'
        });

        await queueAgentMessages([
          { text: t('conversation.detailReceived', { defaultValue: 'Anotado.' }), nextStep: null },
          { text: askUseLinkedIn, nextStep: 7 }
        ]);
      } else {
        // Go directly to confirm
        const readyToStart = t('conversation.readyToStart', {
          defaultValue: 'A equipe está pronta. Posso iniciar a investigação agora?'
        });

        await queueAgentMessages([
          { text: t('conversation.detailReceived', { defaultValue: 'Perfeito!' }), nextStep: null },
          { text: readyToStart, nextStep: 8 }
        ]);
      }

    // Step 7: LinkedIn choice received
    } else if (step === 7) {
      const useLinkedIn = input.toLowerCase().includes('sim') ||
                          input.toLowerCase().includes('yes') ||
                          input.toLowerCase().includes('ativar') ||
                          input.toLowerCase().includes('quero');

      setFormData(prev => ({ ...prev, useLinkedIn }));

      const linkedInResponse = useLinkedIn
        ? t('conversation.linkedInEnabled', { defaultValue: '✅ Busca LinkedIn ativada! Vamos encontrar muito mais informações.' })
        : t('conversation.linkedInDisabled', { defaultValue: 'Ok, vamos prosseguir sem a busca LinkedIn.' });

      const readyToStart = t('conversation.readyToStart', {
        defaultValue: 'A equipe está pronta. Posso iniciar a investigação agora?'
      });

      await queueAgentMessages([
        { text: linkedInResponse, nextStep: null },
        { text: readyToStart, nextStep: 8 }
      ]);
    }
  };

  // Skip optional step
  const handleSkip = async () => {
    setInputEnabled(false);
    const { targetType } = formData;

    // Skip detail questions (steps 3-4) - go to objective
    if (step === 3 || step === 4) {
      setMessages(prev => [...prev, { text: 'Pular', isAgent: false, id: Date.now() }]);

      const skipMessage = t('conversation.skipDetail', {
        defaultValue: 'Sem problema, vamos continuar.'
      });

      // Skip directly to objective question
      const askObjective = t('conversation.askObjective', {
        defaultValue: 'Qual é o seu objetivo principal com essa investigação?'
      });

      await queueAgentMessages([
        { text: skipMessage, nextStep: null },
        { text: askObjective, nextStep: 5 }
      ]);

    // Skip objective (step 5)
    } else if (step === 5) {
      setMessages(prev => [...prev, { text: 'Pular', isAgent: false, id: Date.now() }]);

      const noObjective = t('conversation.noObjective', {
        defaultValue: 'Sem problema, vamos fazer uma investigação completa.'
      });

      // Check if we should ask for additional data
      if (targetType === 'company') {
        const askCnpj = t('conversation.askCnpj', {
          defaultValue: 'Se você tiver o CNPJ ou website da empresa, isso acelera a investigação.'
        });
        await queueAgentMessages([
          { text: noObjective, nextStep: null },
          { text: askCnpj, nextStep: 6 }
        ]);
      } else if (targetType === 'person' || targetType === 'connection') {
        const askLinkedIn = t('conversation.askLinkedInUrl', {
          defaultValue: 'Você tem o link do perfil LinkedIn dessa pessoa?'
        });
        await queueAgentMessages([
          { text: noObjective, nextStep: null },
          { text: askLinkedIn, nextStep: 6 }
        ]);
      } else {
        // Niche or unknown - go to confirm
        const readyToStart = t('conversation.readyToStart', {
          defaultValue: 'A equipe está pronta. Posso iniciar a investigação agora?'
        });
        await queueAgentMessages([
          { text: noObjective, nextStep: null },
          { text: readyToStart, nextStep: 8 }
        ]);
      }

    // Skip additional data (step 6)
    } else if (step === 6) {
      setMessages(prev => [...prev, { text: 'Continuar sem', isAgent: false, id: Date.now() }]);

      // Check if we should offer LinkedIn
      if (hasLinkedIn && (targetType === 'company' || targetType === 'person' || targetType === 'connection')) {
        const askUseLinkedIn = t('conversation.askUseLinkedIn', {
          defaultValue: '🔗 Detectei que você tem uma conta LinkedIn conectada! Deseja ativar a busca avançada?'
        });
        await queueAgentMessages([
          { text: askUseLinkedIn, nextStep: 7 }
        ]);
      } else {
        const readyToStart = t('conversation.readyToStart', {
          defaultValue: 'A equipe está pronta. Posso iniciar a investigação agora?'
        });
        await queueAgentMessages([
          { text: readyToStart, nextStep: 8 }
        ]);
      }

    // Skip LinkedIn question (step 7)
    } else if (step === 7) {
      setMessages(prev => [...prev, { text: 'Não usar LinkedIn', isAgent: false, id: Date.now() }]);

      const readyToStart = t('conversation.readyToStart', {
        defaultValue: 'A equipe está pronta. Posso iniciar a investigação agora?'
      });
      await queueAgentMessages([
        { text: readyToStart, nextStep: 8 }
      ]);
    }
  };

  // Start investigation
  const handleStartInvestigation = async () => {
    setMessages(prev => [...prev, { text: '🚀 Iniciar investigação!', isAgent: false, id: Date.now() }]);
    setInputEnabled(false);

    const starting = t('conversation.starting', {
      defaultValue: '🔴 Investigação iniciada! Mobilizando a equipe de campo...\n\nVocê pode acompanhar o progresso em tempo real na tela principal.'
    });

    await queueAgentMessages([
      { text: starting, nextStep: null }
    ]);

    setLoading(true);

    try {
      // Build comprehensive target details based on type
      const targetDetails = {
        // Common fields
        cnpj: formData.cnpj || null,
        domain: formData.domain || null,
        socialUrls: formData.linkedinUrl ? [formData.linkedinUrl] : [],
        linkedinUrl: formData.linkedinUrl || null,

        // Use LinkedIn API if enabled and available
        useLinkedIn: formData.useLinkedIn && hasLinkedIn,
        linkedInAccountId: formData.useLinkedIn && linkedInAccounts.length > 0
          ? linkedInAccounts[0].id
          : null,

        // Company-specific details
        industry: formData.industry || null,
        companySize: formData.companySize || null,
        departments: formData.departments || null,
        relationship: formData.relationship || null,

        // Person-specific details
        currentCompany: formData.currentCompany || null,
        currentRole: formData.currentRole || null,

        // Connection-specific details
        connectionReason: formData.connectionReason || null,
        mutualContext: formData.mutualContext || null,

        // Niche-specific details
        region: formData.region || null,
        targetSize: formData.targetSize || null,
        productService: formData.productService || null,

        // Known contacts
        knownContacts: formData.knownContacts || null
      };

      await onStart({
        targetName: formData.targetName,
        targetType: formData.targetType,
        objective: formData.objective || null,
        targetDetails
      });
    } catch (err) {
      setLoading(false);
      const errorMsg = t('conversation.error', {
        defaultValue: '⚠️ Erro ao iniciar investigação. Tente novamente.'
      });
      await queueAgentMessages([
        { text: errorMsg, nextStep: 8 }
      ]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with scan lines effect */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
        }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-[#0c0c14] border border-purple-900/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header with agent info */}
        <div className="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-gray-900 to-[#0c0c14] border-b border-purple-900/30">
          <div className="relative">
            <img
              src={AGENT_AVATAR}
              alt={AGENT_NAME}
              className="w-14 h-14 rounded-full border-2 border-purple-500 object-cover"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#0c0c14] animate-pulse" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-purple-400">{AGENT_NAME}</h2>
            <p className="text-xs text-gray-400">{AGENT_ROLE} • Central de Inteligência</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
          {messages.map((msg, i) => {
            // Skip messages waiting for their turn (not yet started typing and not completed)
            if (msg.useTypewriter && !msg.typingComplete && currentTypingIndex < i) {
              return null;
            }

            // Show typewriter only if: has useTypewriter flag, is currently typing, and not completed
            const shouldShowTypewriter = msg.useTypewriter &&
                                         currentTypingIndex === i &&
                                         !msg.typingComplete;

            return (
              <ChatMessage
                key={msg.id || i}
                message={msg.text}
                isAgent={msg.isAgent}
                avatar={AGENT_AVATAR}
                useTypewriter={shouldShowTypewriter}
                messageIndex={i}
                onTypewriterComplete={handleTypewriterComplete}
              />
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick replies / Input area */}
        <div className="border-t border-gray-800 p-4 bg-gray-900/50">
          {/* Step 1: Type selection */}
          {step === 1 && inputEnabled && (
            <div className="flex flex-wrap gap-2 justify-center animate-fade-in">
              {INVESTIGATION_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <QuickReply
                    key={type.id}
                    icon={Icon}
                    onClick={() => handleTypeSelect(type.id)}
                    color={type.color}
                  >
                    {t(`types.${type.id}`)}
                  </QuickReply>
                );
              })}
            </div>
          )}

          {/* Steps 2-7: Text input with varying placeholders */}
          {(step >= 2 && step <= 7) && inputEnabled && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    step === 2 ? t('conversation.typeName', { defaultValue: 'Digite o nome...' }) :
                    step === 3 ? t('conversation.typeDetail', { defaultValue: 'Digite sua resposta...' }) :
                    step === 4 ? t('conversation.typeDetail', { defaultValue: 'Digite sua resposta...' }) :
                    step === 5 ? t('conversation.typeObjective', { defaultValue: 'Ex: Quero vender para eles...' }) :
                    step === 6 ? t('conversation.typeAdditional', { defaultValue: 'URL, CNPJ ou website (opcional)' }) :
                    t('conversation.typeYesNo', { defaultValue: 'Sim ou Não...' })
                  }
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-200 placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!userInput.trim()}
                  className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Show skip button for optional steps (3-7) */}
              {step >= 3 && step <= 7 && (
                <button
                  onClick={handleSkip}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-400 py-2"
                >
                  {t('conversation.skip', { defaultValue: 'Pular esta etapa' })}
                </button>
              )}
            </div>
          )}

          {/* Step 8: Confirm start */}
          {step === 8 && inputEnabled && !loading && (
            <div className="flex gap-3 animate-fade-in">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors text-sm font-medium"
              >
                {t('modal.cancel', { defaultValue: 'Cancelar' })}
              </button>
              <button
                onClick={handleStartInvestigation}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-500 hover:to-red-500 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm hover:scale-105 active:scale-95"
              >
                <span>{t('conversation.startButton', { defaultValue: 'Iniciar Investigação' })}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Loading/Typing state */}
          {(!inputEnabled || loading) && step > 0 && (
            <div className="flex items-center justify-center gap-3 py-3 text-gray-500">
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                  <span className="text-sm text-purple-400">{t('conversation.mobilizing', { defaultValue: 'Mobilizando equipe...' })}</span>
                </>
              ) : (
                <span className="text-xs">Aguarde...</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSS for fade-in animation */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default StartInvestigationModal;
