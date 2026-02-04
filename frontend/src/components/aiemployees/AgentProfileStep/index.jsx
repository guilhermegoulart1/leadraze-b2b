// frontend/src/components/aiemployees/AgentProfileStep/index.jsx
// Container principal com header estilo Artisan + tabs

import React, { useState, useRef } from 'react';
import { Bot, User, BookOpen, Settings, ArrowLeft, ArrowRight, RefreshCw, Upload, Camera, Shield, Loader2, ChevronDown, Target, Headphones, MessageSquare, Linkedin, Mail, Globe, ArrowRightLeft } from 'lucide-react';
import IdentityTab from './IdentityTab';
import KnowledgeTab from './KnowledgeTab';
import RulesTab from './RulesTab';
import TransferTab from './TransferTab';
import ConfigTab from './ConfigTab';

// Unsplash professional portrait photo IDs
const UNSPLASH_PHOTO_IDS = [
  '1507003211169-0a1dd7228f2d',
  '1472099645785-5658abf4ff4e',
  '1519085360753-af0119f7cbe7',
  '1500648767791-00dcc994a43e',
  '1506794778202-cad84cf45f1d',
  '1560250097-0b93528c311a',
  '1552058544-f2738db43c87',
  '1531123897727-8f129e1688ce',
  '1539571696357-5a69c17a67c6',
  '1564564321837-a57b7070ac4f',
  '1573496359142-b8d87734a5a2',
  '1580489944761-15a19d654956',
  '1494790108377-be9c29b29330',
  '1438761681033-6461ffad8d80',
  '1534528741775-53994a69daeb',
  '1573497019940-1c28c88b4f3e',
  '1544005313-94ddf0286df2',
  '1500917293891-ef795e70e1f6',
  '1589571894960-20bbe2828d0a',
  '1594824476967-48c8b964273f'
];

const getRandomUnsplashUrl = (currentUrl = null) => {
  let availableIds = UNSPLASH_PHOTO_IDS;
  if (currentUrl && currentUrl.includes('unsplash.com')) {
    availableIds = UNSPLASH_PHOTO_IDS.filter(id => !currentUrl.includes(id));
  }
  if (availableIds.length === 0) {
    availableIds = UNSPLASH_PHOTO_IDS;
  }
  const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
  return `https://images.unsplash.com/photo-${randomId}?w=200&h=200&fit=crop&crop=face`;
};

const initialProfile = {
  // IDENTIDADE (Prompt - sempre carregado, ~200-400 tokens)
  name: '',
  avatarUrl: '',
  tone: 'consultivo',
  objective: 'qualify',
  customObjective: '',
  personality: [],
  rules: [],

  // BASE DE CONHECIMENTO (RAG - carrega sob demanda)
  company: {
    website: '',
    description: '',
    sector: '',
    avgTicket: '',
    icp: ''
  },
  product: {
    name: '',
    description: '',
    benefits: [],
    differentials: []
  },
  faq: [],
  objections: [],

  // CONFIG
  formality: 50,
  assertiveness: 50,
  responseLength: 'medium',
  language: 'pt-BR',

  // LATENCIA DE RESPOSTA
  latency: {
    min: 30,
    minUnit: 'seconds',
    max: 2,
    maxUnit: 'minutes'
  },

  // HORARIO DE FUNCIONAMENTO
  workingHours: {
    enabled: false,
    timezone: 'America/Sao_Paulo',
    startTime: '09:00',
    endTime: '18:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    outsideBehavior: 'queue',
    awayMessage: ''
  }
};

const tabs = [
  { id: 'identity', label: 'Perfil', icon: User },
  { id: 'knowledge', label: 'Base Conhecimento', icon: BookOpen },
  { id: 'rules', label: 'Regras', icon: Shield },
  { id: 'transfer', label: 'Transferencia', icon: ArrowRightLeft },
  { id: 'config', label: 'Config', icon: Settings }
];

const channelLabels = {
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  email: 'Email',
  webchat: 'WebChat'
};

const typeLabels = {
  prospeccao: 'Prospeccao B2B',
  atendimento: 'Atendimento'
};

