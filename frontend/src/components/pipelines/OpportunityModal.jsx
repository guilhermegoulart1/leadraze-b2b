// frontend/src/components/pipelines/OpportunityModal.jsx
import { useState, useEffect } from 'react';
import {
  X,
  Target,
  Search,
  User,
  Building2,
  DollarSign,
  Calendar,
  Percent,
  ChevronDown
} from 'lucide-react';
import api from '../../services/api';

const OpportunityModal = ({ opportunity, pipeline, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    contact_id: '',
    stage_id: '',
    title: '',
    value: '',
    probability: 0,
    expected_close_date: '',
    owner_user_id: ''
  });
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  const isNew = !opportunity?.id;

  useEffect(() => {
    loadUsers();

    if (opportunity?.id) {
      // Edição
      setFormData({
        contact_id: opportunity.contact_id || '',
        stage_id: opportunity.stage_id || '',
        title: opportunity.title || '',
        value: opportunity.value || '',
        probability: opportunity.probability || 0,
        expected_close_date: opportunity.expected_close_date
          ? new Date(opportunity.expected_close_date).toISOString().split('T')[0]
          : '',
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
      return;
    }

    try {
      setLoadingContacts(true);
      const response = await api.get(`/contacts?search=${encodeURIComponent(query)}&limit=10`);
      if (response.success) {
        setContacts(response.data.contacts || []);
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
      title: prev.title || `${contact.name}${contact.company ? ` - ${contact.company}` : ''}`
    }));
    setContacts([]);
    setContactSearch('');
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
        ...formData,
        value: parseFloat(formData.value) || 0,
        probability: parseInt(formData.probability) || 0,
        expected_close_date: formData.expected_close_date || null
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

                {/* Search Results */}
                {contacts.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
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
              Título *
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
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Selecione uma etapa</option>
              {pipeline?.stages?.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
          </div>

          {/* Value and Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Valor
                </div>
              </label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="0,00"
                min="0"
                step="0.01"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <div className="flex items-center gap-1">
                  <Percent className="w-4 h-4" />
                  Probabilidade
                </div>
              </label>
              <input
                type="number"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                placeholder="0"
                min="0"
                max="100"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Expected Close Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Previsão de Fechamento
              </div>
            </label>
            <input
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Responsável
            </label>
            <select
              value={formData.owner_user_id}
              onChange={(e) => setFormData({ ...formData, owner_user_id: e.target.value })}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:ring-2 focus:ring-purple-500"
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
