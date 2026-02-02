import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Download, Upload, Plus,
  Mail, Phone, MessageCircle, Instagram, Linkedin, Send,
  Eye, Edit2, Trash2, X, MapPin, FileText, Users, ChevronLeft, ChevronRight, Chrome
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import PermissionGate from '../components/PermissionGate';
import ContactFormModal from '../components/ContactFormModal';
import UnifiedContactModal from '../components/UnifiedContactModal';
import ContactAvatar from '../components/ContactAvatar';

const ContactsPage = () => {
  const { t } = useTranslation('contacts');
  const { hasPermission } = useAuth();

  // State
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 1 });

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [detailsContactId, setDetailsContactId] = useState(null);

  // Seleção múltipla
  const [selectedContactIds, setSelectedContactIds] = useState([]);

  // Channel icons and colors
  const channelConfig = {
    whatsapp: { icon: MessageCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
    instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-pink-100' },
    email: { icon: Mail, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    linkedin: { icon: Linkedin, color: 'text-blue-700', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    telegram: { icon: Send, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    phone: { icon: Phone, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' }
  };

  // Source (origem) icons and colors
  const sourceConfig = {
    google_maps: {
      icon: MapPin,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200',
      label: t('sources.googleMaps')
    },
    linkedin: {
      icon: Linkedin,
      color: 'text-blue-700',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200',
      label: t('sources.linkedin')
    },
    import: {
      icon: Upload,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200',
      label: t('sources.import')
    },
    manual: {
      icon: Users,
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-900',
      border: 'border-gray-200 dark:border-gray-700',
      label: t('sources.manual')
    },
    campaign: {
      icon: Send,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      label: t('sources.campaign')
    },
    chrome_extension: {
      icon: Chrome,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-200',
      label: t('sources.chromeExtension')
    }
  };

  // Tag colors (padronizado com LeadsPage e ConversationSidebar)
  const tagColors = {
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700'
  };

  // Load data
  useEffect(() => {
    loadContacts();
    loadTags();
  }, [searchQuery, selectedTags, sortBy, sortOrder, currentPage, itemsPerPage]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery,
        tags: selectedTags.join(','),
        sort_by: sortBy,
        sort_order: sortOrder,
        page: currentPage,
        limit: itemsPerPage
      };

      // Remove empty params
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key];
      });

      const response = await api.getContacts(params);

      if (response.success) {
        setContacts(response.data.contacts || []);
        setPagination(response.data.pagination || { page: currentPage, limit: itemsPerPage, total: 0, pages: 1 });
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
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSearchQuery('');
    setCurrentPage(1);
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
    if (!confirm(t('messages.confirmDelete'))) {
      return;
    }

    try {
      await api.deleteContact(contactId);
      loadContacts(); // Reload list
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert(t('messages.errorDelete'));
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

    if (!confirm(t('messages.confirmDeleteMultiple', { count: selectedContactIds.length }))) {
      return;
    }

    try {
      // Delete one by one (ou pode criar um endpoint bulk delete no backend)
      await Promise.all(selectedContactIds.map(id => api.deleteContact(id)));
      setSelectedContactIds([]);
      loadContacts(); // Reload list
    } catch (error) {
      console.error('Error deleting contacts:', error);
      alert(t('messages.errorDeleteMultiple'));
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
      alert(t('messages.errorExport'));
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
            alert(t('messages.importSuccess', {
              imported: response.data.imported,
              total: response.data.total_rows,
              errors: response.data.errors ? response.data.errors.length + ' ' + t('import.errors', { count: response.data.errors.length }) : ''
            }));
            loadContacts(); // Reload list
          }
        } catch (error) {
          console.error('Error importing contacts:', error);
          alert(t('messages.errorImport'));
        }
      };

      reader.readAsText(file);
    };

    input.click();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        {/* Search and Actions */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('page.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <PermissionGate permission="contacts:export">
            <button
              onClick={handleExport}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-gray-700 dark:text-gray-300 transition-colors"
              title={t('actions.export')}
            >
              <Download className="w-4 h-4" />
            </button>
          </PermissionGate>

          <PermissionGate permission="contacts:import">
            <button
              onClick={handleImport}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-gray-700 dark:text-gray-300 transition-colors"
              title={t('actions.import')}
            >
              <Upload className="w-4 h-4" />
            </button>
          </PermissionGate>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">{t('page.filters')}</span>
            {selectedTags.length > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-full min-w-[20px] text-center">
                {selectedTags.length}
              </span>
            )}
          </button>

          {selectedContactIds.length > 0 && (
            <PermissionGate permission="contacts:delete:own">
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Excluir ({selectedContactIds.length})
                </span>
              </button>
            </PermissionGate>
          )}

          <PermissionGate permission="contacts:create">
            <button
              onClick={handleCreateContact}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Novo Contato</span>
            </button>
          </PermissionGate>
        </div>

        {/* Active Filters Pills */}
        {selectedTags.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('page.activeFilters')}</span>
            {selectedTags.map(tagId => {
              const tag = tags.find(t => t.id === tagId);
              return tag ? (
                <span
                  key={tagId}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 text-xs rounded-full"
                >
                  {tag.name}
                  <button onClick={() => toggleTag(tagId)} className="hover:bg-purple-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : null;
            })}
            <button
              onClick={clearFilters}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
            >
              {t('page.clearAll')}
            </button>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* Tags Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('table.tags')}</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedTags.includes(tag.id)
                        ? tagColors[tag.color] || tagColors.blue
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
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
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Search className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">{t('page.noContactsFound')}</p>
            <p className="text-sm">{t('page.tryAdjustFilters')}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.length === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 cursor-pointer"
                  />
                </th>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('name')}
                >
                  {t('table.contact')} {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('company')}
                >
                  {t('table.company')} {sortBy === 'company' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.tags')}
                </th>
                <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {contacts.map((contact) => {
                const contactPhoto = getContactPhoto(contact);

                return (
                  <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 transition-colors">
                    {/* CHECKBOX */}
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedContactIds.includes(contact.id)}
                        onChange={() => toggleSelectContact(contact.id)}
                        className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>

                    {/* CONTATO */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ContactAvatar
                          photoUrl={contactPhoto}
                          name={contact.name}
                          size="sm"
                          updatedAt={contact.updated_at}
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-[11px] text-gray-900 dark:text-gray-100 truncate">
                            {contact.name}
                          </div>
                          {contact.title && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{contact.title}</div>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {contact.email && (
                              <div className="flex items-center gap-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                                <Mail className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[120px]">{contact.email}</span>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center gap-0.5 text-[10px] text-gray-600 dark:text-gray-400">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* EMPRESA */}
                    <td className="px-3 py-2">
                      {contact.company && (
                        <div className="text-[11px] text-gray-700 dark:text-gray-300">{contact.company}</div>
                      )}
                    </td>

                    {/* TAGS */}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags?.slice(0, 2).map((tag) => (
                          <span
                            key={tag.id}
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                              tagColors[tag.color] || tagColors.blue
                            }`}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {contact.tags?.length > 2 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                            +{contact.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                  {/* AÇÕES */}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleViewDetails(contact.id)}
                        className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/20 rounded transition-colors"
                        title={t('actions.viewDetails')}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <PermissionGate permission="contacts:edit:own">
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title={t('actions.edit')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="contacts:delete:own">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:bg-red-900/20 rounded transition-colors"
                          title={t('actions.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Pagination Controls */}
      {!loading && pagination.pages > 1 && (
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            {/* Left side - Items per page */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 dark:text-gray-400">Itens por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-[10px] text-gray-600 dark:text-gray-400">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, pagination.total)} de {pagination.total}
              </span>
            </div>

            {/* Right side - Page navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Primeira
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxVisible = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(pagination.pages, startPage + maxVisible - 1);

                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                          currentPage === i
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(pagination.pages, prev + 1))}
                disabled={currentPage === pagination.pages}
                className="p-1 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(pagination.pages)}
                disabled={currentPage === pagination.pages}
                className="px-2 py-1 text-[10px] font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Última
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

      <UnifiedContactModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        contactId={detailsContactId}
      />
    </div>
  );
};

export default ContactsPage;
