// frontend/src/pages/InstagramAgentDetailPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Download, Loader2, Search, Camera,
  Users, Image, RefreshCw, Target,
  Play, Clock, AlertCircle,
  ArrowUpDown, ArrowUp, ArrowDown,
  Copy, Check, Phone, Mail, Globe, ExternalLink, AtSign,
  TrendingUp
} from 'lucide-react';
import apiService from '../services/api';

const InstagramAgentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['instagram', 'common']);

  const [agent, setAgent] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [copiedId, setCopiedId] = useState(null);

  const itemsPerPage = 50;

  useEffect(() => {
    loadAgent();
    loadProfiles(1);
  }, [id]);

  const loadAgent = async () => {
    try {
      const result = await apiService.getInstagramAgent(id);
      if (result.success) {
        setAgent(result.agent);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadProfiles = async (pageNum) => {
    try {
      setProfilesLoading(true);
      const result = await apiService.getInstagramAgentProfiles(id, { page: pageNum, limit: itemsPerPage });
      if (result.success) {
        setProfiles(result.profiles || []);
        setPagination(result.pagination);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProfilesLoading(false);
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadProfiles(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportCSV = async () => {
    try {
      await apiService.exportInstagramAgentCSV(id);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

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

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatNumber = (num) => {
    if (num == null) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
    return num.toString();
  };

  const getStatusColor = (status) => {
    const styles = {
      active: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
      paused: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      completed: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      error: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
    };
    return styles[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  };

  const getStatusLabel = (status) => {
    const labels = { active: 'Ativo', paused: 'Pausado', completed: 'Concluído', error: 'Erro' };
    return labels[status] || status;
  };

  // Filter profiles by search term
  const filteredProfiles = useMemo(() => {
    if (!searchTerm) return profiles;
    const search = searchTerm.toLowerCase();
    return profiles.filter(p =>
      (p.username || '').toLowerCase().includes(search) ||
      (p.display_name || '').toLowerCase().includes(search) ||
      (p.bio || p.bio_excerpt || '').toLowerCase().includes(search)
    );
  }, [profiles, searchTerm]);

  // Sort profiles
  const sortedProfiles = useMemo(() => {
    if (!sortConfig.key) return filteredProfiles;
    return [...filteredProfiles].sort((a, b) => {
      let aValue, bValue;
      switch (sortConfig.key) {
        case 'name':
          aValue = (a.display_name || a.username || '').toLowerCase();
          bValue = (b.display_name || b.username || '').toLowerCase();
          break;
        case 'followers':
          aValue = a.followers_count || 0;
          bValue = b.followers_count || 0;
          break;
        case 'following':
          aValue = a.following_count || 0;
          bValue = b.following_count || 0;
          break;
        case 'posts':
          aValue = a.posts_count || 0;
          bValue = b.posts_count || 0;
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProfiles, sortConfig]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600 dark:text-purple-400" />
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => navigate('/instagram-agents')}
            className="mt-4 text-purple-600 dark:text-purple-400 hover:underline"
          >
            Voltar para Agentes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/instagram-agents')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-lg">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent?.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Search className="w-4 h-4" />
                <span>{agent?.search_niche} em {agent?.search_location}</span>
                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(agent?.status)}`}>
                  {getStatusLabel(agent?.status)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadAgent(); loadProfiles(page); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
          <button
            onClick={handleExportCSV}
            disabled={profiles.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Encontrados</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{agent?.total_profiles_found || 0}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Target className="w-4 h-4" />
            <span className="text-xs">Limite Total</span>
          </div>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{agent?.total_limit || 500}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Image className="w-4 h-4" />
            <span className="text-xs">Por Execucao</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{agent?.profiles_per_execution || 50}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs">Ultima Execucao</span>
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {agent?.last_execution_at
              ? new Date(agent.last_execution_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '-'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
            <Play className="w-4 h-4" />
            <span className="text-xs">Execucoes</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{agent?.execution_count || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por username, nome ou bio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredProfiles.length} de {profiles.length} perfis
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Bio
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('followers')}
                >
                  <div className="flex items-center gap-1">
                    Seguidores {getSortIcon('followers')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('following')}
                >
                  <div className="flex items-center gap-1">
                    Seguindo {getSortIcon('following')}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('posts')}
                >
                  <div className="flex items-center gap-1">
                    Posts {getSortIcon('posts')}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {profilesLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
                  </td>
                </tr>
              ) : sortedProfiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-40" />
                    <p>{searchTerm ? 'Nenhum perfil encontrado' : 'Nenhum perfil ainda'}</p>
                    {!searchTerm && (
                      <p className="text-sm mt-1">Execute o agente para comecar a coletar perfis do Instagram.</p>
                    )}
                  </td>
                </tr>
              ) : (
                sortedProfiles.map((profile, index) => (
                  <tr key={`${profile.username}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {/* Nome */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {(profile.display_name || profile.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="max-w-[180px]">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {profile.display_name || profile.username}
                          </p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 truncate">
                            @{profile.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Bio */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate max-w-[200px]"
                         title={profile.bio || profile.bio_excerpt || ''}>
                        {profile.bio || profile.bio_excerpt || '-'}
                      </p>
                    </td>
                    {/* Seguidores */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                        <Users className="w-3 h-3" />
                        {formatNumber(profile.followers_count)}
                      </div>
                    </td>
                    {/* Seguindo */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {formatNumber(profile.following_count)}
                      </span>
                    </td>
                    {/* Posts */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                        <Image className="w-3 h-3" />
                        {formatNumber(profile.posts_count)}
                      </div>
                    </td>
                    {/* Telefone */}
                    <td className="px-4 py-3">
                      {profile.extracted_contacts?.phones?.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            {profile.extracted_contacts.phones[0]}
                          </span>
                          <button
                            onClick={() => copyToClipboard(profile.extracted_contacts.phones[0], `phone-${profile.username}-${index}`)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Copiar"
                          >
                            {copiedId === `phone-${profile.username}-${index}` ? (
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
                    {/* Email */}
                    <td className="px-4 py-3">
                      {profile.extracted_contacts?.emails?.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <a
                            href={`mailto:${profile.extracted_contacts.emails[0]}`}
                            className="text-sm text-purple-600 dark:text-purple-400 hover:underline truncate max-w-[150px]"
                            title={profile.extracted_contacts.emails[0]}
                          >
                            {profile.extracted_contacts.emails[0]}
                          </a>
                          <button
                            onClick={() => copyToClipboard(profile.extracted_contacts.emails[0], `email-${profile.username}-${index}`)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                            title="Copiar"
                          >
                            {copiedId === `email-${profile.username}-${index}` ? (
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
                    {/* Links */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={profile.profile_url || `https://www.instagram.com/${profile.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-purple-600 dark:text-purple-400"
                          title="Ver no Instagram"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {(profile.external_url || profile.extracted_contacts?.websites?.length > 0) && (
                          <a
                            href={(() => {
                              const url = profile.extracted_contacts?.websites?.[0] || profile.external_url;
                              return url.startsWith('http') ? url : `https://${url}`;
                            })()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-blue-600 dark:text-blue-400"
                            title="Website"
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {((page - 1) * itemsPerPage) + 1} a {Math.min(page * itemsPerPage, agent?.total_profiles_found || 0)} de {agent?.total_profiles_found || 0}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Pagina {page} de {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= pagination.pages}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Proxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstagramAgentDetailPage;