const AgentProfileStep = ({ agentType, channel, onComplete, onSave, onBack, initialData = null, isEditing = false, agentId = null, onTypeChange, onChannelChange }) => {
  const [activeTab, setActiveTab] = useState('identity');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedRef = React.useRef(false);
  const [profile, setProfile] = useState(() => {
    const base = initialData || initialProfile;
    // Se nao tem avatar E nao estamos editando, gera um aleatorio
    // Se estamos editando, mantem o avatar que veio (mesmo se undefined)
    if (!base.avatarUrl && !isEditing) {
      return { ...base, avatarUrl: getRandomUnsplashUrl() };
    }
    return base;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef(null);

  // Update profile when initialData changes (for editing) - only once
  React.useEffect(() => {
    if (initialData && isEditing && !initializedRef.current) {
      initializedRef.current = true;
      setProfile(prev => ({
        ...initialProfile, // Reset to defaults first
        ...initialData,    // Then apply initial data
        avatarUrl: initialData.avatarUrl || getRandomUnsplashUrl() // Only generate if really missing
      }));
    }
  }, [initialData, isEditing]);

  const updateProfile = (key, value) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const handleRefreshAvatar = () => {
    setIsRefreshing(true);
    const newUrl = getRandomUnsplashUrl(profile.avatarUrl);
    updateProfile('avatarUrl', newUrl);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      updateProfile('avatarUrl', event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const updateNestedProfile = (section, key, value) => {
    setProfile(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const handleContinue = async () => {
    if (isEditing && onSave) {
      // When editing, just save without going to workflow
      setSaving(true);
      try {
        await onSave(profile);
      } finally {
        setSaving(false);
      }
    } else {
      // When creating, continue to workflow
      onComplete(profile);
    }
  };

  const isValidProfile = () => {
    // Minimo: nome do agente preenchido
    return profile.name && profile.name.trim().length > 0;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 overflow-hidden max-w-5xl mx-auto shadow-sm">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Header estilo Artisan */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-4">
          {/* Avatar com hover actions */}
          <div className="relative group">
            <div className="w-16 h-16 rounded-full overflow-hidden shadow-lg shadow-purple-500/25 ring-2 ring-purple-500/20">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-white" />
                </div>
              )}
            </div>

            {/* Hover overlay com botoes */}
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={handleRefreshAvatar}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                title="Nova foto aleatoria"
              >
                <RefreshCw className={`w-4 h-4 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                title="Enviar foto"
              >
                <Upload className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {profile.name || (isEditing ? 'Editando AI Employee' : 'Novo AI Employee')}
              </h2>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                {isEditing ? 'Editando' : 'Configurando'}
              </span>
            </div>
            {isEditing && onTypeChange && onChannelChange ? (
              <div className="flex items-center gap-2 mt-1">
                {/* Type Selector */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowTypeDropdown(!showTypeDropdown);
                      setShowChannelDropdown(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {agentType === 'prospeccao' ? (
                      <Target className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Headphones className="w-3.5 h-3.5 text-green-500" />
                    )}
                    <span className="text-gray-700 dark:text-gray-300">{typeLabels[agentType]}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  {showTypeDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                      <button
                        onClick={() => {
                          onTypeChange('prospeccao');
                          setShowTypeDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${agentType === 'prospeccao' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <Target className="w-4 h-4 text-blue-500" />
                        <span className="text-gray-700 dark:text-gray-300">Prospeccao B2B</span>
                      </button>
                      <button
                        onClick={() => {
                          onTypeChange('atendimento');
                          setShowTypeDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${agentType === 'atendimento' ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        <Headphones className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700 dark:text-gray-300">Atendimento</span>
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-gray-400">•</span>

                {/* Channel Selector */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowChannelDropdown(!showChannelDropdown);
                      setShowTypeDropdown(false);
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-sm rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {channel === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5 text-green-500" />}
                    {channel === 'linkedin' && <Linkedin className="w-3.5 h-3.5 text-blue-500" />}
                    {channel === 'email' && <Mail className="w-3.5 h-3.5 text-purple-500" />}
                    {channel === 'webchat' && <Globe className="w-3.5 h-3.5 text-cyan-500" />}
                    <span className="text-gray-700 dark:text-gray-300">{channelLabels[channel]}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  {showChannelDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                      <button
                        onClick={() => {
                          onChannelChange('whatsapp');
                          setShowChannelDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${channel === 'whatsapp' ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        <MessageSquare className="w-4 h-4 text-green-500" />
                        <span className="text-gray-700 dark:text-gray-300">WhatsApp</span>
                      </button>
                      <button
                        onClick={() => {
                          onChannelChange('linkedin');
                          setShowChannelDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${channel === 'linkedin' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <Linkedin className="w-4 h-4 text-blue-500" />
                        <span className="text-gray-700 dark:text-gray-300">LinkedIn</span>
                      </button>
                      <button
                        onClick={() => {
                          onChannelChange('email');
                          setShowChannelDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${channel === 'email' ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                      >
                        <Mail className="w-4 h-4 text-purple-500" />
                        <span className="text-gray-700 dark:text-gray-300">Email</span>
                      </button>
                      <button
                        onClick={() => {
                          onChannelChange('webchat');
                          setShowChannelDropdown(false);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${channel === 'webchat' ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}`}
                      >
                        <Globe className="w-4 h-4 text-cyan-500" />
                        <span className="text-gray-700 dark:text-gray-300">WebChat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {agentType === 'prospeccao' ? 'SDR' : 'Atendente'} {channelLabels[channel]} • {typeLabels[agentType]}
              </p>
            )}
          </div>

          {/* Progress indicator - hide when editing */}
          {!isEditing && (
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center font-semibold">
                4
              </span>
              <span>de 6</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-all
                ${isActive
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'identity' && (
          <IdentityTab
            profile={profile}
            onChange={updateProfile}
          />
        )}
        {activeTab === 'knowledge' && (
          <KnowledgeTab
            profile={profile}
            onChange={updateProfile}
            onNestedChange={updateNestedProfile}
            agentId={agentId || initialData?.id}
          />
        )}
        {activeTab === 'rules' && (
          <RulesTab
            profile={profile}
            onChange={updateProfile}
          />
        )}
        {activeTab === 'transfer' && (
          <TransferTab
            agentId={agentId || initialData?.id}
            profile={profile}
            onProfileChange={updateProfile}
          />
        )}
        {activeTab === 'config' && (
          <ConfigTab
            profile={profile}
            onChange={updateProfile}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="flex items-center gap-3">
          {/* Tab navigation hints */}
          <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400">
            {tabs.map((tab, index) => (
              <span
                key={tab.id}
                className={`w-2 h-2 rounded-full transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleContinue}
            disabled={!isValidProfile() || saving}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors
              ${isValidProfile() && !saving
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }
            `}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                {isEditing ? 'Salvar Alterações' : 'Continuar para Workflow'}
                {!isEditing && <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentProfileStep;
