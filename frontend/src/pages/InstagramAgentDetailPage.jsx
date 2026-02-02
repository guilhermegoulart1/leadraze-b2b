// frontend/src/pages/InstagramAgentDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Download, Loader2, Search, Camera,
  ChevronLeft, ChevronRight, Users, Image, RefreshCw,
  Play, Pause, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import apiService from '../services/api';
import InstagramProfileResults from '../components/InstagramProfileResults';

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
      const result = await apiService.getInstagramAgentProfiles(id, { page: pageNum, limit: 20 });
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

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      paused: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      completed: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    };
    const icons = {
      active: <CheckCircle className="w-3.5 h-3.5" />,
      paused: <Pause className="w-3.5 h-3.5" />,
      completed: <CheckCircle className="w-3.5 h-3.5" />,
      error: <AlertCircle className="w-3.5 h-3.5" />
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.active}`}>
        {icons[status] || icons.active}
        {status}
      </span>
    );
  };

  // Filter profiles by search term
  const filteredProfiles = searchTerm
    ? profiles.filter(p =>
        (p.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.bio || p.bio_excerpt || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : profiles;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/instagram-agents')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar
        </button>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/instagram-agents')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Voltar para Agentes
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-xl flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {agent?.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                {agent?.status && getStatusBadge(agent.status)}
                {agent?.search_niche && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {agent.search_niche} - {agent.search_location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <button
              onClick={() => { loadAgent(); loadProfiles(page); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <Users className="w-4 h-4" />
            Perfis Encontrados
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {agent?.total_profiles_found || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <Image className="w-4 h-4" />
            Limite Total
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {agent?.total_limit || 500}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <Play className="w-4 h-4" />
            Execucoes
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {agent?.execution_count || 0}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Ultima Execucao
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
            {agent?.last_execution_at
              ? new Date(agent.last_execution_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '-'}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por username, nome ou bio..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
      </div>

      {/* Results */}
      {profilesLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Camera className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'Nenhum perfil encontrado' : 'Nenhum perfil ainda'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {searchTerm
              ? 'Tente ajustar os termos de busca.'
              : 'Execute o agente para comecar a coletar perfis do Instagram.'}
          </p>
        </div>
      ) : (
        <InstagramProfileResults profiles={filteredProfiles} />
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Pagina {pagination.page} de {pagination.pages} ({agent?.total_profiles_found || 0} perfis)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= pagination.pages}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors text-gray-600 dark:text-gray-400"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramAgentDetailPage;
