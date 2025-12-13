import React, { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Building2, Linkedin, User, Target,
  Search, Check, UserPlus, Link2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const LeadFormModal = ({ isOpen, onClose, onSave, lead = null }) => {
  const { t } = useTranslation('leads');
  const isEditing = !!lead;

  // States
  const [step, setStep] = useState(1); // 1: select/create contact, 2: lead details
  const [contactMode, setContactMode] = useState('existing'); // 'existing' or 'new'
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // New contact form data
  const [contactData, setContactData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    title: '',
    location: '',
    profile_url: '',
  });

  // Lead form data
  const [leadData, setLeadData] = useState({
    name: '',
    company: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    profile_url: '',
    source: 'manual',
    status: 'leads',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Load contacts on search (minimum 3 characters)
  useEffect(() => {
    if (isOpen && contactMode === 'existing' && searchQuery.length >= 3) {
      loadContacts();
      setHasSearched(true);
    } else if (searchQuery.length < 3) {
      setContacts([]);
      if (searchQuery.length > 0) {
        setHasSearched(false);
      }
    }
  }, [isOpen, searchQuery, contactMode]);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (lead) {
        setLeadData({
          name: lead.name || '',
          company: lead.company || '',
          title: lead.title || '',
          email: lead.email || '',
          phone: lead.phone || '',
          location: lead.location || '',
          profile_url: lead.profile_url || '',
          source: lead.source || 'manual',
          status: lead.status || 'leads',
          notes: lead.notes || '',
        });
        setStep(2);
      } else {
        resetForm();
      }
    }
  }, [isOpen, lead]);

  const resetForm = () => {
    setStep(1);
    setContactMode('existing');
    setSelectedContact(null);
    setSearchQuery('');
    setHasSearched(false);
    setContacts([]);
    setContactData({
      name: '',
      email: '',
      phone: '',
      company: '',
      title: '',
      location: '',
      profile_url: '',
    });
    setLeadData({
      name: '',
      company: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      profile_url: '',
      source: 'manual',
      status: 'leads',
      notes: '',
    });
    setErrors({});
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const params = { search: searchQuery, limit: 20 };
      const response = await api.getContacts(params);
      if (response.success) {
        setContacts(response.data.contacts || []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleLeadChange = (e) => {
    const { name, value } = e.target;
    setLeadData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const selectContact = (contact) => {
    setSelectedContact(contact);
    // Pre-fill lead data from contact
    setLeadData(prev => ({
      ...prev,
      name: contact.name || '',
      company: contact.company || '',
      title: contact.title || '',
      email: contact.email || '',
      phone: contact.phone || '',
      location: contact.location || '',
      profile_url: contact.profile_url || '',
    }));
  };

  const validateStep1 = () => {
    const newErrors = {};

    if (contactMode === 'new') {
      if (!contactData.name.trim()) {
        newErrors.name = 'Nome é obrigatório';
      }
      if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
        newErrors.email = 'Email inválido';
      }
    } else {
      if (!selectedContact) {
        newErrors.contact = 'Selecione um contato';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!leadData.name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (leadData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email)) {
      newErrors.email = 'Email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      if (contactMode === 'new') {
        // Pre-fill lead data from new contact data
        setLeadData(prev => ({
          ...prev,
          name: contactData.name,
          company: contactData.company || '',
          title: contactData.title || '',
          email: contactData.email || '',
          phone: contactData.phone || '',
          location: contactData.location || '',
          profile_url: contactData.profile_url || '',
        }));
      }
      setStep(2);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateStep2()) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...leadData,
        contact_id: selectedContact?.id || null,
        new_contact: contactMode === 'new' ? contactData : null,
      };

      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Error saving lead:', error);
      setErrors({ submit: error.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const sourceOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'google_maps', label: 'Google Maps' },
    { value: 'list', label: 'Lista' },
    { value: 'paid_traffic', label: 'Tráfego Pago' },
    { value: 'referral', label: 'Indicação' },
    { value: 'other', label: 'Outro' },
  ];

  const statusOptions = [
    { value: 'leads', label: t('stages.leads') },
    { value: 'invite_sent', label: t('stages.invite_sent') },
    { value: 'qualifying', label: t('stages.qualifying') },
    { value: 'accepted', label: t('stages.accepted') },
    { value: 'qualified', label: t('stages.qualified') },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isEditing ? 'Editar Oportunidade' : 'Nova Oportunidade'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {step === 1 ? 'Passo 1: Selecionar ou criar contato' : 'Passo 2: Detalhes da oportunidade'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        {!isEditing && (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= 1 ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : '1'}
              </div>
              <div className={`flex-1 h-1 ${step >= 2 ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= 2 ? 'bg-purple-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                2
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Select or Create Contact */}
        {step === 1 && !isEditing && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Contact Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setContactMode('existing')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  contactMode === 'existing'
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Link2 className="w-4 h-4" />
                <span className="text-sm font-medium">Contato Existente</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setContactMode('new');
                  setSelectedContact(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  contactMode === 'new'
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span className="text-sm font-medium">Novo Contato</span>
              </button>
            </div>

            {errors.contact && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {errors.contact}
              </div>
            )}

            {/* Existing Contact Search */}
            {contactMode === 'existing' && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Digite pelo menos 3 caracteres para buscar..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  />
                </div>

                {searchQuery.length > 0 && searchQuery.length < 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                    Digite mais {3 - searchQuery.length} caractere(s) para buscar
                  </p>
                )}

                {/* Contact List */}
                {searchQuery.length >= 3 && (
                  <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    {loadingContacts ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      </div>
                    ) : contacts.length === 0 ? (
                      <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                        Nenhum contato encontrado
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {contacts.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => selectContact(contact)}
                            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                              selectedContact?.id === contact.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                            }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                              {contact.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                                {contact.name}
                              </div>
                              {(contact.email || contact.company) && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {contact.email || contact.company}
                                </div>
                              )}
                            </div>
                            {selectedContact?.id === contact.id && (
                              <Check className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Selected contact indicator */}
                {selectedContact && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-sm font-semibold">
                        {selectedContact.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-purple-900 dark:text-purple-100">
                          {selectedContact.name}
                        </div>
                        <div className="text-xs text-purple-700 dark:text-purple-300">
                          Contato selecionado
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* New Contact Form */}
            {contactMode === 'new' && (
              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={contactData.name}
                      onChange={handleContactChange}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                        errors.name ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder="Nome completo"
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
                  )}
                </div>

                {/* Email e Telefone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        name="email"
                        value={contactData.email}
                        onChange={handleContactChange}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                          errors.email ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Telefone
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        name="phone"
                        value={contactData.phone}
                        onChange={handleContactChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="+55 11 99999-9999"
                      />
                    </div>
                  </div>
                </div>

                {/* Empresa e Cargo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Empresa
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        name="company"
                        value={contactData.company}
                        onChange={handleContactChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="Nome da empresa"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cargo
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={contactData.title}
                      onChange={handleContactChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      placeholder="Ex: Diretor Comercial"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Lead Details */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
            {errors.submit && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {errors.submit}
              </div>
            )}

            {/* Selected Contact Info */}
            {selectedContact && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-sm font-semibold">
                    {selectedContact.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-purple-900 dark:text-purple-100">
                      {selectedContact.name}
                    </div>
                    <div className="text-xs text-purple-700 dark:text-purple-300">
                      Contato vinculado
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Oportunidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={leadData.name}
                  onChange={handleLeadChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                    errors.name ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Nome do lead ou oportunidade"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Empresa e Cargo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Empresa
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={leadData.company}
                    onChange={handleLeadChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="Nome da empresa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={leadData.title}
                    onChange={handleLeadChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="Ex: Diretor Comercial"
                  />
                </div>
              </div>

              {/* Email e Telefone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={leadData.email}
                    onChange={handleLeadChange}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm ${
                      errors.email ? 'border-red-300 dark:border-red-700' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="email@exemplo.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={leadData.phone}
                    onChange={handleLeadChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>

              {/* Source e Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Origem
                  </label>
                  <select
                    name="source"
                    value={leadData.source}
                    onChange={handleLeadChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    {sourceOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Estágio
                  </label>
                  <select
                    name="status"
                    value={leadData.status}
                    onChange={handleLeadChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  >
                    {statusOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LinkedIn URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Perfil LinkedIn
                </label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="url"
                    name="profile_url"
                    value={leadData.profile_url}
                    onChange={handleLeadChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Observações
                </label>
                <textarea
                  name="notes"
                  value={leadData.notes}
                  onChange={handleLeadChange}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
                  placeholder="Notas ou observações sobre esta oportunidade..."
                />
              </div>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          {step === 1 && !isEditing ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Próximo
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Voltar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadFormModal;
