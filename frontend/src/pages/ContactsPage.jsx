import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Download, Upload, Plus,
  Mail, Phone, MessageCircle, Instagram, Linkedin, Send,
  Eye, Edit2, Trash2, X, MapPin, FileText, Users
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PermissionGate from '../components/PermissionGate';
import ContactFormModal from '../components/ContactFormModal';
import ContactDetailsModal from '../components/ContactDetailsModal';

const ContactsPage = () => {
  const { hasPermission } = useAuth();

  // State
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('last_interaction');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [detailsContactId, setDetailsContactId] = useState(null);

  // Seleção múltipla
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  // Channel icons and colors
  const channelConfig = {
    whatsapp: { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100' },
    instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100' },
    email: { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100' },
    linkedin: { icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-100' },
    telegram: { icon: Send, color: 'text-blue-500', bg: 'bg-blue-100' },
    phone: { icon: Phone, color: 'text-gray-600', bg: 'bg-gray-100' }
  };

  // Source (origem) icons and colors
  const sourceConfig = {
    google_maps: {
      icon: MapPin,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: 'Google Maps'
    },
    linkedin: {
      icon: Linkedin,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      label: 'LinkedIn'
    },
    import: {
      icon: Upload,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      label: 'Importação'
    },
    manual: {
      icon: Users,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      label: 'Manual'
    },
    campaign: {
      icon: Send,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      label: 'Campanha'
    }
  };

  // Tag colors
  const tagColors = {
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    green: 'bg-green-100 text-green-700 border-green-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    red: 'bg-red-100 text-red-700 border-red-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    pink: 'bg-pink-100 text-pink-700 border-pink-200'
  };

  // Load data
  useEffect(() => {
    loadContacts();
    loadTags();
  }, [searchQuery, selectedTags, selectedChannels, sortBy, sortOrder, pagination.page]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery,
        tags: selectedTags.join(','),
        channels: selectedChannels.join(','),
        sort_by: sortBy,
        sort_order: sortOrder,
        page: pagination.page,
        limit: pagination.limit
      };

      // Remove empty params
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await api.getContacts(params);

      if (response.success) {
        setContacts(response.data.contacts || []);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await api.getTags();
      if (response.success) {
        setTags(response.data.tags || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const toggleTag = (tagId) => {
    setSelectedTags(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleChannel = (channelType) => {
    setSelectedChannels(prev =>
      prev.includes(channelType)
        ? prev.filter(type => type !== channelType)
        : [...prev, channelType]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedChannels([]);
    setSearchQuery('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? 's' : ''} atrás`;

    return date.toLocaleDateString('pt-BR');
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Modal handlers
  const handleCreateContact = () => {
    setSelectedContact(null);
    setShowFormModal(true);
  };

  const handleEditContact = (contact) => {
    setSelectedContact(contact);
    setShowFormModal(true);
  };

  const handleViewDetails = (contactId) => {
    setDetailsContactId(contactId);
    setShowDetailsModal(true);
  };

  const handleSaveContact = async (formData) => {
    try {
      if (selectedContact) {
        // Update existing contact
        const response = await api.updateContact(selectedContact.id, formData);
        if (response.success) {
          loadContacts(); // Reload list
        }
      } else {
        // Create new contact
        const response = await api.createContact(formData);
        if (response.success) {
          loadContacts(); // Reload list
        }
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      throw error;
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) {
      return;
    }

    try {
      await api.deleteContact(contactId);
      loadContacts(); // Reload list
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Erro ao excluir contato');
    }
  };

  // Seleção múltipla
  const toggleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map(c => c.id));
    }
  };

  const toggleSelectContact = (contactId) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedContactIds.length === 0) return;

    if (!confirm(`Tem certeza que deseja excluir ${selectedContactIds.length} contato(s)?`)) {
      return;
    }

    try {
      // Delete one by one (ou pode criar um endpoint bulk delete no backend)
      await Promise.all(selectedContactIds.map(id => api.deleteContact(id)));
      setSelectedContactIds([]);
      loadContacts(); // Reload list
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert('Erro ao excluir contatos');
    }
  };

  // Helper para pegar foto do contato (suporta Google Maps)
  const getContactPhoto = (contact) => {
    // Se tem profile_picture, usa
    if (contact.profile_picture) {
      return contact.profile_picture;
    }

    // Se é do Google Maps e tem foto em custom_fields
    if (contact.source === 'google_maps' && contact.custom_fields) {
      try {
        const customFields = typeof contact.custom_fields === 'string'
          ? JSON.parse(contact.custom_fields)
          : contact.custom_fields;

        if (customFields.photos && customFields.photos.length > 0) {
          return customFields.photos[0];
        }
      } catch (e) {
        console.error('Error parsing custom_fields:', e);
      }
    }

    return null;
  };

  const handleExport = async () => {
    try {
      // Get current filters
      const filters = {
        search: searchQuery,
        tags: selectedTags.join(','),
        channels: selectedChannels.join(','),
      };

      // Remove empty params
      Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
      });

      const response = await api.exportContacts(filters);

      // The backend already sends the CSV with proper headers
      // Create a Blob and trigger download
      const blob = new Blob([response.data || response], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting contacts:', error);
      alert('Erro ao exportar contatos');
    }
  };

  const handleImport = () => {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvData = event.target.result;
          const response = await api.importContacts(csvData);

          if (response.success) {
            alert(`Importação concluída!\n${response.data.imported} contatos importados de ${response.data.total_rows} linhas.\n${response.data.errors ? response.data.errors.length + ' erros.' : ''}`);
            loadContacts(); // Reload list
          }
        } catch (error) {
          console.error('Error importing contacts:', error);
          alert('Erro ao importar contatos');
        }
      };

      reader.readAsText(file);
    };

    input.click();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-200">
        {/* Title and Actions */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
            <p className="text-sm text-gray-500 mt-1">
              {pagination.total} contato{pagination.total !== 1 ? 's' : ''} encontrado{pagination.total !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Botão Excluir Selecionados - aparece quando tem seleção */}
            {selectedContactIds.length > 0 && (
              <PermissionGate permission="contacts:delete:own">
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Excluir Selecionados ({selectedContactIds.length})
                  </span>
                </button>
              </PermissionGate>
            )}

            <PermissionGate permission="contacts:export">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Exportar</span>
              </button>
            </PermissionGate>

            <PermissionGate permission="contacts:import">
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm font-medium">Importar</span>
              </button>
            </PermissionGate>

            <PermissionGate permission="contacts:create">
              <button
                onClick={handleCreateContact}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Novo Contato</span>
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, email, telefone ou empresa..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-purple-50 border-purple-300 text-purple-700'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtros</span>
            {(selectedTags.length + selectedChannels.length) > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-full min-w-[20px] text-center">
                {selectedTags.length + selectedChannels.length}
              </span>
            )}
          </button>
        </div>

        {/* Active Filters Pills */}
        {(selectedTags.length > 0 || selectedChannels.length > 0) && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500">Filtros ativos:</span>
            {selectedTags.map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              return tag ? (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full"
                >
                  {tag.name}
                  <button onClick={() => toggleTag(tagId)} className="hover:bg-purple-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
            {selectedChannels.map(channel => (
              <span
                key={channel}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
              >
                {channel}
                <button onClick={() => toggleChannel(channel)} className="hover:bg-blue-200 rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              {/* Tags Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedTags.includes(tag.id)
                          ? tagColors[tag.color] || tagColors.blue
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channels Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canais</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(channelConfig).map(([type, config]) => {
                    const IconComponent = config.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => toggleChannel(type)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selectedChannels.includes(type)
                            ? `${config.bg} ${config.color} border-current`
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                        <span className="capitalize">{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contacts Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Search className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhum contato encontrado</p>
            <p className="text-sm">Tente ajustar os filtros ou criar um novo contato</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 w-12">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('name')}
                >
                  Contato {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('company')}
                >
                  Empresa {sortBy === 'company' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Canais
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Tags
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('last_interaction')}
                >
                  Última Interação {sortBy === 'last_interaction' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Mensagens
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((contact) => {
                const contactPhoto = getContactPhoto(contact);

                return (
                  <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                    {/* CHECKBOX */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={() => toggleSelectContact(contact.id)}
                        className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    {/* CONTATO */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {contactPhoto ? (
                          <img
                            src={contactPhoto}
                            alt={contact.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                            {contact.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-sm text-gray-900 truncate">
                            {contact.name}
                          </div>
                          {/* Source Badge */}
                          {contact.source && sourceConfig[contact.source] && (
                            <div
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${
                                sourceConfig[contact.source].bg
                              } ${sourceConfig[contact.source].color} ${sourceConfig[contact.source].border}`}
                              title={`Origem: ${sourceConfig[contact.source].label}`}
                            >
                              {React.createElement(sourceConfig[contact.source].icon, {
                                className: 'w-3 h-3'
                              })}
                              <span className="hidden xl:inline">{sourceConfig[contact.source].label}</span>
                            </div>
                          )}
                        </div>
                        {contact.title && (
                          <div className="text-xs text-gray-500 truncate">{contact.title}</div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {contact.email && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Phone className="w-3 h-3" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* EMPRESA */}
                  <td className="px-4 py-3">
                    {contact.company && (
                      <div className="text-sm text-gray-700">{contact.company}</div>
                    )}
                  </td>

                  {/* CANAIS */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {contact.channels?.slice(0, 4).map((channel, idx) => {
                        const config = channelConfig[channel.type];
                        if (!config) return null;
                        const IconComponent = config.icon;
                        return (
                          <div
                            key={idx}
                            className={`p-1.5 rounded-full ${config.bg}`}
                            title={`${channel.type}${channel.username ? ': ' + channel.username : ''}`}
                          >
                            <IconComponent className={`w-3.5 h-3.5 ${config.color}`} />
                          </div>
                        );
                      })}
                      {contact.channels?.length > 4 && (
                        <div className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          +{contact.channels.length - 4}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* TAGS */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag.id}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                            tagColors[tag.color] || tagColors.blue
                          }`}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {contact.tags?.length > 2 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          +{contact.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* ÚLTIMA INTERAÇÃO */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">
                      {formatDate(contact.last_interaction_at)}
                    </div>
                  </td>

                  {/* MENSAGENS */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700 font-medium">
                      {contact.total_messages || 0}
                    </div>
                  </td>

                  {/* AÇÕES */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleViewDetails(contact.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <PermissionGate permission="contacts:edit:own">
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="contacts:delete:own">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && pagination.pages > 1 && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} contatos
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600">
                Página {pagination.page} de {pagination.pages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ContactFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSave={handleSaveContact}
        contact={selectedContact}
        tags={tags}
      />

      <ContactDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        contactId={detailsContactId}
        onEdit={handleEditContact}
      />
    </div>
  );
};

export default ContactsPage;
