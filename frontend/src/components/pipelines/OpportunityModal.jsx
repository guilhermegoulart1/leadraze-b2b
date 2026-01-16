// frontend/src/components/pipelines/OpportunityModal.jsx
import { useState, useEffect } from 'react';
import {
  X,
  Target,
  Search,
  User,
  Plus,
  ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import PhoneInput, { validatePhone } from '../PhoneInput';

const OpportunityModal = ({ opportunity, pipeline, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    contact_id: '',
    stage_id: '',
    title: '',
    owner_user_id: ''
  });
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Estado para criar novo contato
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContactData, setNewContactData] = useState({
    name: '',
    email: '',
    phone: '',
    phone_country_code: '',
    company: '',
    source: 'manual'
  });
  const [creatingContact, setCreatingContact] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [contactErrors, setContactErrors] = useState({});

  // Opções de origem
  const SOURCE_OPTIONS = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'google_maps', label: 'Google Maps' },
    { value: 'list', label: 'Lista' },
    { value: 'paid_traffic', label: 'Tráfego Pago' },
    { value: 'manual', label: 'Manual' },
    { value: 'other', label: 'Outro' }
  ];

  // Validação de email (opcional, mas se fornecido deve ser válido)
  const validateEmail = (email) => {
    if (!email) return null; // Email não é obrigatório
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email inválido';
    return null;
  };

  const isNew = !opportunity?.id;

  useEffect(() => {
    loadUsers();

    if (opportunity?.id) {
      // Edição
      setFormData({
        contact_id: opportunity.contact_id || '',
        stage_id: opportunity.stage_id || '',
        title: opportunity.title || '',
        owner_user_id: opportunity.owner_user_id || ''
      });
      setSelectedContact({
        id: opportunity.contact_id,
        name: opportunity.contact_name,
        company: opportunity.contact_company,
        picture: opportunity.contact_picture
      });
    } else {
      // Nova oportunidade - selecionar primeira etapa
      if (pipeline?.stages?.length > 0) {
        setFormData(prev => ({
          ...prev,
          stage_id: pipeline.stages[0].id
        }));
      }
    }
  }, [opportunity, pipeline]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users');
      if (response.success) {
        setUsers(response.data.users || []);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const searchContacts = async (query) => {
    if (!query || query.length < 2) {
      setContacts([]);
      setSearchPerformed(false);
      return;
    }

    try {
      setLoadingContacts(true);
      const response = await api.get(`/contacts?search=${encodeURIComponent(query)}&limit=10`);
      if (response.success) {
        setContacts(response.data.contacts || []);
        setSearchPerformed(true);
      }
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleContactSearchChange = (e) => {
    const value = e.target.value;
    setContactSearch(value);
    searchContacts(value);
  };

  const selectContact = (contact) => {
    setSelectedContact(contact);
    setFormData(prev => ({
      ...prev,
      contact_id: contact.id,
      title: contact.name
    }));
    setContacts([]);
    setContactSearch('');
    setSearchPerformed(false);
  };

  const handleCreateContact = async () => {
    // Validar todos os campos
    const errors = {};

    if (!newContactData.name.trim()) {
      errors.name = 'Nome é obrigatório';
    }

    // Validar que pelo menos email OU telefone foi fornecido
    const hasEmail = newContactData.email && newContactData.email.trim();
    const hasPhone = newContactData.phone && newContactData.phone.trim();

    if (!hasEmail && !hasPhone) {
      errors.email = 'Informe email ou telefone';
      errors.phone = 'Informe email ou telefone';
    } else {
      // Validar formato apenas se o campo foi preenchido
      if (hasEmail) {
        const emailError = validateEmail(newContactData.email);
        if (emailError) errors.email = emailError;
      }

      if (hasPhone) {
        const phoneError = validatePhone(newContactData.phone, newContactData.phone_country_code);
        if (phoneError) errors.phone = phoneError;
      }
    }

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      return;
    }

    try {
      setCreatingContact(true);
      setError('');
      setContactErrors({});

      const response = await api.createContact(newContactData);

      if (response.success) {
        const newContact = response.data.contact;
        selectContact(newContact);
        setShowNewContactForm(false);
        setNewContactData({ name: '', email: '', phone: '', phone_country_code: '', company: '', source: 'manual' });
      } else {
        setError(response.message || 'Erro ao criar contato');
      }
    } catch (err) {
      setError(err.message || 'Erro ao criar contato');
    } finally {
      setCreatingContact(false);
    }
  };

  const openNewContactForm = () => {
    // Preencher nome com o texto da busca
    setNewContactData({
      name: contactSearch,
      email: '',
      phone: '',
      phone_country_code: '',
      company: '',
      source: 'manual'
    });
    setContactErrors({});
    setShowNewContactForm(true);
    setContacts([]);
    setSearchPerformed(false);
  };

  const handleSubmit = async () => {
    setError('');

    if (!formData.contact_id) {
      setError('Selecione um contato');
      return;
    }

    if (!formData.title.trim()) {
      setError('Título é obrigatório');
      return;
    }

    if (!formData.stage_id) {
      setError('Selecione uma etapa');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...formData
      };

      let response;
      if (opportunity?.id) {
        response = await api.updateOpportunity(opportunity.id, payload);
      } else {
        response = await api.createOpportunity(pipeline.id, payload);
      }

      if (response.success) {
        onSave();
      } else {
        setError(response.message || 'Erro ao salvar oportunidade');
      }
    } catch (err) {
      setError(err.message || 'Erro ao salvar oportunidade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isNew ? 'Nova Oportunidade' : 'Editar Oportunidade'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Contact Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contato *
            </label>

            {selectedContact ? (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-3">
                  {selectedContact.picture || selectedContact.profile_picture ? (
                    <img
                      src={selectedContact.picture || selectedContact.profile_picture}
                      alt={selectedContact.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedContact.name}</p>
                    {selectedContact.company && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedContact.company}</p>
                    )}
                  </div>
                </div>
                {isNew && (
                  <button
                    type="button"
                    onClick={() => setSelectedContact(null)}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    Trocar
                  </button>
                )}
              </div>
            ) : showNewContactForm ? (
              /* Formulário de novo contato */
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">Novo Contato</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewContactForm(false);
                      setNewContactData({ name: '', email: '', phone: '', phone_country_code: '', company: '', source: 'manual' });
                      setContactErrors({});
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Voltar
                  </button>
                </div>

                {/* Nome */}
                <div>
                  <input
                    type="text"
                    value={newContactData.name}
                    onChange={(e) => {
                      setNewContactData({ ...newContactData, name: e.target.value });
                      if (contactErrors.name) setContactErrors({ ...contactErrors, name: null });
                    }}
                    placeholder="Nome *"
                    className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500 ${
                      contactErrors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                    }`}
                    autoFocus
                  />
                  {contactErrors.name && (
                    <p className="mt-1 text-xs text-red-500">{contactErrors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <input
                    type="email"
                    value={newContactData.email}
                    onChange={(e) => {
                      setNewContactData({ ...newContactData, email: e.target.value });
                      if (contactErrors.email) setContactErrors({ ...contactErrors, email: null });
                    }}
                    placeholder="Email *"
                    className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500 ${
                      contactErrors.email ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                    }`}
                  />
                  {contactErrors.email && (
                    <p className="mt-1 text-xs text-red-500">{contactErrors.email}</p>
                  )}
                </div>

                {/* Telefone */}
                <PhoneInput
                  value={newContactData.phone}
                  onChange={(value) => {
                    setNewContactData({ ...newContactData, phone: value });
                    if (contactErrors.phone) setContactErrors({ ...contactErrors, phone: null });
                  }}
                  countryCode={newContactData.phone_country_code}
                  onCountryChange={(code) => setNewContactData({ ...newContactData, phone_country_code: code })}
                  error={contactErrors.phone}
                />

                {/* Empresa */}
                <input
                  type="text"
                  value={newContactData.company}
                  onChange={(e) => setNewContactData({ ...newContactData, company: e.target.value })}
                  placeholder="Empresa"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
                />

                {/* Origem */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Origem
                  </label>
                  <select
                    value={newContactData.source}
                    onChange={(e) => setNewContactData({ ...newContactData, source: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                  >
                    {SOURCE_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleCreateContact}
                  disabled={creatingContact}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {creatingContact ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Criar Contato
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={handleContactSearchChange}
                  placeholder="Buscar contato por nome, email ou empresa..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
                />

                {/* Search Results or No Results */}
                {(contacts.length > 0 || (searchPerformed && contacts.length === 0 && !loadingContacts)) && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                    {contacts.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => selectContact(contact)}
                        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                      >
                        {contact.profile_picture ? (
                          <img
                            src={contact.profile_picture}
                            alt={contact.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{contact.name}</p>
                          {contact.company && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">{contact.company}</p>
                          )}
                        </div>
                      </button>
                    ))}

                    {/* Opção de cadastrar novo contato */}
                    <button
                      type="button"
                      onClick={openNewContactForm}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-left border-t border-gray-100 dark:border-gray-700"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Plus className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          Cadastrar novo contato
                        </p>
                        {contactSearch && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            "{contactSearch}"
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                )}

                {loadingContacts && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent"></div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título da Oportunidade *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Projeto de Consultoria"
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Stage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Etapa *
            </label>
            <select
              value={formData.stage_id}
              onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Selecione uma etapa</option>
              {pipeline?.stages?.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Responsável
            </label>
            <select
              value={formData.owner_user_id}
              onChange={(e) => setFormData({ ...formData, owner_user_id: e.target.value })}
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Selecione um responsável</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : isNew ? 'Criar Oportunidade' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpportunityModal;
