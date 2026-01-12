// frontend/src/pages/GoogleMapsAgentDetailPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Map, MapPin, Phone, Mail, Globe, ExternalLink,
  Star, MessageSquare, Building2, Download, RefreshCw, Loader,
  AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check,
  Pause, Play, Target, Clock, TrendingUp, CheckCircle, Users,
  ChevronDown, ChevronRight, Brain, Sparkles, CalendarClock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getCategoryTranslation } from '../data/businessCategories';

const GoogleMapsAgentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const [agent, setAgent] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [isActioning, setIsActioning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [copiedId, setCopiedId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Helper to extract city/state from full location string
  const extractCityState = (location) => {
    if (!location) return '';
    // Ex: "Centro, Belo Horizonte, MG, Brasil" → "Belo Horizonte, MG"
    const parts = location.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
    }
    return location;
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load agent details
      const agentRes = await api.getGoogleMapsAgent(id);
      if (agentRes.success) {
        setAgent(agentRes.agent);
      }

      // Load contacts
      const contactsRes = await api.getGoogleMapsAgentContacts(id);
      if (contactsRes.success) {
        setContacts(contactsRes.contacts || []);

        // Debug logging for list-only mode
        if (agentRes.agent?.insert_in_crm === false && contactsRes.contacts?.length > 0) {
          console.log('[LIST MODE DEBUG] First contact structure:', contactsRes.contacts[0]);
          console.log('[LIST MODE DEBUG] Has AI fields:', {
            company_description: !!contactsRes.contacts[0]?.company_description,
            company_services: contactsRes.contacts[0]?.company_services,
            pain_points: contactsRes.contacts[0]?.pain_points,
            emails: contactsRes.contacts[0]?.emails,
            phones: contactsRes.contacts[0]?.phones
          });
        }
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (!confirm('Deseja pausar esta campanha?')) return;
    try {
      setIsActioning(true);
      await api.pauseGoogleMapsAgent(id);
      loadData();
    } catch (error) {
      alert(error.message || 'Erro ao pausar campanha');
    } finally {
      setIsActioning(false);
    }
  };

  const handleResume = async () => {
    try {
      setIsActioning(true);
      await api.resumeGoogleMapsAgent(id);
      loadData();
    } catch (error) {
      alert(error.message || 'Erro ao retomar campanha');
    } finally {
      setIsActioning(false);
    }
  };

  const handleExport = async () => {
    try {
      const csv = await api.exportGoogleMapsAgentContacts(id);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `google-maps-${agent?.name?.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert(error.message || 'Erro ao exportar CSV');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleRowExpand = (contactId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const parseJsonSafe = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value; // Already array (JSONB from any source)
    if (typeof value === 'object') return value; // Already object (JSONB from any source)
    try {
      return JSON.parse(value); // String JSON (fallback for special cases)
    } catch {
      return [];
    }
  };

  const hasAIAnalysis = (contact) => {
    return contact.company_description ||
           parseJsonSafe(contact.company_services).length > 0 ||
           parseJsonSafe(contact.pain_points).length > 0;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    try {
      let date = new Date(dateString);
      if (!dateString.includes('Z') && !dateString.includes('+') && !dateString.match(/\d{2}:\d{2}:\d{2}-\d{2}/)) {
        date = new Date(dateString + 'Z');
      }
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch {
      return 'Data inválida';
    }
  };

  // Filtering
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          (contact.name || '').toLowerCase().includes(search) ||
          (contact.business_category || '').toLowerCase().includes(search) ||
          (contact.city || '').toLowerCase().includes(search) ||
          (contact.email || '').toLowerCase().includes(search) ||
          (contact.phone || '').toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Rating filter
      if (minRating > 0 && (contact.rating || 0) < minRating) {
        return false;
      }

      return true;
    });
  }, [contacts, searchTerm, minRating]);

  // Sorting
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  const sortedContacts = useMemo(() => {
    if (!sortConfig.key) return filteredContacts;

    return [...filteredContacts].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        case 'category':
          aValue = a.business_category || '';
          bValue = b.business_category || '';
          break;
        case 'city':
          aValue = a.city || '';
          bValue = b.city || '';
          break;
        case 'rating':
          aValue = a.rating || 0;
          bValue = b.rating || 0;
          break;
        case 'reviews':
          aValue = a.review_count || 0;
          bValue = b.review_count || 0;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredContacts, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(sortedContacts.length / itemsPerPage);
  const paginatedContacts = sortedContacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderStars = (rating) => {
    if (!rating) return <span className="text-gray-400">-</span>;
    const numRating = parseFloat(rating) || 0;
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;

    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-3 h-3 ${
                i < fullStars
                  ? 'text-yellow-400 fill-yellow-400'
                  : i === fullStars && hasHalfStar
                  ? 'text-yellow-400 fill-yellow-400/50'
                  : 'text-gray-300'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-600 dark:text-gray-400 ml-1">{numRating.toFixed(1)}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Campanha não encontrada</p>
          <button
            onClick={() => navigate('/google-maps-agents')}
            className="mt-4 text-purple-600 dark:text-purple-400 hover:underline"
          >
            Voltar para Campanhas
          </button>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return { label: 'Ativo', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' };
      case 'paused':
        return { label: 'Pausado', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300' };
      case 'completed':
        return { label: 'Concluído', color: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' };
      default:
        return { label: status, color: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' };
    }
  };

  const statusConfig = getStatusConfig(agent.status);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/google-maps-agents')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 dark:border-purple-700"
              />
            ) : (
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Map className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>{getCategoryTranslation(agent.search_query, i18n.language)} em {extractCityState(agent.search_location)}</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>

          <button
            onClick={handleExport}
            disabled={contacts.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>

          {agent.status === 'active' && (
            <button
              onClick={handlePause}
              disabled={isActioning}
              className="flex items-center gap-2 px-4 py-2 text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/70 transition-colors disabled:opacity-50"
            >
              <Pause className="w-4 h-4" />
              Pausar
            </button>
          )}

          {agent.status === 'paused' && (
            <button
              onClick={handleResume}
              disabled={isActioning}
              className="flex items-center gap-2 px-4 py-2 text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Retomar
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Encontrados</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{agent.total_leads_found || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">{agent.insert_in_crm !== false ? 'No CRM' : 'Gerados'}</span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {agent.insert_in_crm !== false
              ? (agent.leads_inserted || 0)
              : (agent.found_places ? (Array.isArray(agent.found_places) ? agent.found_places.length : 0) : 0)
            }
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs">Limite Diário</span>
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{agent.daily_limit || 20}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Última Execução</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(agent.last_execution_at)}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <CalendarClock className="w-4 h-4" />
            <span className="text-xs">Próxima Execução</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{agent.next_execution_at ? formatDate(agent.next_execution_at) : '-'}</p>
        </div>

        {agent.assignee_count > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs">Rodízio</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{agent.assignee_count}</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, categoria, cidade, email, telefone..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <select
              value={minRating}
              onChange={(e) => {
                setMinRating(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value={0}>Todos os ratings</option>
              <option value={3}>3+ estrelas</option>
              <option value={4}>4+ estrelas</option>
              <option value={4.5}>4.5+ estrelas</option>
            </select>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredContacts.length} de {contacts.length} contatos
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Nome {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1">
                    Categoria {getSortIcon('category')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('city')}
                >
                  <div className="flex items-center gap-1">
                    Cidade {getSortIcon('city')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('rating')}
                >
                  <div className="flex items-center gap-1">
                    Rating {getSortIcon('rating')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('reviews')}
                >
                  <div className="flex items-center gap-1">
                    Reviews {getSortIcon('reviews')}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Links
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  IA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Building2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>Nenhum contato encontrado</p>
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((contact) => (
                  <React.Fragment key={contact.id}>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <div className="max-w-[200px]">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={contact.name}>
                            {contact.name}
                          </p>
                          {(contact.address || contact.location) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={contact.address || contact.location}>
                              {contact.address || contact.location}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {contact.business_category ? getCategoryTranslation(contact.business_category, i18n.language) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {contact.city || contact.state
                            ? `${contact.city || ''}${contact.city && contact.state ? ', ' : ''}${contact.state || ''}`
                            : (contact.location || contact.address || '-').split(',').slice(-2).join(',').trim() || '-'
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {renderStars(contact.rating)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                          <MessageSquare className="w-3 h-3" />
                          {contact.review_count || 0}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {contact.phone ? (
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{contact.phone}</span>
                            <button
                              onClick={() => copyToClipboard(contact.phone, `phone-${contact.id}`)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                              title="Copiar"
                            >
                              {copiedId === `phone-${contact.id}` ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {contact.email ? (
                          <div className="flex items-center gap-1">
                            <a
                              href={`mailto:${contact.email}`}
                              className="text-sm text-purple-600 dark:text-purple-400 hover:underline truncate max-w-[150px]"
                              title={contact.email}
                            >
                              {contact.email}
                            </a>
                            <button
                              onClick={() => copyToClipboard(contact.email, `email-${contact.id}`)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                              title="Copiar"
                            >
                              {copiedId === `email-${contact.id}` ? (
                                <Check className="w-3 h-3 text-green-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {contact.website && (
                            <a
                              href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-blue-600 dark:text-blue-400"
                              title="Website"
                            >
                              <Globe className="w-4 h-4" />
                            </a>
                          )}
                          {contact.google_maps_url && (
                            <a
                              href={contact.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-green-600 dark:text-green-400"
                              title="Google Maps"
                            >
                              <MapPin className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {hasAIAnalysis(contact) ? (
                          <button
                            onClick={() => toggleRowExpand(contact.id)}
                            className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded text-purple-600 dark:text-purple-400"
                            title="Ver análise de IA"
                          >
                            {expandedRows.has(contact.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <Brain className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                    {/* Expanded row for AI analysis */}
                    {expandedRows.has(contact.id) && hasAIAnalysis(contact) && (
                      <tr className="bg-purple-50 dark:bg-purple-900/10">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Company Description */}
                            {contact.company_description && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                                  <Sparkles className="w-4 h-4" />
                                  Descrição da Empresa
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                  {contact.company_description}
                                </p>
                              </div>
                            )}
                            {/* Services */}
                            {parseJsonSafe(contact.company_services).length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                                  <CheckCircle className="w-4 h-4" />
                                  Serviços
                                </div>
                                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                  {parseJsonSafe(contact.company_services).map((service, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                                      {service}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {/* Pain Points */}
                            {parseJsonSafe(contact.pain_points).length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300">
                                  <AlertCircle className="w-4 h-4" />
                                  Possíveis Dores
                                </div>
                                <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                  {parseJsonSafe(contact.pain_points).map((pain, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />
                                      {pain}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, sortedContacts.length)} de {sortedContacts.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleMapsAgentDetailPage;
