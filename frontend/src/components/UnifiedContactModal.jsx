import React, { useState, useEffect, useRef } from 'react';
import {
  X, Mail, Phone, Building2, MapPin, Linkedin, Globe, Briefcase,
  MessageCircle, Instagram, Send, Clock, MessageSquare,
  ChevronRight, Trash2, Plus, Save, User, Users, RefreshCw, Sparkles, Image, FileText, ExternalLink
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import ContactAvatar from './ContactAvatar';
import LocationMiniMap from './LocationMiniMap';
import OfficialDataTab from './OfficialDataTab';
import ProfileEnrichmentSection, { ProfileBadges } from './ProfileEnrichmentSection';
import CompanyDataTab from './CompanyDataTab';

const UnifiedContactModal = ({ isOpen, onClose, contactId, onOpenConversation }) => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [availableTags, setAvailableTags] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const noteInputRef = useRef(null);
  const [linkedinAccounts, setLinkedinAccounts] = useState([]);
  const [selectedLinkedinAccountId, setSelectedLinkedinAccountId] = useState(null);

  // Form state for inline editing
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    location: '',
    profile_url: '',
    website: '',
    tags: []
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen && contactId) {
      loadContactFull();
      loadTags();
      loadLinkedinAccounts();
    }
  }, [isOpen, contactId]);

  // Load LinkedIn accounts for company tab
  const loadLinkedinAccounts = async () => {
    try {
      const response = await api.getLinkedInAccounts();
      if (response.success && response.data?.length > 0) {
        setLinkedinAccounts(response.data);
        // Auto-select the first active account
        const activeAccount = response.data.find(a => a.status === 'active');
        if (activeAccount) {
          setSelectedLinkedinAccountId(activeAccount.id);
        }
      }
    } catch (error) {
      console.error('Error loading LinkedIn accounts:', error);
    }
  };

  useEffect(() => {
    if (data?.contact) {
      const contact = data.contact;
      setFormData({
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        title: contact.title || '',
        location: contact.location || '',
        profile_url: contact.profile_url || '',
        website: contact.website || '',
        tags: contact.tags?.map(t => t.id) || []
      });
      setHasChanges(false);
    }
  }, [data?.contact]);

  const loadContactFull = async () => {
    try {
      setLoading(true);
      const response = await api.getContactFull(contactId);
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error loading contact:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await api.getTags();
      if (response.success) {
        setAvailableTags(response.data.tags || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.updateContact(contactId, formData);
      if (response.success) {
        await loadContactFull();
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    try {
      setAddingNote(true);
      const response = await api.addContactNote(contactId, newNote.trim());
      if (response.success) {
        setData(prev => ({
          ...prev,
          notes: [response.data.note, ...(prev.notes || [])]
        }));
        setNewNote('');
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      const response = await api.deleteContactNote(contactId, noteId);
      if (response.success) {
        setData(prev => ({
          ...prev,
          notes: prev.notes.filter(n => n.id !== noteId)
        }));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddNote();
    }
  };

  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      const response = await api.post(`/contacts/${contactId}/refresh-data`, {
        updateName: true,
        updatePicture: true
      });
      if (response.data?.success) {
        // Reload contact data to show updated info
        await loadContactFull();
        // Show success feedback (optional - could add toast here)
        console.log('✅ Dados atualizados:', response.data.message);
      }
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
      // Show error feedback (optional - could add toast here)
      alert(error.response?.data?.message || 'Erro ao atualizar dados do contato');
    } finally {
      setRefreshing(false);
    }
  };

  if (!isOpen) return null;

  const channelConfig = {
    whatsapp: { icon: MessageCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: 'WhatsApp' },
    instagram: { icon: Instagram, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/30', label: 'Instagram' },
    email: { icon: Mail, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Email' },
    linkedin: { icon: Linkedin, color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'LinkedIn' },
    telegram: { icon: Send, color: 'text-blue-500 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Telegram' },
    phone: { icon: Phone, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Telefone' }
  };

  const tagColors = {
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700'
  };

  const contact = data?.contact;
  const channels = data?.channels || [];
  const conversations = data?.conversations || [];
  const leads = data?.leads || [];
  const notes = data?.notes || [];

  const activeChannelTypes = [...new Set(channels.filter(c => c.isActive).map(c => c.type))];

  const formatTimeAgo = (date) => {
    if (!date) return '-';
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
  };

  const formatNoteDate = (date) => {
    if (!date) return '';
    return format(new Date(date), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR });
  };

  // Parse JSON arrays safely (for AI analysis data)
  const parseJsonArray = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        // If not valid JSON, try splitting by comma
        if (value.includes(',')) {
          return value.split(',').map(s => s.trim()).filter(Boolean);
        }
        return value ? [value] : [];
      }
    }
    return [];
  };

  // Check if contact has AI analysis data
  const hasAIAnalysis = contact && (
    contact.company_description ||
    parseJsonArray(contact.company_services).length > 0 ||
    parseJsonArray(contact.pain_points).length > 0
  );

  const handleOpenConversation = (conversationId) => {
    if (onOpenConversation) {
      onOpenConversation(conversationId);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="flex items-center justify-center min-h-screen">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400"></div>
            </div>
          ) : contact ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
                <div className="flex items-center gap-4">
                  <ContactAvatar
                    photoUrl={contact.profile_picture}
                    name={formData.name}
                    size="lg"
                  />
                  <div>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-purple-500 dark:focus:border-purple-400 focus:outline-none px-1 -ml-1"
                        placeholder="Nome do contato"
                      />
                      {/* Open to Work / Hiring Badges */}
                      <ProfileBadges profile={contact} />
                    </div>
                    {/* Channel Badges */}
                    <div className="flex gap-2 mt-2">
                      {activeChannelTypes.map(type => {
                        const config = channelConfig[type];
                        if (!config) return null;
                        const IconComponent = config.icon;
                        return (
                          <div
                            key={type}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}
                            title={config.label}
                          >
                            <IconComponent className="w-3 h-3" />
                            <span className="text-xs font-medium">{config.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Botão Atualizar Dados */}
                  <button
                    onClick={handleRefreshData}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                    title="Atualizar dados e foto do contato via WhatsApp/Instagram"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Atualizando...' : 'Atualizar'}
                  </button>
                  {hasChanges && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content - Two columns */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left column - Contact details */}
                <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200 dark:border-gray-700">
                  {/* Tabs */}
                  <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'overview'
                          ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      Dados
                    </button>
                    <button
                      onClick={() => setActiveTab('conversations')}
                      className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'conversations'
                          ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      Conversas ({conversations.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('opportunities')}
                      className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'opportunities'
                          ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      Oportunidades ({leads.length})
                    </button>
                    {hasAIAnalysis && (
                      <button
                        onClick={() => setActiveTab('intelligence')}
                        className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                          activeTab === 'intelligence'
                            ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Inteligencia IA
                      </button>
                    )}
                    {/* Photos Tab - only show if photos exist */}
                    {contact && parseJsonArray(contact.photos).length > 0 && (
                      <button
                        onClick={() => setActiveTab('photos')}
                        className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                          activeTab === 'photos'
                            ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <Image className="w-3.5 h-3.5" />
                        Fotos ({parseJsonArray(contact.photos).length})
                      </button>
                    )}
                    {/* Official Data Tab - only show if cnpj_data exists */}
                    {contact && contact.cnpj_data && (
                      <button
                        onClick={() => setActiveTab('officialData')}
                        className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                          activeTab === 'officialData'
                            ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {t('contacts.officialData.title')}
                      </button>
                    )}
                    {/* Company Tab - show if contact has company */}
                    {contact && contact.company && (
                      <button
                        onClick={() => setActiveTab('company')}
                        className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                          activeTab === 'company'
                            ? 'border-purple-600 dark:border-purple-400 text-purple-600 dark:text-purple-400'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Empresa
                      </button>
                    )}
                  </div>

                  {/* Overview Tab - Editable fields */}
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Email & Phone */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            <Mail className="w-3.5 h-3.5" /> Email
                          </label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            <Phone className="w-3.5 h-3.5" /> Telefone
                          </label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="+55 11 99999-9999"
                          />
                        </div>
                      </div>

                      {/* Multiple Contacts Data - Additional emails, phones, social links */}
                      {(parseJsonArray(contact?.emails).length > 0 || parseJsonArray(contact?.phones).length > 0 || (contact?.social_links && Object.keys(contact.social_links).length > 0)) && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3">
                            <Users className="w-4 h-4" />
                            Canais de Contato Adicionais
                          </h4>

                          {/* Multiple Emails */}
                          {parseJsonArray(contact?.emails).length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                Emails ({parseJsonArray(contact?.emails).length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {parseJsonArray(contact?.emails).map((item, idx) => (
                                  <a
                                    key={idx}
                                    href={`mailto:${item.email}`}
                                    className="text-xs bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1"
                                  >
                                    {item.email}
                                    {item.type && (
                                      <span className={`text-[9px] px-1 py-0.5 rounded ${
                                        item.type === 'personal' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                                        item.type === 'commercial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                      }`}>
                                        {item.type}
                                      </span>
                                    )}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Multiple Phones */}
                          {parseJsonArray(contact?.phones).length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                Telefones ({parseJsonArray(contact?.phones).length})
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {parseJsonArray(contact?.phones).map((item, idx) => (
                                  <a
                                    key={idx}
                                    href={`tel:${item.phone}`}
                                    className="text-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-700 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                                  >
                                    {item.phone}
                                    {item.type && (
                                      <span className={`text-[9px] px-1 py-0.5 rounded ${
                                        item.type === 'whatsapp' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400' :
                                        item.type === 'mobile' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400' :
                                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                      }`}>
                                        {item.type === 'whatsapp' ? 'WhatsApp' : item.type === 'mobile' ? 'Celular' : 'Fixo'}
                                      </span>
                                    )}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Social Links */}
                          {contact?.social_links && Object.keys(contact.social_links).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                Redes Sociais
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(contact.social_links).map(([network, url]) => (
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

                      {/* Company & Title */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            <Building2 className="w-3.5 h-3.5" /> Empresa
                          </label>
                          <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => handleInputChange('company', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Nome da empresa"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Cargo</label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Ex: Diretor Comercial"
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          <MapPin className="w-3.5 h-3.5" /> Localizacao
                        </label>
                        <input
                          type="text"
                          value={formData.location}
                          onChange={(e) => handleInputChange('location', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Cidade, Estado"
                        />
                        {/* Mini Map */}
                        <LocationMiniMap
                          latitude={contact?.latitude}
                          longitude={contact?.longitude}
                          height={120}
                          className="mt-2"
                        />
                      </div>

                      {/* LinkedIn */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          <Linkedin className="w-3.5 h-3.5" /> Perfil LinkedIn
                        </label>
                        <input
                          type="url"
                          value={formData.profile_url}
                          onChange={(e) => handleInputChange('profile_url', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>

                      {/* Website */}
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          <Globe className="w-3.5 h-3.5" /> Website
                        </label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => handleInputChange('website', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="https://exemplo.com"
                        />
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Etiquetas</label>
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map(tag => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                formData.tags.includes(tag.id)
                                  ? tagColors[tag.color] || tagColors.blue
                                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              {tag.name}
                            </button>
                          ))}
                          {availableTags.length === 0 && (
                            <span className="text-sm text-gray-400 dark:text-gray-500">Nenhuma etiqueta disponivel</span>
                          )}
                        </div>
                      </div>

                      {/* Channels */}
                      {channels.length > 0 && (
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Canais Conectados</label>
                          <div className="space-y-2">
                            {channels.map((channel, idx) => {
                              const config = channelConfig[channel.type];
                              if (!config) return null;
                              const IconComponent = config.icon;
                              return (
                                <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                  <div className={`p-1.5 rounded-full ${config.bg}`}>
                                    <IconComponent className={`w-3.5 h-3.5 ${config.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{config.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {channel.username || channel.channelId || '-'}
                                    </p>
                                  </div>
                                  {channel.isActive && (
                                    <span className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Enrichment Data (Skills, Certifications, Languages, etc.) */}
                      <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                        <ProfileEnrichmentSection profile={contact} />
                      </div>
                    </div>
                  )}

                  {/* Conversations Tab */}
                  {activeTab === 'conversations' && (
                    <div>
                      {conversations.length > 0 ? (
                        <div className="space-y-2">
                          {conversations.map(conv => {
                            const config = channelConfig[conv.channel] || channelConfig.email;
                            const IconComponent = config.icon;
                            return (
                              <div
                                key={conv.id}
                                onClick={() => handleOpenConversation(conv.id)}
                                className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                              >
                                <div className={`p-2 rounded-full ${config.bg}`}>
                                  <IconComponent className={`w-4 h-4 ${config.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                                      {conv.lead_name || 'Conversa'}
                                    </h4>
                                    {conv.unread_count > 0 && (
                                      <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                                        {conv.unread_count}
                                      </span>
                                    )}
                                  </div>
                                  {conv.last_message_preview && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                      {conv.last_message_preview}
                                    </p>
                                  )}
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                    {formatTimeAgo(conv.last_message_at)}
                                  </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma conversa</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opportunities Tab */}
                  {activeTab === 'opportunities' && (
                    <div>
                      {leads.length > 0 ? (
                        <div className="space-y-2">
                          {leads.map(lead => (
                            <div key={lead.id} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{lead.name}</h4>
                                {lead.is_primary_contact && (
                                  <span className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                                    Principal
                                  </span>
                                )}
                              </div>
                              {lead.campaign_name && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Campanha: {lead.campaign_name}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                Atualizado {formatTimeAgo(lead.updated_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma oportunidade</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Intelligence Tab */}
                  {activeTab === 'intelligence' && (
                    <div className="space-y-6">
                      {/* Header with gradient */}
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-5 h-5" />
                          <h3 className="font-semibold">Analise Inteligente</h3>
                        </div>
                        <p className="text-sm text-purple-100">
                          Dados coletados e analisados automaticamente pela IA
                        </p>
                      </div>

                      {/* Company Description */}
                      {contact.company_description && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            Sobre a Empresa
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {contact.company_description}
                          </p>
                        </div>
                      )}

                      {/* Services */}
                      {parseJsonArray(contact.company_services).length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            Servicos Oferecidos
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {parseJsonArray(contact.company_services).map((service, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-lg border border-blue-200 dark:border-blue-700"
                              >
                                {service}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pain Points */}
                      {parseJsonArray(contact.pain_points).length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                            <span className="text-amber-500">💡</span>
                            Oportunidades de Venda
                          </h4>
                          <ul className="space-y-2">
                            {parseJsonArray(contact.pain_points).map((pain, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>{pain}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Website Link */}
                      {contact.website && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                          <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                            <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
                            Website Analisado
                          </h4>
                          <a
                            href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                          >
                            {contact.website}
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Photos Tab */}
                  {activeTab === 'photos' && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-4 text-white">
                        <div className="flex items-center gap-2 mb-2">
                          <Image className="w-5 h-5" />
                          <h3 className="font-semibold">Fotos do Google Maps</h3>
                        </div>
                        <p className="text-sm text-purple-100">
                          Imagens coletadas automaticamente do Google Maps
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {parseJsonArray(contact.photos).map((photo, idx) => (
                          <a
                            key={idx}
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative group aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
                          >
                            <img
                              src={photo}
                              alt={`${contact?.name || 'Contato'} - Foto ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                            <div className="hidden items-center justify-center w-full h-full text-gray-400 dark:text-gray-500">
                              <Image className="w-8 h-8" />
                            </div>
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                Ver imagem
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Official Data Tab */}
                  {activeTab === 'officialData' && contact?.cnpj_data && (
                    <OfficialDataTab
                      cnpj={contact.cnpj}
                      cnpjData={contact.cnpj_data}
                    />
                  )}

                  {/* Company Tab */}
                  {activeTab === 'company' && contact?.company && (
                    <div className="space-y-4">
                      {/* LinkedIn Account Selector (if multiple accounts) */}
                      {linkedinAccounts.length > 1 && (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                          <Linkedin className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">Conta:</span>
                          <select
                            value={selectedLinkedinAccountId || ''}
                            onChange={(e) => setSelectedLinkedinAccountId(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            {linkedinAccounts.map(account => (
                              <option key={account.id} value={account.id}>
                                {account.profile_name || account.linkedin_username}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <CompanyDataTab
                        companyIdentifier={contact.company}
                        linkedinAccountId={selectedLinkedinAccountId}
                        cnpjData={contact.cnpj_data || null}
                      />
                    </div>
                  )}
                </div>

                {/* Right column - Notes timeline */}
                <div className="w-80 flex flex-col bg-gray-50 dark:bg-gray-900">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Observacoes</h3>
                  </div>

                  {/* Notes list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {notes.length > 0 ? (
                      notes.map(note => (
                        <div key={note.id} className="bg-white dark:bg-gray-800 rounded-lg p-2.5 shadow-sm border border-gray-100 dark:border-gray-700 group">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                              <User className="w-2.5 h-2.5" />
                              <span className="font-medium">{note.user_name || 'Usuario'}</span>
                              <span className="text-gray-400 dark:text-gray-500">•</span>
                              <span>{formatNoteDate(note.created_at)}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Nenhuma observacao</p>
                      </div>
                    )}
                  </div>

                  {/* Add note input */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <div className="flex gap-2">
                      <textarea
                        ref={noteInputRef}
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Adicionar observacao..."
                        rows={2}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={addingNote || !newNote.trim()}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {addingNote ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Enter para enviar</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96">
              <p className="text-gray-500 dark:text-gray-400">Contato nao encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedContactModal;
